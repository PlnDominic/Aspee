ALTER TABLE public.material_request_items
    ADD COLUMN IF NOT EXISTS quantity_used numeric(15, 2);

ALTER TABLE public.material_requests
    ADD COLUMN IF NOT EXISTS usage_status text NOT NULL DEFAULT 'Not Recorded',
    ADD COLUMN IF NOT EXISTS usage_recorded_at timestamptz;

NOTIFY pgrst, 'reload schema';
