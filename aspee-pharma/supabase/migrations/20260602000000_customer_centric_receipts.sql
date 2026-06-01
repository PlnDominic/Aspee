-- ============================================================
-- Migration: Customer-centric Cash Receipts
--
-- Receipts now belong to a customer (not an invoice) so partial
-- payments that span multiple invoices can be captured cleanly.
-- Receipts can optionally be allocated to one or more invoices
-- via sales_receipt_allocations.
--
-- Adds the two-stage workflow fields:
--   confirmation_status: registered → confirmed | variance | voided
--   sales_person_id, route_id, registered_by, registered_at
--   variance_reason
-- ============================================================

-- ---- 1. New columns on sales_receipts ----

ALTER TABLE public.sales_receipts
    ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS sales_person_id UUID REFERENCES public.system_users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS route_id UUID REFERENCES public.vans(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS registered_by UUID REFERENCES public.system_users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS registered_at TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS confirmation_status TEXT DEFAULT 'registered',
    ADD COLUMN IF NOT EXISTS variance_reason TEXT;

-- Constrain confirmation_status to a known set
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'sales_receipts_confirmation_status_chk'
    ) THEN
        ALTER TABLE public.sales_receipts
            ADD CONSTRAINT sales_receipts_confirmation_status_chk
            CHECK (confirmation_status IN ('registered', 'confirmed', 'variance', 'voided'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sales_receipts_customer_id ON public.sales_receipts(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_receipts_sales_person_id ON public.sales_receipts(sales_person_id);
CREATE INDEX IF NOT EXISTS idx_sales_receipts_route_id ON public.sales_receipts(route_id);
CREATE INDEX IF NOT EXISTS idx_sales_receipts_confirmation_status ON public.sales_receipts(confirmation_status);

-- ---- 2. Backfill from existing data ----

-- customer_id from the linked invoice
UPDATE public.sales_receipts sr
SET customer_id = si.customer_id
FROM public.sales_invoices si
WHERE sr.invoice_id = si.id
  AND sr.customer_id IS NULL
  AND si.customer_id IS NOT NULL;

-- Fallback: match customer_name → customers.name (best-effort)
UPDATE public.sales_receipts sr
SET customer_id = c.id
FROM public.customers c
WHERE sr.customer_id IS NULL
  AND sr.customer_name IS NOT NULL
  AND lower(btrim(sr.customer_name)) = lower(btrim(c.name));

-- sales_person_id / route_id from the linked invoice
UPDATE public.sales_receipts sr
SET sales_person_id = COALESCE(sr.sales_person_id, si.salesperson_id),
    route_id        = COALESCE(sr.route_id, si.route_id)
FROM public.sales_invoices si
WHERE sr.invoice_id = si.id
  AND (sr.sales_person_id IS NULL OR sr.route_id IS NULL);

-- Existing rows that already passed through Accounts ⇒ mark confirmed
UPDATE public.sales_receipts
SET confirmation_status = 'confirmed'
WHERE confirmation_status = 'registered'
  AND collected_at IS NOT NULL;

-- ---- 3. Allocations table (receipt ⇄ invoices, many-to-many on amount) ----

CREATE TABLE IF NOT EXISTS public.sales_receipt_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id UUID NOT NULL REFERENCES public.sales_receipts(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES public.sales_invoices(id) ON DELETE CASCADE,
    amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sra_receipt_id ON public.sales_receipt_allocations(receipt_id);
CREATE INDEX IF NOT EXISTS idx_sra_invoice_id ON public.sales_receipt_allocations(invoice_id);

ALTER TABLE public.sales_receipt_allocations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE policyname = 'Enable all for all on sales_receipt_allocations'
          AND tablename = 'sales_receipt_allocations'
    ) THEN
        CREATE POLICY "Enable all for all on sales_receipt_allocations"
            ON public.sales_receipt_allocations FOR ALL USING (true);
    END IF;
END $$;

-- Backfill: every existing receipt linked to an invoice becomes a single allocation
INSERT INTO public.sales_receipt_allocations (receipt_id, invoice_id, amount, created_at)
SELECT sr.id, sr.invoice_id, sr.amount, COALESCE(sr.created_at, NOW())
FROM public.sales_receipts sr
WHERE sr.invoice_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM public.sales_receipt_allocations a
      WHERE a.receipt_id = sr.id AND a.invoice_id = sr.invoice_id
  );

-- ---- 4. Helpful view for reconciliation reporting ----

CREATE OR REPLACE VIEW public.v_sales_receipt_reconciliation AS
SELECT
    sr.id,
    sr.receipt_number,
    sr.date,
    sr.customer_id,
    sr.customer_name,
    sr.sales_person_id,
    su.name           AS sales_person_name,
    sr.route_id,
    v.driver_name     AS route_name,
    sr.payment_method,
    sr.amount         AS amount_registered,
    COALESCE(sr.amount_collected, 0) AS amount_confirmed,
    (sr.amount - COALESCE(sr.amount_collected, 0)) AS variance,
    sr.confirmation_status,
    sr.variance_reason,
    sr.registered_by,
    sr.registered_at,
    sr.collected_by   AS confirmed_by,
    sr.collected_at   AS confirmed_at,
    sr.status         AS posting_status,
    sr.notes
FROM public.sales_receipts sr
LEFT JOIN public.system_users su ON su.id = sr.sales_person_id
LEFT JOIN public.vans v          ON v.id  = sr.route_id;

GRANT SELECT ON public.v_sales_receipt_reconciliation TO authenticated;

NOTIFY pgrst, 'reload schema';
