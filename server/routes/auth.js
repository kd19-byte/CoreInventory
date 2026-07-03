import express from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { body } from 'express-validator'
import pool from '../db.js'
import { authenticateToken, requireRole } from '../middleware/auth.js'
import { validateRequest } from '../middleware/validate.js'
import { ok } from '../utils/http.js'
import AppError from '../utils/AppError.js'
import { sendPasswordResetEmail } from '../utils/mailer.js'

const router = express.Router()

const normalizeEmail = (email = '') => String(email).trim().toLowerCase()
const userPublic = (u) => (u ? ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  last_login_at: u.last_login_at,
  created_at: u.created_at,
}) : null)

const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex')

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-env'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h'
const RESET_JWT_SECRET = process.env.RESET_JWT_SECRET || JWT_SECRET
const RESET_TOKEN_EXPIRES_IN = process.env.RESET_TOKEN_EXPIRES_IN || '15m'
const OTP_EXPIRES_MINUTES = Number(process.env.OTP_EXPIRES_MINUTES || 15)
const OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS || 5)

const signAccessToken = (user) => jwt.sign(
  {
    sub: user.id,
    role: user.role,
    email: user.email,
    name: user.name,
  },
  JWT_SECRET,
  { expiresIn: JWT_EXPIRES_IN }
)

router.post(
  '/signup',
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  validateRequest,
  async (req, res, next) => {
    try {
      const { email, password, name, role } = req.body
      const normalizedEmail = normalizeEmail(email)
      const safeRole = role === 'manager' || role === 'staff' ? role : 'staff'

      const [existing] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [normalizedEmail])
      if (existing[0]) throw new AppError('Email already registered', 409)

      const password_hash = await bcrypt.hash(password, 10)
      const displayName = (name || normalizedEmail.split('@')[0]).trim()

      const [result] = await pool.query(
        'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
        [displayName, normalizedEmail, password_hash, safeRole]
      )

      const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [result.insertId])
      const user = userPublic(rows[0])
      const token = signAccessToken(user)
      return ok(res, { user, token })
    } catch (err) {
      return next(err)
    }
  }
)

router.post(
  '/login',
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
  validateRequest,
  async (req, res, next) => {
    try {
      const normalizedEmail = normalizeEmail(req.body?.email)
      const password = String(req.body?.password || '')

      const [rows] = await pool.query('SELECT * FROM users WHERE email = ? LIMIT 1', [normalizedEmail])
      const user = rows[0]
      if (!user) throw new AppError('Invalid credentials', 401)

      const valid = await bcrypt.compare(password, user.password_hash)
      if (!valid) throw new AppError('Invalid credentials', 401)

      await pool.query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [user.id])
      const [fresh] = await pool.query('SELECT * FROM users WHERE id = ?', [user.id])
      const userData = userPublic(fresh[0])
      const token = signAccessToken(userData)

      return ok(res, { user: userData, token })
    } catch (err) {
      return next(err)
    }
  }
)

router.post('/forgot-password', async (req, res, next) => {
  try {
    const normalizedEmail = normalizeEmail(req.body?.email)
    if (!normalizedEmail) throw new AppError('Email is required', 400)

    const [rows] = await pool.query('SELECT * FROM users WHERE email = ? LIMIT 1', [normalizedEmail])
    const user = rows[0]

    if (user) {
      const code = String(crypto.randomInt(100000, 1000000))
      const expiresAt = new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000)

      await pool.query(
        'INSERT INTO password_resets (user_id, email, code_hash, expires_at) VALUES (?, ?, ?, ?)',
        [user.id, normalizedEmail, sha256(code), expiresAt]
      )
      const mailResult = await sendPasswordResetEmail(normalizedEmail, code)
      if (!mailResult?.delivered) {
        return ok(res, {
          ok: true,
          message: 'If an account exists, a reset code has been generated.',
        })
      }
    }

    return ok(res, { ok: true, message: 'If an account exists, a reset code has been sent.' })
  } catch (err) {
    return next(err)
  }
})

