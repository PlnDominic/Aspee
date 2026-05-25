-- Ensure the Sales Department exists as an intermediate stock location
-- for the operational sales flow:
-- Stores -> Sales Department -> Individual Vans -> Sales Invoices

CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_locations_name ON public.stock_locations (name);

INSERT INTO public.stock_locations (name, type)
VALUES ('Sales Department', 'Sales')
ON CONFLICT (name) DO NOTHING;
