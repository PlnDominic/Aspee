-- ============================================================
-- Migration: Fix schema cache relationships
--
-- Problems fixed:
-- 1. sales_receipts missing invoice_number column
-- 2. credit_notes missing invoice_id FK to sales_invoices
-- 3. PostgREST schema cache not seeing FK relationships
-- ============================================================

-- ---- sales_receipts fixes ----

ALTER TABLE public.sales_receipts
ADD COLUMN IF NOT EXISTS invoice_number TEXT;

UPDATE public.sales_receipts sr
SET invoice_number = si.invoice_number
FROM public.sales_invoices si
WHERE sr.invoice_id::uuid = si.id
  AND sr.invoice_number IS NULL;

CREATE INDEX IF NOT EXISTS idx_sales_receipts_invoice_number
ON public.sales_receipts(invoice_number);

-- ---- credit_notes fixes ----

ALTER TABLE public.credit_notes
ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.sales_invoices(id) ON DELETE SET NULL;

ALTER TABLE public.credit_notes
ADD COLUMN IF NOT EXISTS cn_number TEXT,
ADD COLUMN IF NOT EXISTS reason TEXT,
ADD COLUMN IF NOT EXISTS amount DECIMAL(15,2);

CREATE INDEX IF NOT EXISTS idx_credit_notes_invoice_id
ON public.credit_notes(invoice_id);

-- Force PostgREST to reload schema cache so it sees all FK relationships
NOTIFY pgrst, 'reload schema';
