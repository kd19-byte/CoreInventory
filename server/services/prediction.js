import knex from '../db/knex.js'

export async function getStockoutRisk({ warehouseId = null, windowDays = 30 } = {}) {
  const stockSubquery = knex('stock_ledger as sl')
    .modify((q) => {
      if (warehouseId) {
        q.join('locations as lx', 'lx.id', 'sl.location_id').where('lx.warehouse_id', warehouseId)
      }
    })
    .select('sl.product_id')
    .sum({ current_stock: 'sl.qty' })
    .groupBy('sl.product_id')
    .as('stock')

  const consSubquery = knex('consumption_events as ce')
    .modify((q) => {
      if (warehouseId) {
        q.join('locations as lc', 'lc.id', 'ce.location_id').where('lc.warehouse_id', warehouseId)
      }
    })
    .where('ce.move_date', '>=', knex.raw('DATE_SUB(CURDATE(), INTERVAL ? DAY)', [windowDays]))
    .select('ce.product_id')
    .select(knex.raw('ROUND(SUM(ce.qty_out) / ?, 4) as avg_daily_qty', [windowDays]))
    .groupBy('ce.product_id')
    .as('cons')

  const rows = await knex('products as p')
    .leftJoin(stockSubquery, 'stock.product_id', 'p.id')
    .leftJoin(consSubquery, 'cons.product_id', 'p.id')
    .select(
      'p.id',
      'p.name',
      'p.sku',
      knex.raw('COALESCE(stock.current_stock, 0) AS current_stock'),
      knex.raw('COALESCE(cons.avg_daily_qty, 0) AS avg_daily_qty'),
      knex.raw(`
        CASE
          WHEN COALESCE(cons.avg_daily_qty, 0) > 0 THEN ROUND(COALESCE(stock.current_stock, 0) / cons.avg_daily_qty, 1)
          ELSE NULL
        END AS days_remaining
      `)
    )
    .orderByRaw('CASE WHEN cons.avg_daily_qty > 0 THEN 0 ELSE 1 END')
    .orderBy('days_remaining', 'asc')
    .orderBy('p.name', 'asc')

  return rows.map((r) => ({
    ...r,
    current_stock: Number(r.current_stock),
    avg_daily_qty: Number(r.avg_daily_qty),
    days_remaining: r.days_remaining === null ? null : Number(r.days_remaining),
    risk_level: r.days_remaining === null
      ? 'unknown'
      : Number(r.days_remaining) <= 4
        ? 'critical'
        : Number(r.days_remaining) <= 10
          ? 'warning'
          : 'ok',
  }))
}
