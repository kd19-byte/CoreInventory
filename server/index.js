import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import mysql from 'mysql2/promise'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import nodemailer from 'nodemailer'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'inventory_system',
  connectionLimit: Number(process.env.DB_POOL_SIZE || 10),
  namedPlaceholders: true,
})

const ok = (res, data = {}) => res.json(data)
const fail = (res, status, message) => res.status(status).json({ error: message })
const normalizeEmail = (email = '') => String(email).trim().toLowerCase()

const userPublic = (u) => (u ? ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  last_login_at: u.last_login_at,
  created_at: u.created_at,
}) : null)

const makeRef = (prefix) => `${prefix}/${String(Date.now()).slice(-6)}${crypto.randomInt(10, 99)}`
const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex')

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-env'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h'
const RESET_JWT_SECRET = process.env.RESET_JWT_SECRET || JWT_SECRET
const RESET_TOKEN_EXPIRES_IN = process.env.RESET_TOKEN_EXPIRES_IN || '15m'
const OTP_EXPIRES_MINUTES = Number(process.env.OTP_EXPIRES_MINUTES || 15)
const OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS || 5)
const MAIL_PROVIDER = String(process.env.MAIL_PROVIDER || 'smtp').toLowerCase()
const RESEND_API_KEY = process.env.RESEND_API_KEY || ''
const RESEND_FROM = process.env.RESEND_FROM || process.env.MAIL_FROM || ''

const mailConfigured = Boolean(process.env.MAIL_HOST && process.env.MAIL_USER && process.env.MAIL_PASS)
const transporter = mailConfigured
  ? nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: Number(process.env.MAIL_PORT || 587),
      secure: String(process.env.MAIL_SECURE || 'false') === 'true',
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    })
  : null

const signAccessToken = (user) =>
  jwt.sign(
    {
      sub: user.id,
      role: user.role,
      email: user.email,
      name: user.name,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  )

async function sendPasswordResetEmail(email, code) {
  const text = `Your CoreInventory reset code is ${code}. It expires in ${OTP_EXPIRES_MINUTES} minutes.`
  const html = `
    <div style="font-family:Arial,sans-serif;font-size:14px;color:#111827">
      <p>Your CoreInventory reset code is:</p>
      <p style="font-size:24px;font-weight:700;letter-spacing:4px;margin:12px 0">${code}</p>
      <p>This code expires in ${OTP_EXPIRES_MINUTES} minutes.</p>
    </div>
  `

  if (MAIL_PROVIDER === 'resend') {
    if (!RESEND_API_KEY || !RESEND_FROM) {
      console.warn(`MAIL_NOT_CONFIGURED(RESEND) reset code for ${email}: ${code}`)
      return { delivered: false }
    }
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: RESEND_FROM,
          to: [email],
          subject: 'CoreInventory password reset code',
          text,
          html,
        }),
      })
      if (!res.ok) {
        const body = await res.text()
        console.warn(`MAIL_SEND_FAILED(RESEND) for ${email}: ${body}`)
        console.warn(`Fallback reset code for ${email}: ${code}`)
        return { delivered: false }
      }
      return { delivered: true }
    } catch (err) {
      console.warn(`MAIL_SEND_FAILED(RESEND) for ${email}: ${err.message}`)
      console.warn(`Fallback reset code for ${email}: ${code}`)
      return { delivered: false }
    }
  }

  if (!transporter) {
    console.warn(`MAIL_NOT_CONFIGURED(SMTP) reset code for ${email}: ${code}`)
    return { delivered: false }
  }

  const from = process.env.MAIL_FROM || process.env.MAIL_USER
  try {
    await transporter.sendMail({
      from,
      to: email,
      subject: 'CoreInventory password reset code',
      text,
      html,
    })
    return { delivered: true }
  } catch (err) {
    // Dev-safe fallback: keep flow working while SMTP credentials are being fixed.
    console.warn(`MAIL_SEND_FAILED(SMTP) for ${email}: ${err.message}`)
    console.warn(`Fallback reset code for ${email}: ${code}`)
    return { delivered: false }
  }
}

