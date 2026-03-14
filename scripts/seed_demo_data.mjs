import dotenv from 'dotenv'
import mysql from 'mysql2/promise'
import bcrypt from 'bcryptjs'

dotenv.config()

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'inventory_system',
  connectionLimit: 5,
})

const DEMO_PASSWORD = 'Password@123'

const demoUsers = [
  { name: 'Inventory Manager', email: 'manager.demo@coreinventory.local', role: 'manager' },
  { name: 'Warehouse Staff', email: 'staff.demo@coreinventory.local', role: 'staff' },
  { name: 'Operations Lead', email: 'ops.demo@coreinventory.local', role: 'manager' },
]

const demoWarehouses = [
  { name: 'Main Warehouse', address: 'Plot 21, Sector A, Industrial Zone' },
  { name: 'North Warehouse', address: 'Building 8, North Logistics Park' },
  { name: 'East Distribution Hub', address: 'Dock Road, East Cargo Belt' },
]

const demoLocations = [
  { name: 'Main Store', warehouse: 'Main Warehouse', type: 'internal' },
  { name: 'Rack A1', warehouse: 'Main Warehouse', type: 'internal' },
  { name: 'Rack B2', warehouse: 'Main Warehouse', type: 'internal' },
  { name: 'Inbound Bay', warehouse: 'North Warehouse', type: 'internal' },
  { name: 'Dispatch Zone', warehouse: 'North Warehouse', type: 'internal' },
  { name: 'Bulk Stack', warehouse: 'East Distribution Hub', type: 'internal' },
  { name: 'Vendor Dock', warehouse: null, type: 'vendor' },
  { name: 'Customer Gate', warehouse: null, type: 'customer' },
]

const demoProducts = [
  { name: 'Steel Rod 10mm', sku: 'STL-10MM', category: 'Raw Materials', uom: 'kg', cost: 88, low: 120, reorder: 300 },
  { name: 'Steel Rod 12mm', sku: 'STL-12MM', category: 'Raw Materials', uom: 'kg', cost: 93, low: 100, reorder: 260 },
  { name: 'Aluminium Sheet 2mm', sku: 'ALU-2MM', category: 'Raw Materials', uom: 'sheet', cost: 780, low: 40, reorder: 120 },
  { name: 'Bearing Set BX-4', sku: 'BRG-BX4', category: 'Components', uom: 'set', cost: 145, low: 35, reorder: 110 },
  { name: 'Hex Bolt M10', sku: 'BLT-M10', category: 'Fasteners', uom: 'pcs', cost: 6, low: 800, reorder: 3000 },
  { name: 'Hex Nut M10', sku: 'NUT-M10', category: 'Fasteners', uom: 'pcs', cost: 4, low: 1000, reorder: 3500 },
  { name: 'Safety Gloves XL', sku: 'SAFE-GLV-XL', category: 'Safety', uom: 'pair', cost: 65, low: 90, reorder: 250 },
  { name: 'Safety Helmet', sku: 'SAFE-HELM', category: 'Safety', uom: 'pcs', cost: 210, low: 40, reorder: 120 },
  { name: 'Industrial Lubricant', sku: 'LUB-IND', category: 'Consumables', uom: 'ltr', cost: 305, low: 40, reorder: 120 },
  { name: 'Cutting Disc 4in', sku: 'DISC-4IN', category: 'Tools', uom: 'pcs', cost: 48, low: 120, reorder: 400 },
  { name: 'Packing Tape 3in', sku: 'TAPE-3IN', category: 'Packaging', uom: 'roll', cost: 38, low: 70, reorder: 220 },
  { name: 'Stretch Film 500mm', sku: 'FILM-500', category: 'Packaging', uom: 'roll', cost: 185, low: 30, reorder: 100 },
  { name: 'Welding Wire 1.2mm', sku: 'WLD-1P2', category: 'Consumables', uom: 'kg', cost: 540, low: 50, reorder: 140 },
  { name: 'Paint Primer Gray', sku: 'PNT-PRM-GR', category: 'Chemicals', uom: 'ltr', cost: 295, low: 45, reorder: 130 },
]

