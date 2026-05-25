-- Migration: Add customer_category, customer_location, sales_person to customers table
-- Run this in the Supabase SQL editor

ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS customer_category TEXT,
    ADD COLUMN IF NOT EXISTS customer_location  TEXT,
    ADD COLUMN IF NOT EXISTS sales_person       TEXT;

-- Add a check constraint for the allowed category values
ALTER TABLE customers
    DROP CONSTRAINT IF EXISTS customers_category_check;

ALTER TABLE customers
    ADD CONSTRAINT customers_category_check
    CHECK (customer_category IS NULL OR customer_category IN (
        'OTC',
        'WHOLESALE PHARMACY',
        'RETAIL PHARMACY',
        'CLINIC',2
        'HOSPITAL',
        'MEDICAL STORES'
    ));