router.post('/verify-reset-code', async (req, res, next) => {
  try {
    const normalizedEmail = normalizeEmail(req.body?.email)
    const code = String(req.body?.code || '').trim()
    if (!normalizedEmail || !code) throw new AppError('Email and code are required', 400)

    const [rows] = await pool.query(
      `SELECT * FROM password_resets
       WHERE email = ? AND used_at IS NULL AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [normalizedEmail]
    )
    const reset = rows[0]
    if (!reset) throw new AppError('Invalid or expired reset code', 400)
    if (Number(reset.attempt_count) >= OTP_MAX_ATTEMPTS) {
      throw new AppError('Too many attempts. Request a new code.', 429)
    }

    if (sha256(code) !== reset.code_hash) {
      await pool.query('UPDATE password_resets SET attempt_count = attempt_count + 1 WHERE id = ?', [reset.id])
      throw new AppError('Invalid or expired reset code', 400)
    }

    const resetToken = jwt.sign(
      { sub: reset.user_id, email: normalizedEmail, resetId: reset.id, purpose: 'password_reset' },
      RESET_JWT_SECRET,
      { expiresIn: RESET_TOKEN_EXPIRES_IN }
    )

    return ok(res, { resetToken })
  } catch (err) {
    return next(err)
  }
})

router.post('/reset-password', async (req, res, next) => {
  try {
    const resetToken = String(req.body?.resetToken || '').trim()
    const newPassword = String(req.body?.newPassword || '')
    if (!resetToken || !newPassword) throw new AppError('resetToken and newPassword are required', 400)
    if (newPassword.length < 8) throw new AppError('Password must be at least 8 characters', 400)

    let payload
    try {
      payload = jwt.verify(resetToken, RESET_JWT_SECRET)
    } catch {
      throw new AppError('Invalid or expired reset session', 400)
    }

    if (payload.purpose !== 'password_reset') throw new AppError('Invalid reset session', 400)

    const [rows] = await pool.query(
      `SELECT * FROM password_resets
       WHERE id = ? AND user_id = ? AND email = ? AND used_at IS NULL AND expires_at > NOW()
       LIMIT 1`,
      [payload.resetId, payload.sub, payload.email]
    )
    const reset = rows[0]
    if (!reset) throw new AppError('Reset session is no longer valid', 400)

    const password_hash = await bcrypt.hash(newPassword, 10)
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash, payload.sub])
    await pool.query('UPDATE password_resets SET used_at = NOW() WHERE id = ?', [reset.id])

    return ok(res, { ok: true })
  } catch (err) {
    return next(err)
  }
})

router.post('/update-password', authenticateToken, async (req, res, next) => {
  try {
    const newPassword = String(req.body?.newPassword || '')
    if (!newPassword) throw new AppError('New password is required', 400)
    if (newPassword.length < 8) throw new AppError('Password must be at least 8 characters', 400)
    const password_hash = await bcrypt.hash(newPassword, 10)
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash, req.user.id])
    return ok(res, { ok: true })
  } catch (err) {
    return next(err)
  }
})

router.get('/me', authenticateToken, async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ? LIMIT 1', [req.user.id])
    if (!rows[0]) throw new AppError('User not found', 404)
    return ok(res, { user: userPublic(rows[0]) })
  } catch (err) {
    return next(err)
  }
})

router.post('/users', authenticateToken, requireRole('manager'), async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email)
    const password = String(req.body?.password || '')
    const name = String(req.body?.name || '').trim() || email.split('@')[0]
    const role = req.body?.role === 'manager' ? 'manager' : 'staff'

    if (!email || !password) throw new AppError('Email and password are required', 400)
    if (password.length < 8) throw new AppError('Password must be at least 8 characters', 400)

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email])
    if (existing[0]) throw new AppError('Email already registered', 409)

    const password_hash = await bcrypt.hash(password, 10)
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, email, password_hash, role]
    )
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [result.insertId])
    return ok(res, { user: userPublic(rows[0]) })
  } catch (err) {
    return next(err)
  }
})

export default router
