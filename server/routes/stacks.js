import express from 'express'
import pool from '../db.js'
import { requireRole } from '../middleware/auth.js'
import { ok } from '../utils/http.js'
import AppError from '../utils/AppError.js'
import { makeRef } from '../utils/refGenerator.js'
import { computeNextDueAt, toDateOnly } from '../services/startupService.js'

const router = express.Router()

router.get('/stacks', async (_req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        s.id,
        s.name,
        s.description,
        s.frequency,
        s.to_location_id,
        s.created_by,
        s.last_executed_at,
        s.next_due_at,
        s.created_at,
        l.name AS to_location_name,
        COUNT(osi.id) AS item_count,
        COALESCE(SUM(
          CASE
            WHEN p.id IS NULL THEN 0
            WHEN COALESCE(sl.qty, 0) <= COALESCE(p.low_stock_threshold, 0) THEN 1
            ELSE 0
          END
        ), 0) AS low_item_count
      FROM order_stacks s
      LEFT JOIN locations l ON l.id = s.to_location_id
      LEFT JOIN order_stack_items osi ON osi.stack_id = s.id
      LEFT JOIN products p ON p.id = osi.product_id
      LEFT JOIN stock_ledger sl ON sl.product_id = osi.product_id AND sl.location_id = s.to_location_id
      GROUP BY
        s.id,
        s.name,
        s.description,
        s.frequency,
        s.to_location_id,
        s.created_by,
        s.last_executed_at,
        s.next_due_at,
        s.created_at,
        l.name
      ORDER BY s.created_at DESC
    `)

    const today = new Date()
    const data = rows.map((r) => {
      const nextDueDate = r.next_due_at ? new Date(r.next_due_at) : null
      const overdueDays = nextDueDate ? Math.floor((today - nextDueDate) / (1000 * 60 * 60 * 24)) : null
      return {
        ...r,
        item_count: Number(r.item_count || 0),
        low_item_count: Number(r.low_item_count || 0),
        is_overdue: overdueDays !== null && overdueDays > 0,
        overdue_days: overdueDays !== null && overdueDays > 0 ? overdueDays : 0,
      }
    })
    return ok(res, { data })
  } catch (err) {
    return next(err)
  }
})

router.get('/stacks/due', async (req, res, next) => {
  try {
    const days = Math.max(1, Number(req.query.days || 3))
    const [rows] = await pool.query(
      `
      SELECT s.id, s.name, s.frequency, s.next_due_at, l.name AS location_name
      FROM order_stacks s
      LEFT JOIN locations l ON l.id = s.to_location_id
      WHERE s.next_due_at IS NOT NULL
        AND s.next_due_at <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
      ORDER BY s.next_due_at ASC
      `,
      [days]
    )

    const today = new Date()
    const data = rows.map((r) => {
      const due = new Date(r.next_due_at)
      const diff = Math.floor((today - due) / (1000 * 60 * 60 * 24))
      return {
        ...r,
        is_overdue: diff > 0,
        overdue_days: diff > 0 ? diff : 0,
      }
    })
    return ok(res, { data })
  } catch (err) {
    return next(err)
  }
})

router.get('/stacks/due/count', async (_req, res, next) => {
  try {
    const [[row]] = await pool.query(`
      SELECT COUNT(*) AS count
      FROM order_stacks
      WHERE next_due_at IS NOT NULL
        AND next_due_at <= CURDATE()
    `)
    return ok(res, { data: Number(row?.count || 0) })
  } catch (err) {
    return next(err)
  }
})

router.get('/stacks/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const [headRows] = await pool.query(
      `
      SELECT s.*, l.name AS to_location_name
      FROM order_stacks s
      LEFT JOIN locations l ON l.id = s.to_location_id
      WHERE s.id = ?
      LIMIT 1
      `,
      [id]
    )
    const stack = headRows[0]
    if (!stack) throw new AppError('Stack not found', 404)

    const [itemRows] = await pool.query(
      `
      SELECT
        osi.*,
        p.name AS product_name,
        p.sku,
        p.low_stock_threshold,
        COALESCE(sl.qty, 0) AS current_stock
      FROM order_stack_items osi
      JOIN products p ON p.id = osi.product_id
      LEFT JOIN stock_ledger sl ON sl.product_id = osi.product_id AND sl.location_id = ?
      WHERE osi.stack_id = ?
      ORDER BY osi.sort_order, osi.id
      `,
      [stack.to_location_id, id]
    )

    const items = itemRows.map((r) => ({
      ...r,
      qty: Number(r.qty),
      current_stock: Number(r.current_stock),
      is_low_stock: Number(r.current_stock) <= Number(r.low_stock_threshold || 0),
    }))
    return ok(res, { data: stack, items })
  } catch (err) {
    return next(err)
  }
})

router.post('/stacks', requireRole('manager'), async (req, res, next) => {
  const conn = await pool.getConnection()
  try {
    const {
      name,
      description,
      frequency = 'monthly',
      to_location_id,
      next_due_at,
      items = [],
    } = req.body

    if (!name || !to_location_id) throw new AppError('name and to_location_id are required', 400)
    if (!Array.isArray(items) || items.length === 0) throw new AppError('At least one stack item is required', 400)

    await conn.beginTransaction()
    const [result] = await conn.query(
      `INSERT INTO order_stacks (name, description, frequency, to_location_id, created_by, next_due_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        String(name).trim(),
        description || null,
        ['daily', 'weekly', 'monthly', 'custom'].includes(frequency) ? frequency : 'monthly',
        Number(to_location_id),
        req.user.id,
        next_due_at || computeNextDueAt(new Date(), frequency),
      ]
    )

    const stackId = result.insertId
    let order = 1
    for (const item of items) {
      if (!item.product_id || !item.qty || Number(item.qty) <= 0) continue
      await conn.query(
        `INSERT INTO order_stack_items (stack_id, product_id, qty, supplier, sort_order)
         VALUES (?, ?, ?, ?, ?)`,
        [stackId, item.product_id, Number(item.qty), item.supplier || null, order++]
      )
    }
    await conn.commit()
    return ok(res, { id: stackId })
  } catch (err) {
    await conn.rollback()
    return next(err)
  } finally {
    conn.release()
  }
})

