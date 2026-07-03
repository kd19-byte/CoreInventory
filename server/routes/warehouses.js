import express from 'express'
import { body } from 'express-validator'
import pool from '../db.js'
import { requireRole } from '../middleware/auth.js'
import { validateRequest } from '../middleware/validate.js'
import { ok } from '../utils/http.js'
import AppError from '../utils/AppError.js'

const router = express.Router()

router.get('/warehouses', async (_req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM warehouses ORDER BY name')
    return ok(res, { data: rows })
  } catch (err) {
    return next(err)
  }
})

router.post(
  '/warehouses',
  requireRole('manager'),
  body('name').trim().notEmpty().withMessage('Name is required'),
  validateRequest,
  async (req, res, next) => {
    try {
      const { name, address, created_by } = req.body
      const [result] = await pool.query(
        'INSERT INTO warehouses (name, address, created_by) VALUES (?, ?, ?)',
        [name, address || null, created_by || null]
      )
      const [rows] = await pool.query('SELECT * FROM warehouses WHERE id = ?', [result.insertId])
      return ok(res, { data: rows[0] })
    } catch (err) {
      return next(err)
    }
  }
)

router.put('/warehouses/:id', requireRole('manager'), async (req, res, next) => {
  try {
    const { id } = req.params
    const { name, address } = req.body
    await pool.query('UPDATE warehouses SET name = ?, address = ? WHERE id = ?', [name, address || null, id])
    const [rows] = await pool.query('SELECT * FROM warehouses WHERE id = ?', [id])
    return ok(res, { data: rows[0] })
  } catch (err) {
    return next(err)
  }
})

router.delete('/warehouses/:id', requireRole('manager'), async (req, res, next) => {
  try {
    const { id } = req.params
    await pool.query('DELETE FROM warehouses WHERE id = ?', [id])
    return ok(res, { ok: true })
  } catch (err) {
    return next(err)
  }
})

router.get('/locations', async (_req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT l.*, w.name AS warehouse_name
      FROM locations l
      LEFT JOIN warehouses w ON w.id = l.warehouse_id
      ORDER BY l.name
    `)
    return ok(res, { data: rows })
  } catch (err) {
    return next(err)
  }
})

router.post(
  '/locations',
  requireRole('manager'),
  body('name').trim().notEmpty().withMessage('Name is required'),
  validateRequest,
  async (req, res, next) => {
    try {
      const { name, warehouse_id, type } = req.body
      const [result] = await pool.query(
        'INSERT INTO locations (name, warehouse_id, type) VALUES (?, ?, ?)',
        [name, warehouse_id || null, type || 'internal']
      )
      const [rows] = await pool.query(
        `
      SELECT l.*, w.name AS warehouse_name
      FROM locations l
      LEFT JOIN warehouses w ON w.id = l.warehouse_id
      WHERE l.id = ?
    `,
        [result.insertId]
      )
      return ok(res, { data: rows[0] })
    } catch (err) {
      return next(err)
    }
  }
)

router.put('/locations/:id', requireRole('manager'), async (req, res, next) => {
  try {
    const { id } = req.params
    const { name, warehouse_id, type } = req.body
    await pool.query(
      'UPDATE locations SET name = ?, warehouse_id = ?, type = ? WHERE id = ?',
      [name, warehouse_id || null, type || 'internal', id]
    )
    const [rows] = await pool.query(
      `
      SELECT l.*, w.name AS warehouse_name
      FROM locations l
      LEFT JOIN warehouses w ON w.id = l.warehouse_id
      WHERE l.id = ?
    `,
      [id]
    )
    return ok(res, { data: rows[0] })
  } catch (err) {
    return next(err)
  }
})

router.delete('/locations/:id', requireRole('manager'), async (req, res, next) => {
  try {
    const { id } = req.params
    await pool.query('DELETE FROM locations WHERE id = ?', [id])
    return ok(res, { ok: true })
  } catch (err) {
    return next(err)
  }
})

router.get('/bootstrap', async (_req, res, next) => {
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
    return next(err)
  }
})

router.get('/categories', async (_req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT DISTINCT category
      FROM products
      WHERE category IS NOT NULL AND category <> ''
      ORDER BY category
    `)
    return ok(res, { data: rows.map((r) => ({ id: r.category, name: r.category })) })
  } catch (err) {
    return next(err)
  }
})

router.get('/warehouses/:id', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM warehouses WHERE id = ?', [req.params.id])
    if (!rows[0]) throw new AppError('Warehouse not found', 404)
    return ok(res, { data: rows[0] })
  } catch (err) {
    return next(err)
  }
})

export default router
