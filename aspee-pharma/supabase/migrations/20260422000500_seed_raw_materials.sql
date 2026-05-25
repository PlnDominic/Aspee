-- Seed raw materials from the updated Aspee raw materials list.
-- Raw materials are stocked in their issue unit:
--   KG -> Grams
--   LTR -> Litres or Millilitres depending on the source list

DO $$
BEGIN

IF EXISTS (SELECT 1 FROM products WHERE sku = 'RM-RAW-001') THEN
  RAISE NOTICE 'Raw materials already seeded; skipping.';
  RETURN;
END IF;

INSERT INTO products (
  name, sku, unit, material_type, is_controlled_drug, reorder_level,
  purchase_unit, issue_unit, bulk_unit, bulk_to_base_ratio
) VALUES
  ('Aerosil',                     'RM-RAW-001', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null),
  ('Amaranth Red',               'RM-RAW-002', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null),
  ('Ammonium Chloride',          'RM-RAW-003', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null),
  ('Anise Oil',                  'RM-RAW-004', 'Litres',       'Raw Material', false, 0, 'Litres',    'Litres',       null, null),
  ('Ascorbic Acid',              'RM-RAW-005', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null),
  ('Aspartame',                  'RM-RAW-006', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null),
  ('Bee Wax',                    'RM-RAW-007', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null),
  ('Benzoic Acid',               'RM-RAW-008', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null),
  ('Brilliant Blue',             'RM-RAW-009', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null),
  ('Bromhexine',                 'RM-RAW-010', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null),
  ('Caffeine Anhydrous',         'RM-RAW-011', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null),
  ('Carnauba Wax',               'RM-RAW-012', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null),
  ('Caramel',                    'RM-RAW-013', 'Litres',       'Raw Material', false, 0, 'Litres',    'Litres',       null, null),
  ('Carboxymethyl Cellulose',    'RM-RAW-014', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null),
  ('Chlorbutanol',               'RM-RAW-015', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null),
  ('Chloroform',                 'RM-RAW-016', 'Millilitres',  'Raw Material', false, 0, 'Litres',    'Millilitres',  null, null),
  ('Chlorpheniramine',           'RM-RAW-017', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null),
  ('Chocolate Flavour',          'RM-RAW-018', 'Litres',       'Raw Material', false, 0, 'Litres',    'Litres',       null, null),
  ('Citric Acid',                'RM-RAW-019', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null),
  ('Condensed Milk Flavour',     'RM-RAW-020', 'Litres',       'Raw Material', false, 0, 'Litres',    'Litres',       null, null),
  ('Cyproheptadine',             'RM-RAW-021', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null),
  ('D-Calcium Pantothenate',     'RM-RAW-022', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null),
  ('Diaphenhydramine',           'RM-RAW-023', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null),
  ('Diazepam',                   'RM-RAW-024', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null),
  ('Di-Calcium Phosphate',       'RM-RAW-025', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null),
  ('Diclofenac Sodium',          'RM-RAW-026', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null),
  ('Dicyclomine',                'RM-RAW-027', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null),
  ('Egg Yellow',                 'RM-RAW-028', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null),
  ('Ephedrine',                  'RM-RAW-029', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null),
  ('Ethanol',                    'RM-RAW-030', 'Millilitres',  'Raw Material', false, 0, 'Litres',    'Millilitres',  null, null),
  ('Ferric Ammonium Citrate',    'RM-RAW-031', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null),
  ('Furazolidone',               'RM-RAW-032', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null),
  ('Gelatin',                    'RM-RAW-033', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null),
  ('Glycerine',                  'RM-RAW-034', 'Millilitres',  'Raw Material', false, 0, 'Litres',    'Millilitres',  null, null),
  ('Guaiphenesin',               'RM-RAW-035', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null),
  ('Honey',                      'RM-RAW-036', 'Millilitres',  'Raw Material', false, 0, 'Litres',    'Millilitres',  null, null),
  ('Ibuprofen',                  'RM-RAW-037', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null),
  ('Iron III Polymatose',        'RM-RAW-038', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null),
  ('Lactose',                    'RM-RAW-039', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null),
  ('Lemon Flavour',              'RM-RAW-040', 'Millilitres',  'Raw Material', false, 0, 'Litres',    'Millilitres',  null, null),
  ('L-Lysine',                   'RM-RAW-041', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null),
  ('Magnesium Stearate',         'RM-RAW-042', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null),
  ('Maize Starch',               'RM-RAW-043', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null),
  ('Mefenamic Acid',             'RM-RAW-044', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null),
  ('Menthol',                    'RM-RAW-045', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null),
  ('Metronidazole',              'RM-RAW-046', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null),
  ('Microcrystalline Cellulose', 'RM-RAW-047', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null),
  ('Nicotinamide',               'RM-RAW-048', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null),
  ('Orange Emulsion',            'RM-RAW-049', 'Millilitres',  'Raw Material', false, 0, 'Litres',    'Millilitres',  null, null),
  ('Orange Flavour',             'RM-RAW-050', 'Millilitres',  'Raw Material', false, 0, 'Litres',    'Millilitres',  null, null),
  ('Paracetamol',                'RM-RAW-051', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null),
  ('Peppermint Oil',             'RM-RAW-052', 'Millilitres',  'Raw Material', false, 0, 'Litres',    'Millilitres',  null, null),
  ('Pineapple Flavour',          'RM-RAW-053', 'Millilitres',  'Raw Material', false, 0, 'Litres',    'Millilitres',  null, null),
  ('Ponceau 4R',                 'RM-RAW-054', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null),
  ('Propylene Glycol',           'RM-RAW-055', 'Millilitres',  'Raw Material', false, 0, 'Litres',    'Millilitres',  null, null),
  ('Purified Talc Powder',       'RM-RAW-056', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null),
  ('Pyridoxine HCL',             'RM-RAW-057', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null),
  ('Quinine Sulphate',           'RM-RAW-058', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null),
  ('Raspberry Flavour',          'RM-RAW-059', 'Millilitres',  'Raw Material', false, 0, 'Litres',    'Millilitres',  null, null),
  ('Riboflavin',                 'RM-RAW-060', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null),
  ('Shellac',                    'RM-RAW-061', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null),
  ('Sodium Chloride',            'RM-RAW-062', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null),
  ('Sodium Citrate',             'RM-RAW-063', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null),
  ('Sodium Lauryl Sulphate',     'RM-RAW-064', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null),
  ('Sodium Saccharin',           'RM-RAW-065', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null),
  ('Sodium Starch Glycolate',    'RM-RAW-066', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null),
  ('Strawberry Emulsion',        'RM-RAW-067', 'Millilitres',  'Raw Material', false, 0, 'Litres',    'Millilitres',  null, null),
  ('Strawberry Flavour',         'RM-RAW-068', 'Millilitres',  'Raw Material', false, 0, 'Litres',    'Millilitres',  null, null),
  ('Tetrazine Yellow',           'RM-RAW-069', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null),
  ('Thiamine Hydrochloride',     'RM-RAW-070', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null),
  ('Thiamine Monohydrate',       'RM-RAW-071', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null),
  ('Titanium Dioxide',           'RM-RAW-072', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null),
  ('Tramadol',                   'RM-RAW-073', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null),
  ('Tween 80',                   'RM-RAW-074', 'Millilitres',  'Raw Material', false, 0, 'Litres',    'Millilitres',  null, null),
  ('Vanilla Flavour',            'RM-RAW-075', 'Millilitres',  'Raw Material', false, 0, 'Litres',    'Millilitres',  null, null),
  ('Vitamin A Acetate',          'RM-RAW-076', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null),
  ('Vitamin A Palmitate',        'RM-RAW-077', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null),
  ('Vitamin B12',                'RM-RAW-078', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null),
  ('Vitamin D3',                 'RM-RAW-079', 'Millilitres',  'Raw Material', false, 0, 'Litres',    'Millilitres',  null, null),
  ('Xanthan Gum',                'RM-RAW-080', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null),
  ('Zinc Sulphate',              'RM-RAW-081', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null),
  ('Sugar',                      'RM-RAW-082', 'Grams',        'Raw Material', false, 0, 'Kilograms', 'Grams',        null, null);

RAISE NOTICE 'Done: raw materials seeded successfully.';

END $$;