const requireAuth = (req, res, next) => {
  const auth = req.headers.authorization || ''
  if (!auth.startsWith('Bearer ')) return fail(res, 401, 'Unauthorized')

  const token = auth.slice(7).trim()
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.user = {
      id: Number(decoded.sub),
      role: decoded.role,
      email: decoded.email,
      name: decoded.name,
    }
    return next()
  } catch {
    return fail(res, 401, 'Invalid or expired session')
  }
}

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return fail(res, 401, 'Unauthorized')
  if (!roles.includes(req.user.role)) return fail(res, 403, 'Forbidden')
  return next()
}

async function ensureAuthTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      email VARCHAR(150) NOT NULL,
      code_hash VARCHAR(255) NOT NULL,
      expires_at DATETIME NOT NULL,
      used_at DATETIME NULL,
      attempt_count INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_password_resets_email (email),
      INDEX idx_password_resets_user (user_id),
      CONSTRAINT fk_password_resets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `)
}

async function getStock(conn, productId, locationId) {
  const [rows] = await conn.query(
    'SELECT qty FROM stock_ledger WHERE product_id = ? AND location_id = ? LIMIT 1',
    [productId, locationId]
  )
  return rows[0] ? Number(rows[0].qty) : 0
}

async function setStock(conn, productId, locationId, qty) {
  await conn.query(
    `INSERT INTO stock_ledger (product_id, location_id, qty)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE qty = VALUES(qty)`,
    [productId, locationId, qty]
  )
}

app.get('/api/health', (_req, res) => ok(res, { ok: true }))

// ─── Auth ───────────────────────────────────────────────────
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, name, role } = req.body
    if (!email || !password) return fail(res, 400, 'Email and password are required')
    if (password.length < 8) return fail(res, 400, 'Password must be at least 8 characters')
    const normalizedEmail = normalizeEmail(email)

    const safeRole = role === 'manager' || role === 'staff' ? role : 'staff'

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [normalizedEmail])
    if (existing[0]) return fail(res, 409, 'Email already registered')

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
    return fail(res, 500, err.message)
  }
})

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return fail(res, 400, 'Email and password are required')
    const normalizedEmail = normalizeEmail(email)

    const [rows] = await pool.query('SELECT * FROM users WHERE email = ? LIMIT 1', [normalizedEmail])
    const user = rows[0]
    if (!user) return fail(res, 401, 'Invalid credentials')

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) return fail(res, 401, 'Invalid credentials')

    await pool.query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [user.id])
    const [fresh] = await pool.query('SELECT * FROM users WHERE id = ?', [user.id])
    const userData = userPublic(fresh[0])
    const token = signAccessToken(userData)

    return ok(res, { user: userData, token })
  } catch (err) {
    return fail(res, 500, err.message)
  }
})

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const normalizedEmail = normalizeEmail(req.body?.email)
    if (!normalizedEmail) return fail(res, 400, 'Email is required')

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
        // Keep the response generic to avoid exposing reset codes in the UI.
        return ok(res, {
          ok: true,
          message: 'If an account exists, a reset code has been generated.',
        })
      }
    }

    return ok(res, { ok: true, message: 'If an account exists, a reset code has been sent.' })
  } catch (err) {
    return fail(res, 500, err.message)
  }
})

app.post('/api/auth/verify-reset-code', async (req, res) => {
  try {
    const normalizedEmail = normalizeEmail(req.body?.email)
    const code = String(req.body?.code || '').trim()
    if (!normalizedEmail || !code) return fail(res, 400, 'Email and code are required')

    const [rows] = await pool.query(
      `SELECT * FROM password_resets
       WHERE email = ? AND used_at IS NULL AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [normalizedEmail]
    )
    const reset = rows[0]
    if (!reset) return fail(res, 400, 'Invalid or expired reset code')
    if (Number(reset.attempt_count) >= OTP_MAX_ATTEMPTS) return fail(res, 429, 'Too many attempts. Request a new code.')

    if (sha256(code) !== reset.code_hash) {
      await pool.query('UPDATE password_resets SET attempt_count = attempt_count + 1 WHERE id = ?', [reset.id])
      return fail(res, 400, 'Invalid or expired reset code')
    }

    const resetToken = jwt.sign(
      { sub: reset.user_id, email: normalizedEmail, resetId: reset.id, purpose: 'password_reset' },
      RESET_JWT_SECRET,
      { expiresIn: RESET_TOKEN_EXPIRES_IN }
    )

    return ok(res, { resetToken })
  } catch (err) {
    return fail(res, 500, err.message)
  }
})

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const resetToken = String(req.body?.resetToken || '').trim()
    const newPassword = String(req.body?.newPassword || '')
    if (!resetToken || !newPassword) return fail(res, 400, 'resetToken and newPassword are required')
    if (newPassword.length < 8) return fail(res, 400, 'Password must be at least 8 characters')

    let payload
    try {
      payload = jwt.verify(resetToken, RESET_JWT_SECRET)
    } catch {
      return fail(res, 400, 'Invalid or expired reset session')
    }
    if (payload.purpose !== 'password_reset') return fail(res, 400, 'Invalid reset session')

    const [rows] = await pool.query(
      `SELECT * FROM password_resets
       WHERE id = ? AND user_id = ? AND email = ? AND used_at IS NULL AND expires_at > NOW()
       LIMIT 1`,
      [payload.resetId, payload.sub, payload.email]
    )
    const reset = rows[0]
    if (!reset) return fail(res, 400, 'Reset session is no longer valid')

    const password_hash = await bcrypt.hash(newPassword, 10)
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash, payload.sub])
    await pool.query('UPDATE password_resets SET used_at = NOW() WHERE id = ?', [reset.id])

    return ok(res, { ok: true })
  } catch (err) {
    return fail(res, 500, err.message)
  }
})

