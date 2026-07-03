import express from 'express'
import pool from '../db.js'
import knex from '../db/knex.js'
import { ok } from '../utils/http.js'
import { getHealthScoreBreakdown } from '../services/healthScore.js'
import { getStockoutRisk } from '../services/prediction.js'

const router = express.Router()
const STOCKOUT_WINDOW_DAYS = Number(process.env.STOCKOUT_WINDOW_DAYS || 30)

router.get('/analytics/stockout-risk', async (req, res, next) => {
  try {
    const warehouseId = req.query.warehouse_id ? Number(req.query.warehouse_id) : null
    const windowDays = Math.max(7, Number(req.query.window_days || STOCKOUT_WINDOW_DAYS))
    const data = await getStockoutRisk({ warehouseId, windowDays })
    return ok(res, { data })
  } catch (err) {
    return next(err)
  }
})

router.get('/analytics/health-score', async (_req, res, next) => {
  try {
    return ok(res, { data: await getHealthScoreBreakdown() })
  } catch (err) {
    return next(err)
  }
})

router.get('/analytics/supplier-reliability', async (_req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        supplier,
        ROUND(SUM(CASE WHEN status <> 'canceled' THEN qty ELSE 0 END), 2) AS promised_qty,
        ROUND(SUM(CASE WHEN status = 'done' THEN qty ELSE 0 END), 2) AS received_qty
      FROM stock_moves
      WHERE type = 'receipt'
        AND supplier IS NOT NULL
        AND supplier <> ''
      GROUP BY supplier
      ORDER BY supplier ASC
    `)

    const data = rows.map((r) => {
      const promised = Number(r.promised_qty || 0)
      const received = Number(r.received_qty || 0)
      const reliability = promised > 0 ? Math.round((received / promised) * 1000) / 10 : 100
      return {
        supplier: r.supplier,
        promised_qty: promised,
        received_qty: received,
        reliability,
      }
    })
    return ok(res, { data })
  } catch (err) {
    return next(err)
  }
})

router.get('/dashboard', async (_req, res, next) => {
  try {
    const totalRow = await knex('products').count({ total: 'id' }).first()
    const total = Number(totalRow?.total || 0)

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

    const [stockoutRows] = await pool.query(`
      SELECT
        p.name,
        CASE
          WHEN cons.avg_daily_qty > 0 THEN ROUND(COALESCE(st.current_stock, 0) / cons.avg_daily_qty, 1)
          ELSE NULL
        END AS days_remaining
      FROM products p
      LEFT JOIN (
        SELECT product_id, SUM(qty) AS current_stock
        FROM stock_ledger
        GROUP BY product_id
      ) st ON st.product_id = p.id
      LEFT JOIN (
        SELECT product_id, ROUND(SUM(qty_out) / ?, 4) AS avg_daily_qty
        FROM consumption_events
        WHERE move_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        GROUP BY product_id
      ) cons ON cons.product_id = p.id
      WHERE cons.avg_daily_qty > 0
      ORDER BY days_remaining ASC
      LIMIT 3
    `, [STOCKOUT_WINDOW_DAYS, STOCKOUT_WINDOW_DAYS])

    const [[dueStacksRow]] = await pool.query(`
      SELECT COUNT(*) AS due_count
      FROM order_stacks
      WHERE next_due_at IS NOT NULL AND next_due_at <= CURDATE()
    `)

    const health = await getHealthScoreBreakdown()
    const dueStacks = Number(dueStacksRow?.due_count || 0)

    return ok(res, {
      kpis: {
        total,
        lowStock,
        outOfStock,
        pendingReceipts,
        pendingDeliveries,
        healthScore: health.health_score,
        dueStacks,
      },
      healthScore: health.health_score,
      dueStacks,
      stockoutRisk: stockoutRows.map((r) => ({
        name: r.name,
        days_remaining: Number(r.days_remaining),
      })),
      recent: recentData,
    })
  } catch (err) {
    return next(err)
  }
})

export default router
