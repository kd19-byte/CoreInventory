import express from 'express'
import { body } from 'express-validator'
import pool from '../db.js'
import { ok } from '../utils/http.js'
import AppError from '../utils/AppError.js'
import { validateRequest } from '../middleware/validate.js'
import { setStock } from '../services/stockService.js'

const router = express.Router()
const DEAD_STOCK_DAYS = Number(process.env.DEAD_STOCK_DAYS || 30)

router.get('/products/dead-stock', async (req, res, next) => {
  try {
    const days = Math.max(1, Number(req.query.days || DEAD_STOCK_DAYS))
    const [rows] = await pool.query(
      `
      SELECT
        p.id,
        p.name,
        p.sku,
        p.category,
        COALESCE(st.current_stock, 0) AS current_stock,
        out_moves.last_outgoing_at
      FROM products p
      LEFT JOIN (
        SELECT product_id, SUM(qty) AS current_stock
        FROM stock_ledger
        GROUP BY product_id
      ) st ON st.product_id = p.id
      LEFT JOIN (
        SELECT product_id, MAX(COALESCE(validated_at, created_at)) AS last_outgoing_at
        FROM stock_moves
        WHERE type = 'delivery' AND status = 'done'
        GROUP BY product_id
      ) out_moves ON out_moves.product_id = p.id
      WHERE out_moves.last_outgoing_at IS NULL
         OR out_moves.last_outgoing_at < DATE_SUB(NOW(), INTERVAL ? DAY)
      ORDER BY out_moves.last_outgoing_at ASC, p.name ASC
      `,
      [days]
    )

    const data = rows.map((r) => ({
      ...r,
      current_stock: Number(r.current_stock || 0),
      days_since_outgoing: r.last_outgoing_at
        ? Math.floor((Date.now() - new Date(r.last_outgoing_at).getTime()) / (1000 * 60 * 60 * 24))
        : null,
    }))
    return ok(res, { data })
  } catch (err) {
    return next(err)
  }
})

router.get('/products', async (req, res, next) => {
  try {
    const { search, category, filter, dead_stock_days } = req.query
    const deadDays = Number(dead_stock_days || DEAD_STOCK_DAYS)
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
    if (filter === 'dead') {
      where += `
        AND p.id NOT IN (
          SELECT DISTINCT product_id
          FROM stock_moves
          WHERE type IN ('delivery', 'transfer')
            AND status = 'done'
            AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        )
        AND EXISTS (
          SELECT 1
          FROM stock_ledger sl2
          WHERE sl2.product_id = p.id
            AND sl2.qty > 0
        )
      `
      params.push(deadDays)
    }

    const [rows] = await pool.query(
      `SELECT p.*,
              COALESCE(SUM(sl.qty), 0) AS current_stock,
              out_moves.last_outgoing_at
       FROM products p
       LEFT JOIN stock_ledger sl ON sl.product_id = p.id
       LEFT JOIN (
         SELECT product_id, MAX(COALESCE(validated_at, created_at)) AS last_outgoing_at
         FROM stock_moves
         WHERE type = 'delivery' AND status = 'done'
         GROUP BY product_id
       ) out_moves ON out_moves.product_id = p.id
       WHERE ${where}
       GROUP BY p.id
       ORDER BY p.name`,
      params
    )
    const data = rows.map((r) => ({
      ...r,
      current_stock: Number(r.current_stock),
      days_since_outgoing: r.last_outgoing_at
        ? Math.floor((Date.now() - new Date(r.last_outgoing_at).getTime()) / (1000 * 60 * 60 * 24))
        : null,
      is_dead_stock: !r.last_outgoing_at
        ? true
        : Math.floor((Date.now() - new Date(r.last_outgoing_at).getTime()) / (1000 * 60 * 60 * 24)) >= deadDays,
    }))
    return ok(res, { data })
  } catch (err) {
    return next(err)
  }
})

router.get('/products/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [id])
    if (!rows[0]) throw new AppError('Product not found', 404)

    const [stockRows] = await pool.query(
      `
      SELECT sl.qty, l.id AS location_id, l.name AS location_name, w.name AS warehouse_name
      FROM stock_ledger sl
      JOIN locations l ON l.id = sl.location_id
      LEFT JOIN warehouses w ON w.id = l.warehouse_id
      WHERE sl.product_id = ?
      ORDER BY w.name, l.name
    `,
      [id]
    )

    const stock = stockRows.map((s) => ({ ...s, qty: Number(s.qty) }))
    return ok(res, { data: rows[0], stock })
  } catch (err) {
    return next(err)
  }
})

router.post(
  '/products',
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('sku').trim().notEmpty().withMessage('SKU is required'),
  body('cost_price').optional().isFloat({ min: 0 }).withMessage('Invalid cost price'),
  validateRequest,
  async (req, res, next) => {
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

      if (Number(initial_stock) > 0 && !initial_location_id) {
        throw new AppError('Initial stock location is required when initial_stock > 0', 400)
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
      return next(err)
    } finally {
      conn.release()
    }
  }
)

router.put('/products/:id', async (req, res, next) => {
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
    return next(err)
  }
})

router.delete('/products/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    await pool.query('DELETE FROM products WHERE id = ?', [id])
    return ok(res, { ok: true })
  } catch (err) {
    return next(err)
  }
})

export default router
