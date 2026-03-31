-- Migration: Add currency columns to relevant tables

-- 1. purchase_orders
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'GHS';

-- 2. supplier_payments
ALTER TABLE supplier_payments ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'GHS';

-- 3. expenses
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'GHS';

-- 4. sales_invoices
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'GHS';
