import express from 'express'
import { body } from 'express-validator'
import pool from '../db.js'
import { ok } from '../utils/http.js'
import AppError from '../utils/AppError.js'
import { validateRequest } from '../middleware/validate.js'
import { getStock, setStock, validateOperationByRef } from '../services/stockService.js'
import { makeRef } from '../utils/refGenerator.js'

const router = express.Router()

router.get('/stock', async (req, res, next) => {
  try {
    const { product_id, location_id } = req.query
    if (!product_id || !location_id) throw new AppError('product_id and location_id are required', 400)
    const [rows] = await pool.query(
      'SELECT qty FROM stock_ledger WHERE product_id = ? AND location_id = ? LIMIT 1',
      [product_id, location_id]
    )
    return ok(res, { qty: rows[0] ? Number(rows[0].qty) : 0 })
  } catch (err) {
    return next(err)
  }
})

router.get('/operations', async (req, res, next) => {
  try {
    const { type, status, search, warehouse_id, limit } = req.query
    if (!type) throw new AppError('type is required', 400)

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
    return next(err)
  }
})

router.get('/operations/:ref', async (req, res, next) => {
  try {
    const { ref } = req.params
    const [rows] = await pool.query(
      `
      SELECT sm.*, p.name AS product_name
      FROM stock_moves sm
      JOIN products p ON p.id = sm.product_id
      WHERE sm.ref = ?
      ORDER BY sm.id
    `,
      [ref]
    )

    if (!rows.length) throw new AppError('Operation not found', 404)

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
    return next(err)
  }
})

router.post(
  '/operations',
  body('type').notEmpty().withMessage('type is required'),
  body('ref').notEmpty().withMessage('ref is required'),
  validateRequest,
  async (req, res, next) => {
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

      if (!Array.isArray(items) || items.length === 0) throw new AppError('items are required', 400)

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
      return next(err)
    } finally {
      conn.release()
    }
  }
)

router.put('/operations/:ref', async (req, res, next) => {
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

    if (!type) throw new AppError('type is required', 400)
    if (!Array.isArray(items) || items.length === 0) throw new AppError('items are required', 400)

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
    return next(err)
  } finally {
    conn.release()
  }
})

router.post('/operations/:ref/validate', async (req, res, next) => {
  const conn = await pool.getConnection()
  try {
    const { ref } = req.params

    await conn.beginTransaction()
    await validateOperationByRef(ref, conn)
    await conn.commit()

    return ok(res, { ok: true })
  } catch (err) {
    await conn.rollback()
    return next(err)
  } finally {
    conn.release()
  }
})

router.post('/operations/:ref/cancel', async (req, res, next) => {
  try {
    const { ref } = req.params
    await pool.query('UPDATE stock_moves SET status = ? WHERE ref = ?', ['canceled', ref])
    return ok(res, { ok: true })
  } catch (err) {
    return next(err)
  }
})

router.post('/adjustments', async (req, res, next) => {
  const conn = await pool.getConnection()
  try {
    const { product_id, location_id, counted_qty, created_by } = req.body
    if (!product_id || !location_id) throw new AppError('product_id and location_id are required', 400)

    const system_qty = await getStock(conn, product_id, location_id)
    const diff = Number(counted_qty) - system_qty

    if (!Number.isFinite(diff)) throw new AppError('counted_qty is required', 400)

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
    return next(err)
  } finally {
    conn.release()
  }
})

export default router