app.post('/api/auth/update-password', requireAuth, async (req, res) => {
  try {
    const newPassword = String(req.body?.newPassword || '')
    if (!newPassword) return fail(res, 400, 'New password is required')
    if (newPassword.length < 8) return fail(res, 400, 'Password must be at least 8 characters')
    const password_hash = await bcrypt.hash(newPassword, 10)
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash, req.user.id])
    return ok(res, { ok: true })
  } catch (err) {
    return fail(res, 500, err.message)
  }
})

app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ? LIMIT 1', [req.user.id])
    if (!rows[0]) return fail(res, 404, 'User not found')
    return ok(res, { user: userPublic(rows[0]) })
  } catch (err) {
    return fail(res, 500, err.message)
  }
})

app.post('/api/auth/users', requireAuth, requireRole('manager'), async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email)
    const password = String(req.body?.password || '')
    const name = String(req.body?.name || '').trim() || email.split('@')[0]
    const role = req.body?.role === 'manager' ? 'manager' : 'staff'
    if (!email || !password) return fail(res, 400, 'Email and password are required')
    if (password.length < 8) return fail(res, 400, 'Password must be at least 8 characters')

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email])
    if (existing[0]) return fail(res, 409, 'Email already registered')

    const password_hash = await bcrypt.hash(password, 10)
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, email, password_hash, role]
    )
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [result.insertId])
    return ok(res, { user: userPublic(rows[0]) })
  } catch (err) {
    return fail(res, 500, err.message)
  }
})

app.use('/api', requireAuth)

// ─── Warehouses ──────────────────────────────────────────────
app.get('/api/warehouses', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM warehouses ORDER BY name')
    return ok(res, { data: rows })
  } catch (err) {
    return fail(res, 500, err.message)
  }
})

app.post('/api/warehouses', requireRole('manager'), async (req, res) => {
  try {
    const { name, address, created_by } = req.body
    if (!name) return fail(res, 400, 'Name is required')

    const [result] = await pool.query(
      'INSERT INTO warehouses (name, address, created_by) VALUES (?, ?, ?)',
      [name, address || null, created_by || null]
    )
    const [rows] = await pool.query('SELECT * FROM warehouses WHERE id = ?', [result.insertId])
    return ok(res, { data: rows[0] })
  } catch (err) {
    return fail(res, 500, err.message)
  }
})

app.put('/api/warehouses/:id', requireRole('manager'), async (req, res) => {
  try {
    const { id } = req.params
    const { name, address } = req.body
    await pool.query('UPDATE warehouses SET name = ?, address = ? WHERE id = ?', [name, address || null, id])
    const [rows] = await pool.query('SELECT * FROM warehouses WHERE id = ?', [id])
    return ok(res, { data: rows[0] })
  } catch (err) {
    return fail(res, 500, err.message)
  }
})

