-- Add collection fields to sales_receipts
ALTER TABLE public.sales_receipts 
ADD COLUMN IF NOT EXISTS amount_collected DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS collected_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS collected_by UUID REFERENCES public.profiles(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_sales_receipts_collected_by ON public.sales_receipts(collected_by);

-- Comment for documentation
COMMENT ON COLUMN public.sales_receipts.amount_collected IS 'Actual amount received by accountant from salesperson';
COMMENT ON COLUMN public.sales_receipts.collected_at IS 'Timestamp when the accountant verified the collection';
COMMENT ON COLUMN public.sales_receipts.collected_by IS 'Accountant who verified the collection';
