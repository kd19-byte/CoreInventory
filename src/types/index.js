/**
 * @typedef {Object} Product
 * @property {string}  id
 * @property {string}  name
 * @property {string}  sku
 * @property {string}  category_id
 * @property {string}  unit_of_measure
 * @property {number}  reorder_point
 * @property {number}  current_stock
 * @property {string}  created_at
 */

/**
 * @typedef {Object} Warehouse
 * @property {string}  id
 * @property {string}  name
 * @property {string}  short_code
 * @property {string}  address
 * @property {string}  created_at
 */

/**
 * @typedef {Object} Location
 * @property {string}  id
 * @property {string}  name
 * @property {string}  short_code
 * @property {string}  warehouse_id
 */

/**
 * @typedef {'draft'|'waiting'|'ready'|'done'|'canceled'} Status
 */

/**
 * @typedef {Object} Receipt
 * @property {string}  id
 * @property {string}  reference
 * @property {string}  supplier
 * @property {Status}  status
 * @property {string}  warehouse_id
 * @property {string}  scheduled_date
 * @property {string}  created_by
 * @property {string}  created_at
 * @property {ReceiptItem[]} items
 */

/**
 * @typedef {Object} ReceiptItem
 * @property {string}  id
 * @property {string}  receipt_id
 * @property {string}  product_id
 * @property {number}  quantity
 * @property {number}  unit_cost
 */

/**
 * @typedef {Object} DeliveryOrder
 * @property {string}  id
 * @property {string}  reference
 * @property {string}  customer
 * @property {Status}  status
 * @property {string}  warehouse_id
 * @property {string}  scheduled_date
 * @property {string}  created_by
 * @property {string}  created_at
 * @property {DeliveryItem[]} items
 */

/**
 * @typedef {Object} DeliveryItem
 * @property {string}  id
 * @property {string}  delivery_id
 * @property {string}  product_id
 * @property {number}  quantity
 */

/**
 * @typedef {Object} InternalTransfer
 * @property {string}  id
 * @property {string}  reference
 * @property {Status}  status
 * @property {string}  from_location_id
 * @property {string}  to_location_id
 * @property {string}  scheduled_date
 * @property {string}  created_at
 */

/**
 * @typedef {Object} StockAdjustment
 * @property {string}  id
 * @property {string}  reference
 * @property {string}  product_id
 * @property {string}  location_id
 * @property {number}  system_qty
 * @property {number}  counted_qty
 * @property {number}  difference
 * @property {string}  reason
 * @property {string}  created_at
 */

/**
 * @typedef {Object} LedgerEntry
 * @property {string}  id
 * @property {string}  product_id
 * @property {string}  location_id
 * @property {number}  quantity_change
 * @property {'receipt'|'delivery'|'transfer'|'adjustment'} type
 * @property {string}  reference_id
 * @property {string}  created_at
 */
