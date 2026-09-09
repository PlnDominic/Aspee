-- Seed default stock locations required by the production completion flow
-- Corrected syntax: Using 'CREATE UNIQUE INDEX IF NOT EXISTS' for conflict handling
-- Safe to run multiple times

-- 1. Ensure 'name' is unique so we can use ON CONFLICT
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_locations_name ON stock_locations (name);

-- 2. Insert default locations
INSERT INTO stock_locations (name, type)
VALUES
  ('Main Warehouse',      'Warehouse'),
  ('Finished Goods Store','Warehouse'),
  ('Packaging Store',     'Warehouse'),
  ('Quarantine Store',    'Quarantine')
ON CONFLICT (name) DO NOTHING;
