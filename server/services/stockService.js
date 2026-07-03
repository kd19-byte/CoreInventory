import AppError from '../utils/AppError.js'
import { toDateOnly } from './startupService.js'

export async function getStock(conn, productId, locationId) {
  const [rows] = await conn.query(
    'SELECT qty FROM stock_ledger WHERE product_id = ? AND location_id = ? LIMIT 1',
    [productId, locationId]
  )
  return rows[0] ? Number(rows[0].qty) : 0
}

export async function setStock(conn, productId, locationId, qty) {
  await conn.query(
    `INSERT INTO stock_ledger (product_id, location_id, qty)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE qty = VALUES(qty)`,
    [productId, locationId, qty]
  )
}

export async function upsertLedger(conn, productId, locationId, deltaQty) {
  await conn.query(
    `INSERT INTO stock_ledger (product_id, location_id, qty)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE qty = qty + ?`,
    [productId, locationId, deltaQty, deltaQty]
  )
}

export async function setLedger(conn, productId, locationId, absoluteQty) {
  await conn.query(
    `INSERT INTO stock_ledger (product_id, location_id, qty)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE qty = ?`,
    [productId, locationId, absoluteQty, absoluteQty]
  )
}

export async function checkStock(conn, productId, locationId, requiredQty) {
  const available = await getStock(conn, productId, locationId)
  if (available < requiredQty) {
    throw new AppError(`Insufficient stock. Available: ${available}, Required: ${requiredQty}`, 400)
  }
}

export async function validateOperationByRef(ref, conn) {
  const [rows] = await conn.query('SELECT * FROM stock_moves WHERE ref = ?', [ref])
  if (!rows.length) throw new AppError('Operation not found', 404)

  const type = rows[0].type

  if (type === 'receipt') {
    for (const row of rows) {
      if (!row.to_location_id) throw new AppError('to_location_id is required for receipt', 400)
      await upsertLedger(conn, row.product_id, row.to_location_id, Number(row.qty))
    }
  } else if (type === 'delivery') {
    for (const row of rows) {
      if (!row.from_location_id) throw new AppError('from_location_id is required for delivery', 400)
      await checkStock(conn, row.product_id, row.from_location_id, Number(row.qty))
      await upsertLedger(conn, row.product_id, row.from_location_id, -Number(row.qty))
      await conn.query(
        `INSERT IGNORE INTO consumption_events (move_id, product_id, location_id, qty_out, move_date)
         VALUES (?, ?, ?, ?, ?)`,
        [row.id, row.product_id, row.from_location_id, Number(row.qty), toDateOnly(new Date())]
      )
    }
  } else if (type === 'transfer') {
    for (const row of rows) {
      if (!row.from_location_id || !row.to_location_id) {
        throw new AppError('Both locations are required for transfer', 400)
      }
      await checkStock(conn, row.product_id, row.from_location_id, Number(row.qty))
      await upsertLedger(conn, row.product_id, row.from_location_id, -Number(row.qty))
      await upsertLedger(conn, row.product_id, row.to_location_id, Number(row.qty))
    }
  }

  await conn.query(
    'UPDATE stock_moves SET status = ?, validated_at = CURRENT_TIMESTAMP WHERE ref = ?',
    ['done', ref]
  )

  return { type, count: rows.length }
}
