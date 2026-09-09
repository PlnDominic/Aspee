-- Add unit column to purchase_order_items table
-- Run this in the Supabase SQL Editor

ALTER TABLE purchase_order_items
ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'Pieces';

-- Update existing rows to have a default unit
UPDATE purchase_order_items
SET unit = 'Pieces'
WHERE unit IS NULL;
