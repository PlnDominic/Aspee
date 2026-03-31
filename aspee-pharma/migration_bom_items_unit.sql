-- Add unit column to bom_items table
-- Run this in the Supabase SQL Editor

ALTER TABLE bom_items
ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'Pieces';

-- Update existing rows to have a default unit from their component
UPDATE bom_items bi
SET unit = p.unit
FROM products p
WHERE bi.component_id = p.id AND bi.unit IS NULL;

-- Final fallback for any remaining nulls
UPDATE bom_items
SET unit = 'Pieces'
WHERE unit IS NULL;
