import express from 'express'
import pool from '../db.js'
import { ok } from '../utils/http.js'
import AppError from '../utils/AppError.js'

const router = express.Router()

const STOCKOUT_WINDOW_DAYS = Number(process.env.STOCKOUT_WINDOW_DAYS || 30)

router.post('/inventory-insights', async (req, res, next) => {
  try {
    const groqApiKey = process.env.GROQ_API_KEY || ''
    const groqModel = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'
    if (!groqApiKey) throw new AppError('AI service is not configured', 503)

    const question = String(req.body?.question || '').trim() || 'Give me inventory health insights and action items.'
    const normalizedQuestion = question.toLowerCase()

    const [rows] = await pool.query(`
      SELECT
        p.id,
        p.name,
        p.sku,
        p.category,
        p.low_stock_threshold,
        p.reorder_qty,
        COALESCE(SUM(sl.qty), 0) AS current_stock
      FROM products p
      LEFT JOIN stock_ledger sl ON sl.product_id = p.id
      GROUP BY p.id
      ORDER BY p.name
    `)

    const products = rows.map((r) => ({
      id: r.id,
      name: r.name,
      sku: r.sku,
      category: r.category,
      low_stock_threshold: Number(r.low_stock_threshold ?? 0),
      reorder_qty: Number(r.reorder_qty ?? 0),
      current_stock: Number(r.current_stock ?? 0),
    }))

    const lowStock = products.filter((p) => p.low_stock_threshold > 0 && p.current_stock <= p.low_stock_threshold)
    const outOfStock = products.filter((p) => p.current_stock === 0)
    const [riskRows] = await pool.query(
      `
      SELECT
        p.id,
        p.name,
        p.sku,
        COALESCE(st.current_stock, 0) AS current_stock,
        COALESCE(cons.avg_daily_qty, 0) AS avg_daily_qty,
        CASE
          WHEN COALESCE(cons.avg_daily_qty, 0) > 0 THEN ROUND(COALESCE(st.current_stock, 0) / cons.avg_daily_qty, 1)
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
      LIMIT 12
      `,
      [STOCKOUT_WINDOW_DAYS, STOCKOUT_WINDOW_DAYS]
    )

    const atRiskSoon = riskRows
      .filter((r) => Number(r.days_remaining) <= 10)
      .map((r) => ({
        product_id: r.id,
        name: r.name,
        sku: r.sku,
        current_stock: Number(r.current_stock || 0),
        avg_daily_qty: Number(r.avg_daily_qty || 0),
        days_remaining: Number(r.days_remaining),
      }))

    const intent =
      /(out\s*of\s*stock|stockout|run out|reorder|restock|soon)/i.test(normalizedQuestion)
        ? 'stock_risk'
        : 'general'

    const actionMap = new Map()
    for (const p of outOfStock.slice(0, 8)) {
      actionMap.set(`out:${p.id}`, {
        type: 'out_of_stock',
        priority: 'critical',
        product_id: p.id,
        product_name: p.name,
        sku: p.sku,
        current_stock: p.current_stock,
        days_remaining: 0,
        suggested_reorder_qty: p.reorder_qty > 0 ? p.reorder_qty : Math.max(10, p.low_stock_threshold * 2 || 20),
      })
    }
    for (const p of atRiskSoon.slice(0, 8)) {
      if (actionMap.has(`out:${p.product_id}`)) continue
      actionMap.set(`risk:${p.product_id}`, {
        type: 'stockout_risk',
        priority: p.days_remaining <= 4 ? 'critical' : 'warning',
        product_id: p.product_id,
        product_name: p.name,
        sku: p.sku,
        current_stock: p.current_stock,
        days_remaining: p.days_remaining,
        suggested_reorder_qty: Math.max(10, Math.ceil(p.avg_daily_qty * 14)),
      })
    }
    const actions = Array.from(actionMap.values()).slice(0, 8)

    const payload = {
      total_products: products.length,
      low_stock_count: lowStock.length,
      out_of_stock_count: outOfStock.length,
      low_stock_products: lowStock.slice(0, 25),
      out_of_stock_products: outOfStock.slice(0, 25),
      stockout_risk_products: atRiskSoon.slice(0, 25),
      sample_products: products.slice(0, 100),
    }

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: groqModel,
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content:
              'You are an inventory operations copilot. Give concise, practical recommendations with priorities. Mention reorder, stock risk, and operational next steps.',
          },
          {
            role: 'user',
            content: `User role: ${req.user.role}. Question: ${question}\n\nInventory data:\n${JSON.stringify(payload)}`,
          },
        ],
      }),
    })

    const groqData = await groqRes.json()
    if (!groqRes.ok) {
      const message = groqData?.error?.message || 'AI provider error'
      throw new AppError(message, 502)
    }

    const answer = groqData?.choices?.[0]?.message?.content?.trim()
    if (!answer) throw new AppError('AI response was empty', 502)

    return ok(res, { answer, actions, intent })
  } catch (err) {
    return next(err)
  }
})

export default router
