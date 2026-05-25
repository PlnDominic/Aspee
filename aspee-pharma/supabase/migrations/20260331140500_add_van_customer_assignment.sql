-- Add customer assignment support for vans.

ALTER TABLE public.vans
ADD COLUMN IF NOT EXISTS assigned_customer_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS customer_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS today_sales NUMERIC(12,2) NOT NULL DEFAULT 0;
