CREATE DATABASE inventory_system;
USE inventory_system;

-- Table 1: users
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('manager','staff') DEFAULT 'staff',
    last_login_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table 1b: password_resets
CREATE TABLE password_resets (
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
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Table 2: warehouses
CREATE TABLE warehouses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    address TEXT,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Table 3: locations
CREATE TABLE locations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    warehouse_id INT,
    type ENUM('internal','vendor','customer') DEFAULT 'internal',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
);

-- Table 4: products
CREATE TABLE products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    sku VARCHAR(50) NOT NULL UNIQUE,
    category VARCHAR(100),
    uom VARCHAR(30) DEFAULT 'units',
    cost_price DECIMAL(10,2) DEFAULT 0,
    low_stock_threshold INT DEFAULT 10,
    reorder_qty INT DEFAULT 50,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Table 5: stock_ledger
CREATE TABLE stock_ledger (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT,
    location_id INT,
    qty DECIMAL(10,2) DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE(product_id, location_id),
    CHECK (qty >= 0),
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (location_id) REFERENCES locations(id)
);

-- Table 6: stock_moves
CREATE TABLE stock_moves (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ref VARCHAR(20) NOT NULL,
    type ENUM('receipt','delivery','transfer','adjustment') NOT NULL,
    status ENUM('draft','waiting','ready','done','canceled') DEFAULT 'draft',
    product_id INT,
    from_location_id INT,
    to_location_id INT,
    qty DECIMAL(10,2) NOT NULL,
    supplier VARCHAR(150),
    customer VARCHAR(150),
    notes TEXT,
    created_by INT,
    validated_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (qty > 0),
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (from_location_id) REFERENCES locations(id),
    FOREIGN KEY (to_location_id) REFERENCES locations(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_stock_moves_ref (ref)
);

-- Table 7: order_stacks
CREATE TABLE order_stacks (
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
);

-- Table 8: order_stack_items
CREATE TABLE order_stack_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    stack_id INT,
    product_id INT,
    qty DECIMAL(10,2) NOT NULL,
    supplier VARCHAR(150),
    sort_order INT DEFAULT 0,
    FOREIGN KEY (stack_id) REFERENCES order_stacks(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Table 9: stack_executions
CREATE TABLE stack_executions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    stack_id INT,
    stock_move_id INT,
    executed_by INT,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (stack_id) REFERENCES order_stacks(id),
    FOREIGN KEY (stock_move_id) REFERENCES stock_moves(id),
    FOREIGN KEY (executed_by) REFERENCES users(id)
);

-- Table 10: reorder_rules
CREATE TABLE reorder_rules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT,
    location_id INT,
    min_qty DECIMAL(10,2) NOT NULL,
    reorder_qty DECIMAL(10,2) NOT NULL,
    preferred_supplier VARCHAR(150),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (location_id) REFERENCES locations(id)
);

-- Table 11: stock_alerts
CREATE TABLE stock_alerts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT,
    location_id INT,
    alert_type ENUM('low_stock','out_of_stock','dead_stock') NOT NULL,
    current_qty DECIMAL(10,2) NOT NULL,
    threshold_qty DECIMAL(10,2) NOT NULL,
    is_resolved BOOLEAN DEFAULT FALSE,
    triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL,
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (location_id) REFERENCES locations(id)
);

-- Table 12: consumption_log
CREATE TABLE consumption_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT,
    location_id INT,
    avg_daily_qty DECIMAL(10,4) NOT NULL,
    days_remaining INT,
    calculated_on DATE NOT NULL,
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (location_id) REFERENCES locations(id)
);