router.put('/stacks/:id', requireRole('manager'), async (req, res, next) => {
  const conn = await pool.getConnection()
  try {
    const { id } = req.params
    const {
      name,
      description,
      frequency = 'monthly',
      to_location_id,
      next_due_at,
      items = [],
    } = req.body

    if (!name || !to_location_id) throw new AppError('name and to_location_id are required', 400)
    if (!Array.isArray(items) || items.length === 0) throw new AppError('At least one stack item is required', 400)

    await conn.beginTransaction()
    await conn.query(
      `UPDATE order_stacks
       SET name = ?, description = ?, frequency = ?, to_location_id = ?, next_due_at = ?
       WHERE id = ?`,
      [
        String(name).trim(),
        description || null,
        ['daily', 'weekly', 'monthly', 'custom'].includes(frequency) ? frequency : 'monthly',
        Number(to_location_id),
        next_due_at || null,
        id,
      ]
    )
    await conn.query('DELETE FROM order_stack_items WHERE stack_id = ?', [id])
    let order = 1
    for (const item of items) {
      if (!item.product_id || !item.qty || Number(item.qty) <= 0) continue
      await conn.query(
        `INSERT INTO order_stack_items (stack_id, product_id, qty, supplier, sort_order)
         VALUES (?, ?, ?, ?, ?)`,
        [id, item.product_id, Number(item.qty), item.supplier || null, order++]
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

router.delete('/stacks/:id', requireRole('manager'), async (req, res, next) => {
  const conn = await pool.getConnection()
  try {
    const { id } = req.params
    const [rows] = await conn.query('SELECT id FROM order_stacks WHERE id = ? LIMIT 1', [id])
    if (!rows[0]) throw new AppError('Stack not found', 404)

    await conn.beginTransaction()
    await conn.query('DELETE FROM stack_executions WHERE stack_id = ?', [id])
    await conn.query('DELETE FROM order_stack_items WHERE stack_id = ?', [id])
    await conn.query('DELETE FROM order_stacks WHERE id = ?', [id])
    await conn.commit()

    return ok(res, { ok: true })
  } catch (err) {
    try { await conn.rollback() } catch {}
    return next(err)
  } finally {
    conn.release()
  }
})

router.post('/stacks/:id/execute', async (req, res, next) => {
  const conn = await pool.getConnection()
  try {
    const { id } = req.params
    const [stackRows] = await conn.query('SELECT * FROM order_stacks WHERE id = ? LIMIT 1', [id])
    if (!stackRows[0]) throw new AppError('Stack not found', 404)
    const stack = stackRows[0]
    const [items] = await conn.query(
      'SELECT * FROM order_stack_items WHERE stack_id = ? ORDER BY sort_order, id',
      [id]
    )
    if (!items.length) throw new AppError('Stack has no items', 400)

    await conn.beginTransaction()
    const refs = []
    for (const item of items) {
      const ref = makeRef('REC')
      refs.push(ref)
      const [moveResult] = await conn.query(
        `INSERT INTO stock_moves
         (ref, type, status, product_id, to_location_id, qty, supplier, notes, created_by)
         VALUES (?, 'receipt', 'draft', ?, ?, ?, ?, ?, ?)`,
        [
          ref,
          item.product_id,
          stack.to_location_id,
          Number(item.qty),
          item.supplier || null,
          `Generated by Smart Stack: ${stack.name}`,
          req.user.id,
        ]
      )
      await conn.query(
        `INSERT INTO stack_executions (stack_id, stock_move_id, executed_by)
         VALUES (?, ?, ?)`,
        [id, moveResult.insertId, req.user.id]
      )
    }

    const today = toDateOnly(new Date())
    const nextDue = computeNextDueAt(today, stack.frequency)
    await conn.query(
      'UPDATE order_stacks SET last_executed_at = ?, next_due_at = ? WHERE id = ?',
      [today, nextDue, id]
    )

    await conn.commit()
    return ok(res, { ok: true, refs, count: refs.length, next_due_at: nextDue })
  } catch (err) {
    await conn.rollback()
    return next(err)
  } finally {
    conn.release()
  }
})

export default router