app.delete('/api/warehouses/:id', requireRole('manager'), async (req, res) => {
  try {
    const { id } = req.params
    await pool.query('DELETE FROM warehouses WHERE id = ?', [id])
    return ok(res, { ok: true })
  } catch (err) {
    return fail(res, 500, err.message)
  }
})

// ─── Locations ───────────────────────────────────────────────
app.get('/api/locations', async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT l.*, w.name AS warehouse_name
      FROM locations l
      LEFT JOIN warehouses w ON w.id = l.warehouse_id
      ORDER BY l.name
    `)
    return ok(res, { data: rows })
  } catch (err) {
    return fail(res, 500, err.message)
  }
})

app.post('/api/locations', requireRole('manager'), async (req, res) => {
  try {
    const { name, warehouse_id, type } = req.body
    if (!name) return fail(res, 400, 'Name is required')

    const [result] = await pool.query(
      'INSERT INTO locations (name, warehouse_id, type) VALUES (?, ?, ?)',
      [name, warehouse_id || null, type || 'internal']
    )
    const [rows] = await pool.query(`
      SELECT l.*, w.name AS warehouse_name
      FROM locations l
      LEFT JOIN warehouses w ON w.id = l.warehouse_id
      WHERE l.id = ?
    `, [result.insertId])
    return ok(res, { data: rows[0] })
  } catch (err) {
    return fail(res, 500, err.message)
  }
})

app.put('/api/locations/:id', requireRole('manager'), async (req, res) => {
  try {
    const { id } = req.params
    const { name, warehouse_id, type } = req.body
    await pool.query(
      'UPDATE locations SET name = ?, warehouse_id = ?, type = ? WHERE id = ?',
      [name, warehouse_id || null, type || 'internal', id]
    )
    const [rows] = await pool.query(`
      SELECT l.*, w.name AS warehouse_name
      FROM locations l
      LEFT JOIN warehouses w ON w.id = l.warehouse_id
      WHERE l.id = ?
    `, [id])
    return ok(res, { data: rows[0] })
  } catch (err) {
    return fail(res, 500, err.message)
  }
})

app.delete('/api/locations/:id', requireRole('manager'), async (req, res) => {
  try {
    const { id } = req.params
    await pool.query('DELETE FROM locations WHERE id = ?', [id])
    return ok(res, { ok: true })
  } catch (err) {
    return fail(res, 500, err.message)
  }
})

// ─── Categories (derived) ────────────────────────────────────
app.get('/api/categories', async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT DISTINCT category
      FROM products
      WHERE category IS NOT NULL AND category <> ''
      ORDER BY category
    `)
    const data = rows.map((r) => ({ id: r.category, name: r.category }))
    return ok(res, { data })
  } catch (err) {
    return fail(res, 500, err.message)
  }
})

// ─── Products ────────────────────────────────────────────────
app.get('/api/products', async (req, res) => {
  try {
    const { search, category } = req.query
    const params = []
    let where = '1=1'

    if (search) {
      where += ' AND (p.name LIKE ? OR p.sku LIKE ?)'
      params.push(`%${search}%`, `%${search}%`)
    }
    if (category) {
      where += ' AND p.category = ?'
      params.push(category)
    }

    const [rows] = await pool.query(
      `SELECT p.*, COALESCE(SUM(sl.qty), 0) AS current_stock
       FROM products p
       LEFT JOIN stock_ledger sl ON sl.product_id = p.id
       WHERE ${where}
       GROUP BY p.id
       ORDER BY p.name`,
      params
    )
    const data = rows.map((r) => ({
      ...r,
      current_stock: Number(r.current_stock),
    }))
    return ok(res, { data })
  } catch (err) {
    return fail(res, 500, err.message)
  }
})

app.get('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params
    const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [id])
    if (!rows[0]) return fail(res, 404, 'Product not found')

    const [stockRows] = await pool.query(`
      SELECT sl.qty, l.id AS location_id, l.name AS location_name, w.name AS warehouse_name
      FROM stock_ledger sl
      JOIN locations l ON l.id = sl.location_id
      LEFT JOIN warehouses w ON w.id = l.warehouse_id
      WHERE sl.product_id = ?
      ORDER BY w.name, l.name
    `, [id])

    const stock = stockRows.map((s) => ({ ...s, qty: Number(s.qty) }))
    return ok(res, { data: rows[0], stock })
  } catch (err) {
    return fail(res, 500, err.message)
  }
})

