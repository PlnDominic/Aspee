-- Add unit conversion columns to products
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS units_per_carton INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS unit_label TEXT NOT NULL DEFAULT 'Units';

-- ── Syrups: 30 bottles/carton ────────────────────────────────────────────────
UPDATE products SET units_per_carton = 30, unit_label = 'Bottles'
WHERE name ILIKE 'ASPIDYNE SYRUP'
   OR name ILIKE 'ASPIDYNE (NO JACKET) SYRUP'
   OR name ILIKE 'ASPITONE SYRUP'
   OR name ILIKE 'HAEMATOSE SYRUP'
   OR name ILIKE 'LISTA SYRUP';

-- ── Syrups: 60 bottles/carton ────────────────────────────────────────────────
UPDATE products SET units_per_carton = 60, unit_label = 'Bottles'
WHERE name ILIKE 'ASPIMOL SYRUP'
   OR name ILIKE 'ASPIMOL SYRUP (NO JACKET)'
   OR name ILIKE 'ASPOCOF SYRUP'
   OR name ILIKE 'KINDERCOF SYRUP'
   OR name ILIKE 'KINDERVITE SYRUP'
   OR name ILIKE 'KINDERVITE SYRUP (NO JACKET)'
   OR name ILIKE 'KINDERPLEX SYRUP'
   OR name ILIKE 'ADULTCOF SYRUP'
   OR name ILIKE 'ASPROLEX F SYRUP'
   OR name ILIKE 'QUININE SYRUP'
   OR name ILIKE 'CODACOF SYRUP';

-- ── Nasal drops: 180 bottles/carton ─────────────────────────────────────────
UPDATE products SET units_per_carton = 180, unit_label = 'Bottles'
WHERE name ILIKE 'NASAL DROP 0.5%'
   OR name ILIKE 'NASAL DROP 1%';

-- ── Tablets / Capsules: 24 skellets/carton ───────────────────────────────────
UPDATE products SET units_per_carton = 24, unit_label = 'Skellets'
WHERE name ILIKE 'ASCOLD TABLET'
   OR name ILIKE 'FOLIC ACID TABLET'
   OR name ILIKE 'ASPIMOL EXTRA TABLET'
   OR name ILIKE 'ASPIMOL EXTRA CAPSULES'
   OR name ILIKE 'ASPIMOL FORTE CAPSULES'
   OR name ILIKE 'ASPIMOL PLUS TABLET'
   OR name ILIKE 'MULTIVITE TABLET'
   OR name ILIKE 'B CO TABLET'
   OR name ILIKE 'DIAZEPAM 5MG TABLET'
   OR name ILIKE 'DIAZEPAM 10MG TABLET'
   OR name ILIKE 'ASPIMAK CAPSULES'
   OR name ILIKE 'ASTRADOL TABLET'
   OR name ILIKE 'HAEMATOSE CAPSULES';

-- ── Aspidyne Capsules: 18 skellets/carton ────────────────────────────────────
UPDATE products SET units_per_carton = 18, unit_label = 'Skellets'
WHERE name ILIKE 'ASPIDYNE CAPSULES';