const stockPlan = [
  { sku: 'STL-10MM', byLoc: [['Main Store', 420], ['Rack A1', 95]] },
  { sku: 'STL-12MM', byLoc: [['Main Store', 180], ['Rack B2', 40]] },
  { sku: 'ALU-2MM', byLoc: [['Inbound Bay', 18], ['Bulk Stack', 16]] },
  { sku: 'BRG-BX4', byLoc: [['Dispatch Zone', 0]] }, // out of stock
  { sku: 'BLT-M10', byLoc: [['Main Store', 720], ['Rack A1', 95]] },
  { sku: 'NUT-M10', byLoc: [['Main Store', 1400]] },
  { sku: 'SAFE-GLV-XL', byLoc: [['Dispatch Zone', 60]] }, // low stock
  { sku: 'SAFE-HELM', byLoc: [['Dispatch Zone', 55]] },
  { sku: 'LUB-IND', byLoc: [['Bulk Stack', 22]] }, // low stock
  { sku: 'DISC-4IN', byLoc: [['Rack B2', 0], ['Bulk Stack', 15]] }, // out/low
  { sku: 'TAPE-3IN', byLoc: [['Dispatch Zone', 92]] },
  { sku: 'FILM-500', byLoc: [['Dispatch Zone', 26]] }, // low stock
  { sku: 'WLD-1P2', byLoc: [['Main Store', 68]] },
  { sku: 'PNT-PRM-GR', byLoc: [['Inbound Bay', 31]] }, // low stock
]

async function ensureUser(conn, user) {
  const [rows] = await conn.query('SELECT id FROM users WHERE email = ? LIMIT 1', [user.email])
  if (rows[0]) return rows[0].id
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10)
  const [res] = await conn.query(
    'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
    [user.name, user.email, passwordHash, user.role]
  )
  return res.insertId
}

async function ensureWarehouse(conn, warehouse, createdBy) {
  const [rows] = await conn.query('SELECT id FROM warehouses WHERE name = ? LIMIT 1', [warehouse.name])
  if (rows[0]) return rows[0].id
  const [res] = await conn.query(
    'INSERT INTO warehouses (name, address, created_by) VALUES (?, ?, ?)',
    [warehouse.name, warehouse.address, createdBy]
  )
  return res.insertId
}

async function ensureLocation(conn, location, warehouseIdByName) {
  const warehouseId = location.warehouse ? warehouseIdByName.get(location.warehouse) : null
  const [rows] = await conn.query(
    'SELECT id FROM locations WHERE name = ? AND warehouse_id <=> ? LIMIT 1',
    [location.name, warehouseId]
  )
  if (rows[0]) return rows[0].id
  const [res] = await conn.query(
    'INSERT INTO locations (name, warehouse_id, type) VALUES (?, ?, ?)',
    [location.name, warehouseId, location.type]
  )
  return res.insertId
}

async function ensureProduct(conn, product, createdBy) {
  const [rows] = await conn.query('SELECT id FROM products WHERE sku = ? LIMIT 1', [product.sku])
  if (!rows[0]) {
    const [res] = await conn.query(
      `INSERT INTO products
       (name, sku, category, uom, cost_price, low_stock_threshold, reorder_qty, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [product.name, product.sku, product.category, product.uom, product.cost, product.low, product.reorder, createdBy]
    )
    return res.insertId
  }

  await conn.query(
    `UPDATE products
     SET name = ?, category = ?, uom = ?, cost_price = ?, low_stock_threshold = ?, reorder_qty = ?
     WHERE id = ?`,
    [product.name, product.category, product.uom, product.cost, product.low, product.reorder, rows[0].id]
  )
  return rows[0].id
}

async function seedOperations(conn, productIdBySku, locationIdByName, createdBy) {
  const refs = [
    {
      ref: 'REC/240901',
      type: 'receipt',
      status: 'done',
      supplier: 'Alpha Metals Pvt Ltd',
      to_location_id: locationIdByName.get('Main Store'),
      notes: 'Monthly raw material receipt',
      items: [
        ['STL-10MM', 180],
        ['STL-12MM', 90],
        ['ALU-2MM', 24],
      ],
      validated: true,
    },
    {
      ref: 'REC/240902',
      type: 'receipt',
      status: 'waiting',
      supplier: 'SafeGear Supplies',
      to_location_id: locationIdByName.get('Dispatch Zone'),
      notes: 'PPE replenishment',
      items: [
        ['SAFE-GLV-XL', 80],
        ['SAFE-HELM', 40],
      ],
      validated: false,
    },
    {
      ref: 'DEL/240903',
      type: 'delivery',
      status: 'done',
      customer: 'Metro Fabrication',
      from_location_id: locationIdByName.get('Main Store'),
      notes: 'Sales order SO-1192',
      items: [
        ['BLT-M10', 400],
        ['NUT-M10', 400],
      ],
      validated: true,
    },
    {
      ref: 'DEL/240904',
      type: 'delivery',
      status: 'ready',
      customer: 'ProBuild Engineering',
      from_location_id: locationIdByName.get('Dispatch Zone'),
      notes: 'Ready for dispatch tomorrow morning',
      items: [
        ['TAPE-3IN', 20],
        ['FILM-500', 15],
      ],
      validated: false,
    },
    {
      ref: 'TRF/240905',
      type: 'transfer',
      status: 'done',
      from_location_id: locationIdByName.get('Main Store'),
      to_location_id: locationIdByName.get('Rack A1'),
      notes: 'Moved for floor consumption',
      items: [
        ['WLD-1P2', 12],
      ],
      validated: true,
    },
    {
      ref: 'TRF/240906',
      type: 'transfer',
      status: 'draft',
      from_location_id: locationIdByName.get('Inbound Bay'),
      to_location_id: locationIdByName.get('Bulk Stack'),
      notes: 'Planned relocation of chemical stock',
      items: [
        ['PNT-PRM-GR', 10],
      ],
      validated: false,
    },
    {
      ref: 'ADJ/240907',
      type: 'adjustment',
      status: 'done',
      from_location_id: locationIdByName.get('Dispatch Zone'),
      to_location_id: null,
      notes: 'Damaged in handling',
      items: [
        ['SAFE-GLV-XL', 6],
      ],
      validated: true,
    },
  ]

  for (const op of refs) {
    const [exists] = await conn.query('SELECT id FROM stock_moves WHERE ref = ? LIMIT 1', [op.ref])
    if (exists[0]) continue

    for (const [sku, qty] of op.items) {
      const productId = productIdBySku.get(sku)
      if (!productId) continue
      await conn.query(
        `INSERT INTO stock_moves
         (ref, type, status, product_id, from_location_id, to_location_id, qty, supplier, customer, notes, created_by, validated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          op.ref,
          op.type,
          op.status,
          productId,
          op.from_location_id ?? null,
          op.to_location_id ?? null,
          qty,
          op.supplier ?? null,
          op.customer ?? null,
          op.notes ?? null,
          createdBy,
          op.validated ? new Date() : null,
        ]
      )
    }
  }
}

