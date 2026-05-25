-- Seed: Aspee Pharmaceuticals Raw Materials (63 items — list #17 missing from source document)
-- Solids (KG → G): purchased in Kilograms, tracked and issued in Grams
-- Liquids (LTR → L): purchased in Litres, tracked and issued in Litres
-- Idempotent: skips rows where name + material_type already exists.

INSERT INTO products (name, sku, material_type, unit, purchase_unit, issue_unit, reorder_level, product_category)
SELECT v.name, v.sku, 'Raw Material', v.unit, v.purchase_unit, v.unit, 10, 'Other Products'
FROM (VALUES
  ('Paracetamol',              'RM-SEED-001', 'Grams',  'Kilograms'),
  ('Talc Powder',              'RM-SEED-002', 'Grams',  'Kilograms'),
  ('Lactose',                  'RM-SEED-003', 'Grams',  'Kilograms'),
  ('Carboxymethyl Cellulose',  'RM-SEED-004', 'Grams',  'Kilograms'),
  ('Maize Starch',             'RM-SEED-005', 'Grams',  'Kilograms'),
  ('Gelatin',                  'RM-SEED-006', 'Grams',  'Kilograms'),
  ('Sodium Citrate',           'RM-SEED-007', 'Grams',  'Kilograms'),
  ('Citric Acid',              'RM-SEED-008', 'Grams',  'Kilograms'),
  ('Magnesium Stearate',       'RM-SEED-009', 'Grams',  'Kilograms'),
  ('Sodium Starch Glycolate',  'RM-SEED-010', 'Grams',  'Kilograms'),
  ('Sodium Lauryl Sulphate',   'RM-SEED-011', 'Grams',  'Kilograms'),
  ('Aspartame',                'RM-SEED-012', 'Grams',  'Kilograms'),
  ('Xanthan Gum',              'RM-SEED-013', 'Grams',  'Kilograms'),
  ('L-Lysine',                 'RM-SEED-014', 'Grams',  'Kilograms'),
  ('Aerosil',                  'RM-SEED-015', 'Grams',  'Kilograms'),
  ('Vitamin A Acetate',        'RM-SEED-016', 'Grams',  'Kilograms'),
  -- Item #17 missing from source document — add manually when known
  ('Mefenamic Acid',           'RM-SEED-018', 'Grams',  'Kilograms'),
  ('Ascorbic Acid',            'RM-SEED-019', 'Grams',  'Kilograms'),
  ('D-Calcium Pantothenate',   'RM-SEED-020', 'Grams',  'Kilograms'),
  ('Caffeine Anhydrous',       'RM-SEED-021', 'Grams',  'Kilograms'),
  ('Bromhexine',               'RM-SEED-022', 'Grams',  'Kilograms'),
  ('Thiamine Hydrochloride',   'RM-SEED-023', 'Grams',  'Kilograms'),
  ('Thiamine Monohydrate',     'RM-SEED-024', 'Grams',  'Kilograms'),
  ('Pyridoxine',               'RM-SEED-025', 'Grams',  'Kilograms'),
  ('Ponceau 4R',               'RM-SEED-026', 'Grams',  'Kilograms'),
  ('Tetrazine Yellow',         'RM-SEED-027', 'Grams',  'Kilograms'),
  ('Amaranth Red',             'RM-SEED-028', 'Grams',  'Kilograms'),
  ('Cyproheptadine',           'RM-SEED-029', 'Grams',  'Kilograms'),
  ('Riboflavin',               'RM-SEED-030', 'Grams',  'Kilograms'),
  ('Quinine Sulphate',         'RM-SEED-031', 'Grams',  'Kilograms'),
  ('Nicotinamide',             'RM-SEED-032', 'Grams',  'Kilograms'),
  ('Zinc Sulphate',            'RM-SEED-033', 'Grams',  'Kilograms'),
  ('Sodium Chloride',          'RM-SEED-034', 'Grams',  'Kilograms'),
  ('Chlorbutanol',             'RM-SEED-035', 'Grams',  'Kilograms'),
  ('Bee Wax',                  'RM-SEED-036', 'Grams',  'Kilograms'),
  ('Canuaba Wax',              'RM-SEED-037', 'Grams',  'Kilograms'),
  ('Menthol',                  'RM-SEED-038', 'Grams',  'Kilograms'),
  ('Titanium Dioxide',         'RM-SEED-039', 'Grams',  'Kilograms'),
  ('Diaphenhydramine',         'RM-SEED-040', 'Grams',  'Kilograms'),
  ('Chlorpheniramine',         'RM-SEED-041', 'Grams',  'Kilograms'),
  ('Guaiphenesin',             'RM-SEED-042', 'Grams',  'Kilograms'),
  ('Ibuprofen',                'RM-SEED-043', 'Grams',  'Kilograms'),
  ('Sodium Saccharin',         'RM-SEED-044', 'Grams',  'Kilograms'),
  ('Metronidazole',            'RM-SEED-045', 'Grams',  'Kilograms'),
  ('Ammonium Chloride',        'RM-SEED-046', 'Grams',  'Kilograms'),
  ('Di-Calcium Phosphate',     'RM-SEED-047', 'Grams',  'Kilograms'),
  ('Benzoic Acid',             'RM-SEED-048', 'Grams',  'Kilograms'),
  ('Orange Emulsion',          'RM-SEED-049', 'Litres', 'Litres'),
  ('Raspberry Flavour',        'RM-SEED-050', 'Litres', 'Litres'),
  ('Peppermint Oil',           'RM-SEED-051', 'Litres', 'Litres'),
  ('Pineapple Flavour',        'RM-SEED-052', 'Litres', 'Litres'),
  ('Vitamin A Palmitate',      'RM-SEED-053', 'Grams',  'Kilograms'),
  ('Brilliant Blue',           'RM-SEED-054', 'Grams',  'Kilograms'),
  ('Strawberry Flavour',       'RM-SEED-055', 'Litres', 'Litres'),
  ('Anise Oil',                'RM-SEED-056', 'Litres', 'Litres'),
  ('Strawberry Emulsion',      'RM-SEED-057', 'Litres', 'Litres'),
  ('Condensed Milk Flavour',   'RM-SEED-058', 'Litres', 'Litres'),
  ('Lemon Flavour',            'RM-SEED-059', 'Litres', 'Litres'),
  ('Chocolate Flavour',        'RM-SEED-060', 'Litres', 'Litres'),
  ('Vanilla Flavour',          'RM-SEED-061', 'Litres', 'Litres'),
  ('Tween 80',                 'RM-SEED-062', 'Litres', 'Litres'),
  ('Caramel',                  'RM-SEED-063', 'Litres', 'Litres'),
  ('Orange Flavour',           'RM-SEED-064', 'Litres', 'Litres')
) AS v(name, sku, unit, purchase_unit)
WHERE NOT EXISTS (
  SELECT 1 FROM products p
  WHERE p.name = v.name AND p.material_type = 'Raw Material'
);