app.post('/api/products', async (req, res) => {
  const conn = await pool.getConnection()
  try {
    const {
      name,
      sku,
      category,
      uom,
      cost_price,
      low_stock_threshold,
      reorder_qty,
      created_by,
      initial_stock,
      initial_location_id,
    } = req.body

    if (!name || !sku) return fail(res, 400, 'Name and SKU are required')

    if (Number(initial_stock) > 0 && !initial_location_id) {
      return fail(res, 400, 'Initial stock location is required when initial_stock > 0')
    }

    await conn.beginTransaction()
    const [result] = await conn.query(
      `INSERT INTO products (name, sku, category, uom, cost_price, low_stock_threshold, reorder_qty, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        sku,
        category || null,
        uom || 'units',
        cost_price ?? 0,
        low_stock_threshold ?? 10,
        reorder_qty ?? 50,
        created_by || null,
      ]
    )

    const productId = result.insertId

    if (Number(initial_stock) > 0 && initial_location_id) {
      await setStock(conn, productId, initial_location_id, Number(initial_stock))
    }

    await conn.commit()
    const [rows] = await conn.query('SELECT * FROM products WHERE id = ?', [productId])
    return ok(res, { data: rows[0] })
  } catch (err) {
    await conn.rollback()
    return fail(res, 500, err.message)
  } finally {
    conn.release()
  }
})

app.put('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params
    const {
      name,
      sku,
      category,
      uom,
      cost_price,
      low_stock_threshold,
      reorder_qty,
    } = req.body

    await pool.query(
      `UPDATE products
       SET name = ?, sku = ?, category = ?, uom = ?, cost_price = ?, low_stock_threshold = ?, reorder_qty = ?
       WHERE id = ?`,
      [
        name,
        sku,
        category || null,
        uom || 'units',
        cost_price ?? 0,
        low_stock_threshold ?? 10,
        reorder_qty ?? 50,
        id,
      ]
    )

    const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [id])
    return ok(res, { data: rows[0] })
  } catch (err) {
    return fail(res, 500, err.message)
  }
})

app.delete('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params
    await pool.query('DELETE FROM products WHERE id = ?', [id])
    return ok(res, { ok: true })
  } catch (err) {
    return fail(res, 500, err.message)
  }
})

// ─── Stock lookup ────────────────────────────────────────────
app.get('/api/stock', async (req, res) => {
  try {
    const { product_id, location_id } = req.query
    if (!product_id || !location_id) return fail(res, 400, 'product_id and location_id are required')
    const [rows] = await pool.query(
      'SELECT qty FROM stock_ledger WHERE product_id = ? AND location_id = ? LIMIT 1',
      [product_id, location_id]
    )
    return ok(res, { qty: rows[0] ? Number(rows[0].qty) : 0 })
  } catch (err) {
    return fail(res, 500, err.message)
  }
})

// ─── Operations (stock_moves grouped by ref) ─────────────────
app.get('/api/operations', async (req, res) => {
  try {
    const { type, status, search, warehouse_id, limit } = req.query
    if (!type) return fail(res, 400, 'type is required')

    const params = [type]
    let where = 'sm.type = ?'

    if (status) {
      where += ' AND sm.status = ?'
      params.push(status)
    }
    if (search) {
      where += ' AND sm.ref LIKE ?'
      params.push(`%${search}%`)
    }
    if (warehouse_id) {
      where += ` AND (
        sm.from_location_id IN (SELECT id FROM locations WHERE warehouse_id = ?)
        OR sm.to_location_id IN (SELECT id FROM locations WHERE warehouse_id = ?)
      )`
      params.push(warehouse_id, warehouse_id)
    }

    const [rows] = await pool.query(
      `SELECT sm.ref, sm.type, sm.status, sm.supplier, sm.customer,
              sm.from_location_id, sm.to_location_id, MIN(sm.created_at) AS created_at
       FROM stock_moves sm
       WHERE ${where}
       GROUP BY sm.ref, sm.type, sm.status, sm.supplier, sm.customer, sm.from_location_id, sm.to_location_id
       ORDER BY created_at DESC
       ${limit ? 'LIMIT ' + Number(limit) : ''}`,
      params
    )

    const data = rows.map((r) => ({
      id: r.ref,
      reference: r.ref,
      type: r.type,
      status: r.status,
      supplier: r.supplier,
      customer: r.customer,
      from_location_id: r.from_location_id,
      to_location_id: r.to_location_id,
      created_at: r.created_at,
    }))

    return ok(res, { data })
  } catch (err) {
    return fail(res, 500, err.message)
  }
})

app.get('/api/operations/:ref', async (req, res) => {
  try {
    const { ref } = req.params
    const [rows] = await pool.query(`
      SELECT sm.*, p.name AS product_name
      FROM stock_moves sm
      JOIN products p ON p.id = sm.product_id
      WHERE sm.ref = ?
      ORDER BY sm.id
    `, [ref])

    if (!rows.length) return fail(res, 404, 'Operation not found')

    const header = {
      ref: rows[0].ref,
      type: rows[0].type,
      status: rows[0].status,
      supplier: rows[0].supplier,
      customer: rows[0].customer,
      from_location_id: rows[0].from_location_id,
      to_location_id: rows[0].to_location_id,
      created_at: rows[0].created_at,
    }

    const items = rows.map((r) => ({
      id: r.id,
      product_id: r.product_id,
      product_name: r.product_name,
      qty: Number(r.qty),
    }))

    return ok(res, { header, items })
  } catch (err) {
    return fail(res, 500, err.message)
  }
})

app.post('/api/operations', async (req, res) => {
  const conn = await pool.getConnection()
  try {
    const {
      type,
      ref,
      status,
      supplier,
      customer,
      from_location_id,
      to_location_id,
      notes,
      created_by,
      items,
    } = req.body

    if (!type || !ref) return fail(res, 400, 'type and ref are required')
    if (!Array.isArray(items) || items.length === 0) return fail(res, 400, 'items are required')

    await conn.beginTransaction()
    for (const item of items) {
      if (!item.product_id || !item.qty) continue
      await conn.query(
        `INSERT INTO stock_moves
         (ref, type, status, product_id, from_location_id, to_location_id, qty, supplier, customer, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ref,
          type,
          status || 'draft',
          item.product_id,
          from_location_id || null,
          to_location_id || null,
          Number(item.qty),
          supplier || null,
          customer || null,
          notes || null,
          created_by || null,
        ]
      )
    }
    await conn.commit()
    return ok(res, { ok: true })
  } catch (err) {
    await conn.rollback()
    return fail(res, 500, err.message)
  } finally {
    conn.release()
  }
})

