import pool from '../db.js'

export const toDateOnly = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value)
  return date.toISOString().slice(0, 10)
}

export function computeNextDueAt(fromDate, frequency) {
  const date = new Date(fromDate || new Date())
  if (frequency === 'daily') date.setDate(date.getDate() + 1)
  else if (frequency === 'weekly') date.setDate(date.getDate() + 7)
  else date.setMonth(date.getMonth() + 1)
  return toDateOnly(date)
}

export async function ensureAuthTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      email VARCHAR(150) NOT NULL,
      code_hash VARCHAR(255) NOT NULL,
      expires_at DATETIME NOT NULL,
      used_at DATETIME NULL,
      attempt_count INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_password_resets_email (email),
      INDEX idx_password_resets_user (user_id),
      CONSTRAINT fk_password_resets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `)
}

export async function ensureFeatureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS order_stacks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      frequency ENUM('daily','weekly','monthly','custom') DEFAULT 'monthly',
      to_location_id INT,
      created_by INT,
      last_executed_at DATE,
      next_due_at DATE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (to_location_id) REFERENCES locations(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS order_stack_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      stack_id INT,
      product_id INT,
      qty DECIMAL(10,2) NOT NULL,
      supplier VARCHAR(150),
      sort_order INT DEFAULT 0,
      FOREIGN KEY (stack_id) REFERENCES order_stacks(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS stack_executions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      stack_id INT,
      stock_move_id INT,
      executed_by INT,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (stack_id) REFERENCES order_stacks(id) ON DELETE CASCADE,
      FOREIGN KEY (stock_move_id) REFERENCES stock_moves(id) ON DELETE CASCADE,
      FOREIGN KEY (executed_by) REFERENCES users(id)
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS consumption_events (
      id INT AUTO_INCREMENT PRIMARY KEY,
      move_id INT NOT NULL UNIQUE,
      product_id INT NOT NULL,
      location_id INT NOT NULL,
      qty_out DECIMAL(10,2) NOT NULL,
      move_date DATE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_consumption_events_lookup (product_id, location_id, move_date),
      FOREIGN KEY (move_id) REFERENCES stock_moves(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (location_id) REFERENCES locations(id)
    )
  `)
}

export async function backfillConsumptionEvents() {
  await pool.query(`
    INSERT IGNORE INTO consumption_events (move_id, product_id, location_id, qty_out, move_date)
    SELECT
      sm.id,
      sm.product_id,
      sm.from_location_id,
      sm.qty,
      DATE(COALESCE(sm.validated_at, sm.created_at))
    FROM stock_moves sm
    WHERE sm.type = 'delivery'
      AND sm.status = 'done'
      AND sm.from_location_id IS NOT NULL
  `)
}
