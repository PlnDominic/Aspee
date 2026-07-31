-- Lets a Replenishment voucher record how the float was topped up — a direct
-- bank transfer (which now posts DR Petty Cash / CR Cash at Bank to the GL)
-- versus a plain cash top-up (no GL movement, matching prior behavior).
ALTER TABLE public.petty_cash
    ADD COLUMN IF NOT EXISTS funding_source text;

NOTIFY pgrst, 'reload schema';