app.put('/api/operations/:ref', async (req, res) => {
  const conn = await pool.getConnection()
  try {
    const { ref } = req.params
    const {
      type,
      status,
      supplier,
      customer,
      from_location_id,
      to_location_id,
      notes,
      created_by,
      items,
    } = req.body

    if (!type) return fail(res, 400, 'type is required')
    if (!Array.isArray(items) || items.length === 0) return fail(res, 400, 'items are required')

    await conn.beginTransaction()
    await conn.query('DELETE FROM stock_moves WHERE ref = ?', [ref])

    for (const item of items) {
      if (!item.product_id || !item.qty) continue
      await conn.query(
        `INSERT INTO stock_moves
         (ref, type, status, product_id, from_location_id, to_location_id, qty, supplier, customer, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ref,
          type,
          status || 'draft',
          item.product_id,
          from_location_id || null,
          to_location_id || null,
          Number(item.qty),
          supplier || null,
          customer || null,
          notes || null,
          created_by || null,
        ]
      )
    }

    await conn.commit()
    return ok(res, { ok: true })
  } catch (err) {
    await conn.rollback()
    return fail(res, 500, err.message)
  } finally {
    conn.release()
  }
})

app.post('/api/operations/:ref/validate', async (req, res) => {
  const conn = await pool.getConnection()
  try {
    const { ref } = req.params
    const [rows] = await conn.query('SELECT * FROM stock_moves WHERE ref = ?', [ref])
    if (!rows.length) return fail(res, 404, 'Operation not found')

    const type = rows[0].type

    await conn.beginTransaction()
    if (type === 'receipt') {
      for (const row of rows) {
        if (!row.to_location_id) throw new Error('to_location_id is required for receipt')
        const current = await getStock(conn, row.product_id, row.to_location_id)
        await setStock(conn, row.product_id, row.to_location_id, current + Number(row.qty))
      }
    } else if (type === 'delivery') {
      for (const row of rows) {
        if (!row.from_location_id) throw new Error('from_location_id is required for delivery')
        const current = await getStock(conn, row.product_id, row.from_location_id)
        const next = current - Number(row.qty)
        if (next < 0) throw new Error('Insufficient stock')
        await setStock(conn, row.product_id, row.from_location_id, next)
      }
    } else if (type === 'transfer') {
      for (const row of rows) {
        if (!row.from_location_id || !row.to_location_id) throw new Error('Both locations are required for transfer')
        const current = await getStock(conn, row.product_id, row.from_location_id)
        const next = current - Number(row.qty)
        if (next < 0) throw new Error('Insufficient stock')
        await setStock(conn, row.product_id, row.from_location_id, next)
        const destCurrent = await getStock(conn, row.product_id, row.to_location_id)
        await setStock(conn, row.product_id, row.to_location_id, destCurrent + Number(row.qty))
      }
    }

    await conn.query(
      'UPDATE stock_moves SET status = ?, validated_at = CURRENT_TIMESTAMP WHERE ref = ?',
      ['done', ref]
    )
    await conn.commit()

    return ok(res, { ok: true })
  } catch (err) {
    await conn.rollback()
    return fail(res, 400, err.message)
  } finally {
    conn.release()
  }
})

app.post('/api/operations/:ref/cancel', async (req, res) => {
  try {
    const { ref } = req.params
    await pool.query('UPDATE stock_moves SET status = ? WHERE ref = ?', ['canceled', ref])
    return ok(res, { ok: true })
  } catch (err) {
    return fail(res, 500, err.message)
  }
})

// ─── Adjustments ─────────────────────────────────────────────
app.post('/api/adjustments', async (req, res) => {
  const conn = await pool.getConnection()
  try {
    const { product_id, location_id, counted_qty, created_by } = req.body
    if (!product_id || !location_id) return fail(res, 400, 'product_id and location_id are required')

    const system_qty = await getStock(conn, product_id, location_id)
    const diff = Number(counted_qty) - system_qty

    if (!Number.isFinite(diff)) return fail(res, 400, 'counted_qty is required')

    await conn.beginTransaction()
    await setStock(conn, product_id, location_id, Number(counted_qty))

    if (diff !== 0) {
      const ref = makeRef('ADJ')
      await conn.query(
        `INSERT INTO stock_moves
         (ref, type, status, product_id, from_location_id, to_location_id, qty, notes, created_by, validated_at)
         VALUES (?, 'adjustment', 'done', ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          ref,
          product_id,
          diff < 0 ? location_id : null,
          diff > 0 ? location_id : null,
          Math.abs(diff),
          `Adjusted from ${system_qty} to ${Number(counted_qty)}`,
          created_by || null,
        ]
      )
    }

    await conn.commit()
    return ok(res, { ok: true, diff, system_qty })
  } catch (err) {
    await conn.rollback()
    return fail(res, 500, err.message)
  } finally {
    conn.release()
  }
})

