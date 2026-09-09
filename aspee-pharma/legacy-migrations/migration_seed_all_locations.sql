-- Re-seed all core stock locations
-- Safe to run multiple times — uses ON CONFLICT DO NOTHING

CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_locations_name ON public.stock_locations (name);

INSERT INTO public.stock_locations (name, type)
VALUES
  ('Main Warehouse',       'Warehouse'),
  ('Finished Goods Store', 'Warehouse'),
  ('Packaging Store',      'Warehouse'),
  ('Quarantine Store',     'Quarantine'),
  ('Production Floor',     'Production'),
  ('Sales Department',     'Sales')
ON CONFLICT (name) DO NOTHING;
