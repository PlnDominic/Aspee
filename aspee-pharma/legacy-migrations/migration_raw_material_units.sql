-- Add dual-unit tracking to products
-- purchase_unit: unit on purchase orders (e.g. Kilograms, Litres)
-- issue_unit: unit on material requests / BOM — mirrors the existing `unit` field (e.g. Grams, Litres)
-- The `unit` field remains the authoritative base for stock_levels.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS purchase_unit TEXT,
  ADD COLUMN IF NOT EXISTS issue_unit TEXT;

-- Back-fill existing rows: if unit is a weight, purchase_unit = Kilograms; if volume, Litres; else same.
UPDATE products
SET
  purchase_unit = CASE
    WHEN unit IN ('Milligrams', 'Grams', 'Kilograms', 'Ounces', 'Pounds') THEN 'Kilograms'
    WHEN unit IN ('Millilitres', 'Litres', 'Cubic Centimeters', 'Fluid Ounces', 'Gallons') THEN 'Litres'
    ELSE unit
  END,
  issue_unit = unit
WHERE purchase_unit IS NULL AND material_type = 'Raw Material';