// ─── History ────────────────────────────────────────────────
app.get('/api/history', async (req, res) => {
  try {
    const { type } = req.query
    const params = []
    let where = '1=1'
    if (type) {
      where = 'sm.type = ?'
      params.push(type)
    }

    const [rows] = await pool.query(
      `SELECT sm.id, sm.ref, sm.type, sm.qty, sm.from_location_id, sm.to_location_id, sm.created_at,
              p.name AS product_name,
              lf.name AS from_location_name,
              lt.name AS to_location_name
       FROM stock_moves sm
       JOIN products p ON p.id = sm.product_id
       LEFT JOIN locations lf ON lf.id = sm.from_location_id
       LEFT JOIN locations lt ON lt.id = sm.to_location_id
       WHERE ${where}
       ORDER BY sm.created_at DESC
       LIMIT 200`,
      params
    )

    const data = rows.map((r) => {
      const qty = Number(r.qty)
      const quantity_change = r.type === 'delivery'
        ? -qty
        : r.type === 'adjustment' && r.from_location_id
          ? -qty
          : qty

      const location_name = r.type === 'transfer'
        ? `${r.from_location_name ?? '—'} → ${r.to_location_name ?? '—'}`
        : (r.to_location_name || r.from_location_name || '—')

      return {
        id: r.id,
        reference_id: r.ref,
        type: r.type,
        quantity_change,
        created_at: r.created_at,
        product_name: r.product_name,
        location_name,
      }
    })

    return ok(res, { data })
  } catch (err) {
    return fail(res, 500, err.message)
  }
})

