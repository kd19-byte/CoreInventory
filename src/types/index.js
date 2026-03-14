/**
 * @typedef {Object} Product
 * @property {string}  id
 * @property {string}  name
 * @property {string}  sku
 * @property {string}  category
 * @property {string}  uom
 * @property {number}  cost_price
 * @property {number}  low_stock_threshold
 * @property {number}  reorder_qty
 * @property {string}  created_at
 */

/**
 * @typedef {Object} Warehouse
 * @property {string}  id
 * @property {string}  name
 * @property {string}  address
 * @property {string}  created_at
 */

/**
 * @typedef {Object} Location
 * @property {string}  id
 * @property {string}  name
 * @property {string}  warehouse_id
 * @property {'internal'|'vendor'|'customer'} type
 */

/** @typedef {'draft'|'waiting'|'ready'|'done'|'canceled'} Status */

/**
 * @typedef {Object} StockMove
 * @property {string}  id
 * @property {string}  ref
 * @property {'receipt'|'delivery'|'transfer'|'adjustment'} type
 * @property {Status}  status
 * @property {string}  product_id
 * @property {string}  from_location_id
 * @property {string}  to_location_id
 * @property {number}  qty
 * @property {string}  supplier
 * @property {string}  customer
 * @property {string}  created_at
 */
