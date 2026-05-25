-- Add optional purchase/issue unit metadata to products.
-- Used for materials bought in one unit and stocked/issued in another,
-- e.g. packaging foils purchased in Kilograms and consumed in Grams.

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS purchase_unit TEXT,
    ADD COLUMN IF NOT EXISTS issue_unit TEXT;