async function main() {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    const userIdByEmail = new Map()
    for (const user of demoUsers) {
      const id = await ensureUser(conn, user)
      userIdByEmail.set(user.email, id)
    }
    const primaryUserId = userIdByEmail.get('manager.demo@coreinventory.local') || 1

    const warehouseIdByName = new Map()
    for (const warehouse of demoWarehouses) {
      const id = await ensureWarehouse(conn, warehouse, primaryUserId)
      warehouseIdByName.set(warehouse.name, id)
    }

    const locationIdByName = new Map()
    for (const location of demoLocations) {
      const id = await ensureLocation(conn, location, warehouseIdByName)
      locationIdByName.set(location.name, id)
    }

    const productIdBySku = new Map()
    for (const product of demoProducts) {
      const id = await ensureProduct(conn, product, primaryUserId)
      productIdBySku.set(product.sku, id)
    }

    for (const item of stockPlan) {
      const productId = productIdBySku.get(item.sku)
      if (!productId) continue
      for (const [locName, qty] of item.byLoc) {
        const locationId = locationIdByName.get(locName)
        if (!locationId) continue
        await conn.query(
          `INSERT INTO stock_ledger (product_id, location_id, qty)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE qty = VALUES(qty)`,
          [productId, locationId, qty]
        )
      }
    }

    await seedOperations(conn, productIdBySku, locationIdByName, primaryUserId)
    await conn.commit()

    const [[counts]] = await conn.query(`
      SELECT
        (SELECT COUNT(*) FROM users) AS users_count,
        (SELECT COUNT(*) FROM warehouses) AS warehouses_count,
        (SELECT COUNT(*) FROM locations) AS locations_count,
        (SELECT COUNT(*) FROM products) AS products_count,
        (SELECT COUNT(*) FROM stock_moves) AS stock_moves_count
    `)

    const [[stockSummary]] = await conn.query(`
      SELECT
        SUM(CASE WHEN current_stock = 0 THEN 1 ELSE 0 END) AS out_of_stock,
        SUM(CASE WHEN low_stock_threshold > 0 AND current_stock <= low_stock_threshold THEN 1 ELSE 0 END) AS low_stock
      FROM (
        SELECT p.id, p.low_stock_threshold, COALESCE(SUM(sl.qty), 0) AS current_stock
        FROM products p
        LEFT JOIN stock_ledger sl ON sl.product_id = p.id
        GROUP BY p.id
      ) s
    `)

    console.log('Demo data seeded successfully')
    console.log('Demo login users (password for all: Password@123):')
    console.log(' - manager.demo@coreinventory.local')
    console.log(' - staff.demo@coreinventory.local')
    console.log(' - ops.demo@coreinventory.local')
    console.log('Counts:', counts)
    console.log('Stock Alerts:', stockSummary)
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
    await pool.end()
  }
}

main().catch((err) => {
  console.error('Failed to seed demo data:', err.message)
  process.exit(1)
})

