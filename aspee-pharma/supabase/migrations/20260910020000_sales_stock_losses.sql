-- ============================================================================
-- Dedicated tracking for stock that leaves a location without being sold to
-- a customer: damage, leakage/spillage, or product given away as a gift.
-- Previously the only place to record any of this was the invoice's
-- "Returns" field, which conflated it with genuine customer returns (see
-- 20260910010000_persist_invoice_returns_cash_credit.sql) — a damaged or
-- gifted unit was never sold to anyone, so it has no business sitting on a
-- sales invoice line or affecting what a customer is billed.
--
-- This mirrors the existing Material Defects pattern (stock_material_defects
-- / MaterialDefectModal.tsx) but scoped to Sales — a rep or manager logs the
-- loss against any stock location (typically their van), stock is deducted
-- immediately, and it's fully separate from invoicing.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sales_stock_losses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_number text NOT NULL UNIQUE,
    date date NOT NULL DEFAULT current_date,
    product_id uuid NOT NULL REFERENCES public.products(id),
    location_id uuid NOT NULL REFERENCES public.stock_locations(id),
    quantity numeric(12,3) NOT NULL CHECK (quantity > 0),
    reason text NOT NULL CHECK (reason IN ('Damage', 'Leakage', 'Gift')),
    customer_name text,
    batch_number text,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_stock_losses_product  ON public.sales_stock_losses (product_id);
CREATE INDEX IF NOT EXISTS idx_sales_stock_losses_location ON public.sales_stock_losses (location_id);
CREATE INDEX IF NOT EXISTS idx_sales_stock_losses_date     ON public.sales_stock_losses (date);

ALTER TABLE public.sales_stock_losses ENABLE ROW LEVEL SECURITY;

-- Same role set already used for the rest of the Sales module by
-- 20260909000000_role_based_rls_policies.sql's sales_roles array.
-- _set_module_rls is a void-returning FUNCTION (not a PROCEDURE), so it's
-- invoked with SELECT here, same as it would be with PERFORM inside a DO
-- block — matching how every other table in that migration calls it.
SELECT public._set_module_rls(
    'sales_stock_losses',
    ARRAY['Super Admin', 'Managing Director', 'Sales Manager', 'Van Sales Rep', 'Accountant']
);
