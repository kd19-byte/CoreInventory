import pool from '../db.js'

export async function getHealthScoreBreakdown() {
  const [[productsTotalRow]] = await pool.query('SELECT COUNT(*) AS total FROM products')
  const [[productsAvailableRow]] = await pool.query(`
    SELECT COUNT(*) AS available
    FROM (
      SELECT p.id, COALESCE(SUM(sl.qty), 0) AS stock
      FROM products p
      LEFT JOIN stock_ledger sl ON sl.product_id = p.id
      GROUP BY p.id
    ) t
    WHERE t.stock > 0
  `)
  const [[deliveryTotalsRow]] = await pool.query(`
    SELECT COUNT(DISTINCT ref) AS total_deliveries
    FROM stock_moves
    WHERE type = 'delivery'
      AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      AND status <> 'canceled'
  `)
  const [[deliveryDoneRow]] = await pool.query(`
    SELECT COUNT(DISTINCT ref) AS done_deliveries
    FROM stock_moves
    WHERE type = 'delivery'
      AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      AND status = 'done'
  `)
  const [[adjustmentsRow]] = await pool.query(`
    SELECT COUNT(DISTINCT ref) AS adjustments
    FROM stock_moves
    WHERE type = 'adjustment'
      AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
  `)

  const totalProducts = Number(productsTotalRow.total || 0)
  const availableProducts = Number(productsAvailableRow.available || 0)
  const totalDeliveries = Number(deliveryTotalsRow.total_deliveries || 0)
  const doneDeliveries = Number(deliveryDoneRow.done_deliveries || 0)
  const adjustmentCount = Number(adjustmentsRow.adjustments || 0)

  const stockAvailability = totalProducts > 0
    ? Math.round((availableProducts / totalProducts) * 100)
    : 100
  const fulfillmentRate = totalDeliveries > 0
    ? Math.round((doneDeliveries / totalDeliveries) * 100)
    : 100
  const adjustmentStability = Math.max(0, 100 - adjustmentCount * 8)

  return {
    health_score: Math.round(stockAvailability * 0.4 + fulfillmentRate * 0.35 + adjustmentStability * 0.25),
    stock_availability: stockAvailability,
    fulfillment_rate: fulfillmentRate,
    adjustment_stability: adjustmentStability,
  }
}
