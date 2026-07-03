import express from 'express'
import pool from '../db.js'
import { ok } from '../utils/http.js'

const router = express.Router()

router.get('/history', async (req, res, next) => {
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
        ? `${r.from_location_name ?? '—'} -> ${r.to_location_name ?? '—'}`
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
    return next(err)
  }
})

export default router