// ─── Dashboard ───────────────────────────────────────────────
app.get('/api/dashboard', async (_req, res) => {
  try {
    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM products')

    const [[{ lowStock }]] = await pool.query(`
      SELECT COUNT(*) AS lowStock
      FROM (
        SELECT p.id, p.low_stock_threshold, COALESCE(SUM(sl.qty), 0) AS stock
        FROM products p
        LEFT JOIN stock_ledger sl ON sl.product_id = p.id
        GROUP BY p.id
      ) t
      WHERE t.low_stock_threshold > 0 AND t.stock <= t.low_stock_threshold
    `)

    const [[{ outOfStock }]] = await pool.query(`
      SELECT COUNT(*) AS outOfStock
      FROM (
        SELECT p.id, COALESCE(SUM(sl.qty), 0) AS stock
        FROM products p
        LEFT JOIN stock_ledger sl ON sl.product_id = p.id
        GROUP BY p.id
      ) t
      WHERE t.stock = 0
    `)

    const [[{ pendingReceipts }]] = await pool.query(`
      SELECT COUNT(DISTINCT ref) AS pendingReceipts
      FROM stock_moves
      WHERE type = 'receipt' AND status IN ('draft', 'waiting', 'ready')
    `)

    const [[{ pendingDeliveries }]] = await pool.query(`
      SELECT COUNT(DISTINCT ref) AS pendingDeliveries
      FROM stock_moves
      WHERE type = 'delivery' AND status IN ('draft', 'waiting', 'ready')
    `)

    const [recent] = await pool.query(`
      SELECT ref, type, status, MIN(created_at) AS created_at
      FROM stock_moves
      WHERE type IN ('receipt', 'delivery')
      GROUP BY ref, type, status
      ORDER BY created_at DESC
      LIMIT 8
    `)

    const recentData = recent.map((r) => ({
      id: r.ref,
      reference: r.ref,
      status: r.status,
      type: r.type === 'receipt' ? 'Receipt' : 'Delivery',
      created_at: r.created_at,
    }))

    return ok(res, {
      kpis: { total, lowStock, outOfStock, pendingReceipts, pendingDeliveries },
      recent: recentData,
    })
  } catch (err) {
    return fail(res, 500, err.message)
  }
})

// ─── Bootstrap ───────────────────────────────────────────────
app.get('/api/bootstrap', async (_req, res) => {
  try {
    const [warehouses] = await pool.query('SELECT * FROM warehouses ORDER BY name')
    const [locations] = await pool.query(`
      SELECT l.*, w.name AS warehouse_name
      FROM locations l
      LEFT JOIN warehouses w ON w.id = l.warehouse_id
      ORDER BY l.name
    `)
    const [products] = await pool.query(
      `SELECT p.*, COALESCE(SUM(sl.qty), 0) AS current_stock
       FROM products p
       LEFT JOIN stock_ledger sl ON sl.product_id = p.id
       GROUP BY p.id
       ORDER BY p.name`
    )
    const [cats] = await pool.query(`
      SELECT DISTINCT category FROM products
      WHERE category IS NOT NULL AND category <> ''
      ORDER BY category
    `)

    return ok(res, {
      warehouses,
      locations,
      products: products.map((p) => ({ ...p, current_stock: Number(p.current_stock) })),
      categories: cats.map((c) => ({ id: c.category, name: c.category })),
    })
  } catch (err) {
    return fail(res, 500, err.message)
  }
})

const PORT = Number(process.env.PORT || 4000)

async function start() {
  try {
    await ensureAuthTables()
    app.listen(PORT, () => {
      console.log(`API running on http://localhost:${PORT}`)
    })
  } catch (err) {
    console.error('Failed to start API:', err)
    process.exit(1)
  }
}

start()
