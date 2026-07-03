import jwt from 'jsonwebtoken'
import AppError from '../utils/AppError.js'

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-env'

export const authenticateToken = (req, _res, next) => {
  const auth = req.headers.authorization || ''
  if (!auth.startsWith('Bearer ')) {
    return next(new AppError('Unauthorized', 401))
  }

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
    return next(new AppError('Invalid or expired session', 401))
  }
}

export const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user) return next(new AppError('Unauthorized', 401))
  if (!roles.includes(req.user.role)) return next(new AppError('Forbidden', 403))
  return next()
}
