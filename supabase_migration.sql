-- ============================================================
-- CoreInventory — Supabase SQL Migration
-- Run this entire file in Supabase → SQL Editor → New Query
-- ============================================================

-- ─── Extensions ─────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── ENUM types ─────────────────────────────────────────────
create type operation_status as enum ('draft', 'waiting', 'ready', 'done', 'canceled');
create type ledger_type as enum ('receipt', 'delivery', 'transfer', 'adjustment');

-- ─── Warehouses ──────────────────────────────────────────────
create table warehouses (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  short_code  text not null unique,
  address     text,
  created_at  timestamptz default now()
);

-- ─── Locations (belong to a warehouse) ──────────────────────
create table locations (
  id           uuid primary key default uuid_generate_v4(),
  name         text not null,
  short_code   text not null,
  warehouse_id uuid references warehouses(id) on delete cascade,
  created_at   timestamptz default now()
);

-- ─── Product Categories ──────────────────────────────────────
create table product_categories (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null unique,
  created_at timestamptz default now()
);

-- ─── Products ────────────────────────────────────────────────
create table products (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  sku             text not null unique,
  category_id     uuid references product_categories(id) on delete set null,
  unit_of_measure text not null default 'pcs',
  reorder_point   numeric not null default 0,
  current_stock   numeric not null default 0,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ─── Receipts (Incoming) ────────────────────────────────────
create table receipts (
  id             uuid primary key default uuid_generate_v4(),
  reference      text not null unique,
  supplier       text,
  warehouse_id   uuid references warehouses(id) on delete set null,
  status         operation_status default 'draft',
  scheduled_date date,
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz default now()
);

create table receipt_items (
  id         uuid primary key default uuid_generate_v4(),
  receipt_id uuid references receipts(id) on delete cascade,
  product_id uuid references products(id) on delete restrict,
  quantity   numeric not null check (quantity > 0),
  unit_cost  numeric default 0
);

-- ─── Delivery Orders (Outgoing) ──────────────────────────────
create table delivery_orders (
  id             uuid primary key default uuid_generate_v4(),
  reference      text not null unique,
  customer       text,
  warehouse_id   uuid references warehouses(id) on delete set null,
  status         operation_status default 'draft',
  scheduled_date date,
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz default now()
);

create table delivery_items (
  id          uuid primary key default uuid_generate_v4(),
  delivery_id uuid references delivery_orders(id) on delete cascade,
  product_id  uuid references products(id) on delete restrict,
  quantity    numeric not null check (quantity > 0)
);

-- ─── Internal Transfers ──────────────────────────────────────
create table internal_transfers (
  id               uuid primary key default uuid_generate_v4(),
  reference        text not null unique,
  from_location_id uuid references locations(id) on delete set null,
  to_location_id   uuid references locations(id) on delete set null,
  product_id       uuid references products(id) on delete restrict,
  quantity         numeric not null check (quantity > 0),
  status           operation_status default 'draft',
  scheduled_date   date,
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz default now()
);

-- ─── Stock Adjustments ───────────────────────────────────────
create table stock_adjustments (
  id          uuid primary key default uuid_generate_v4(),
  reference   text not null unique,
  product_id  uuid references products(id) on delete restrict,
  location_id uuid references locations(id) on delete set null,
  system_qty  numeric not null,
  counted_qty numeric not null,
  difference  numeric not null,
  reason      text,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz default now()
);

-- ─── Stock Ledger (every movement is logged here) ────────────
create table stock_ledger (
  id              uuid primary key default uuid_generate_v4(),
  product_id      uuid references products(id) on delete restrict,
  location_id     uuid references locations(id) on delete set null,
  quantity_change numeric not null,
  type            ledger_type not null,
  reference_id    uuid,   -- id of the receipt / delivery / transfer / adjustment
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz default now()
);

-- ─── Indexes ─────────────────────────────────────────────────
create index idx_ledger_product    on stock_ledger(product_id);
create index idx_ledger_location   on stock_ledger(location_id);
create index idx_ledger_type       on stock_ledger(type);
create index idx_ledger_created    on stock_ledger(created_at desc);
create index idx_products_sku      on products(sku);
create index idx_products_category on products(category_id);
create index idx_receipts_status   on receipts(status);
create index idx_deliveries_status on delivery_orders(status);

-- ─── updated_at trigger for products ────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger products_updated_at
  before update on products
  for each row execute function update_updated_at();

-- ─── Row Level Security ──────────────────────────────────────
-- Enable RLS on all tables
alter table warehouses         enable row level security;
alter table locations          enable row level security;
alter table product_categories enable row level security;
alter table products           enable row level security;
alter table receipts           enable row level security;
alter table receipt_items      enable row level security;
alter table delivery_orders    enable row level security;
alter table delivery_items     enable row level security;
alter table internal_transfers enable row level security;
alter table stock_adjustments  enable row level security;
alter table stock_ledger       enable row level security;

-- Policy: authenticated users can read/write all records
-- (For production, scope these to organisation_id)
create policy "auth_all" on warehouses         for all to authenticated using (true) with check (true);
create policy "auth_all" on locations          for all to authenticated using (true) with check (true);
create policy "auth_all" on product_categories for all to authenticated using (true) with check (true);
create policy "auth_all" on products           for all to authenticated using (true) with check (true);
create policy "auth_all" on receipts           for all to authenticated using (true) with check (true);
create policy "auth_all" on receipt_items      for all to authenticated using (true) with check (true);
create policy "auth_all" on delivery_orders    for all to authenticated using (true) with check (true);
create policy "auth_all" on delivery_items     for all to authenticated using (true) with check (true);
create policy "auth_all" on internal_transfers for all to authenticated using (true) with check (true);
create policy "auth_all" on stock_adjustments  for all to authenticated using (true) with check (true);
create policy "auth_all" on stock_ledger       for all to authenticated using (true) with check (true);

-- ─── Seed Data (optional — delete if not needed) ─────────────
insert into product_categories (name) values
  ('Raw Materials'),
  ('Finished Goods'),
  ('Packaging'),
  ('Spare Parts'),
  ('Consumables');

insert into warehouses (name, short_code, address) values
  ('Main Warehouse',    'MAIN', '1 Industrial Park, Unit 1'),
  ('Production Floor',  'PROD', '1 Industrial Park, Unit 2');

insert into locations (name, short_code, warehouse_id)
select 'Rack A', 'RK-A', id from warehouses where short_code = 'MAIN'
union all
select 'Rack B', 'RK-B', id from warehouses where short_code = 'MAIN'
union all
select 'Rack C', 'RK-C', id from warehouses where short_code = 'MAIN'
union all
select 'Production Line 1', 'PL-1', id from warehouses where short_code = 'PROD';
