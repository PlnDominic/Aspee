-- Persist editable unit selections for Material Requests and GRN items

ALTER TABLE material_request_items
ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'Pieces';

UPDATE material_request_items
SET unit = 'Pieces'
WHERE unit IS NULL;

ALTER TABLE grn_items
ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'Pieces';

UPDATE grn_items
SET unit = 'Pieces'
WHERE unit IS NULL;
