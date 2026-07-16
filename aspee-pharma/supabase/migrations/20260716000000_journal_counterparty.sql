-- Migration: journal_entries counterparty (customer / vendor) column
--
-- Adds a structured counterparty_name to journal entries so the bank & cash
-- register and the ledgers can show the real party per line, instead of
-- parsing it out of the free-text description.
--
-- Population strategy:
--   * Application code (autoPostJournal.ts) sets counterparty_name directly
--     for supplier payments, expenses and credit notes.
--   * A BEFORE INSERT/UPDATE trigger fills it for entries posted by the
--     invoice / receipt RPCs (and any other path that leaves it null) by
--     matching the deterministic `notes` string back to the source document.
--   * A one-time backfill populates historical rows using the same logic.
--
-- The trigger is exception-safe: any lookup failure leaves counterparty_name
-- null and never blocks a journal posting. The backfill statements are each
-- wrapped so that schema drift in a source table cannot abort the migration.

ALTER TABLE public.journal_entries
    ADD COLUMN IF NOT EXISTS counterparty_name text;

-- ── Derivation trigger ──────────────────────────────────────────────────────
-- SECURITY DEFINER so it can read the source documents regardless of the
-- caller's RLS context (e.g. a manual journal entry from the client).
CREATE OR REPLACE FUNCTION app_private.derive_journal_counterparty()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
    ref   text;
    party text;
BEGIN
    -- Respect an explicitly supplied party (application-provided).
    IF NEW.counterparty_name IS NOT NULL AND btrim(NEW.counterparty_name) <> '' THEN
        RETURN NEW;
    END IF;

    BEGIN
        IF NEW.notes LIKE 'Auto-posted from Sales Invoice %' THEN
            ref := substring(NEW.notes from '^Auto-posted from Sales Invoice (.+)$');
            SELECT customer_name INTO party FROM public.sales_invoices
                WHERE invoice_number = ref LIMIT 1;
        ELSIF NEW.notes LIKE 'Auto-posted from Sales Receipt %' THEN
            ref := substring(NEW.notes from '^Auto-posted from Sales Receipt (.+)$');
            SELECT customer_name INTO party FROM public.sales_receipts
                WHERE receipt_number = ref LIMIT 1;
        ELSIF NEW.notes LIKE 'Auto-posted from Credit Note %' THEN
            ref := substring(NEW.notes from '^Auto-posted from Credit Note (.+)$');
            SELECT customer_name INTO party FROM public.credit_notes
                WHERE credit_note_number = ref LIMIT 1;
        ELSIF NEW.notes LIKE 'Auto-posted from Supplier Payment %' THEN
            ref := substring(NEW.notes from '^Auto-posted from Supplier Payment (.+)$');
            SELECT supplier_name INTO party FROM public.supplier_payments
                WHERE payment_reference = ref LIMIT 1;
        END IF;

        IF party IS NOT NULL AND btrim(party) <> '' THEN
            NEW.counterparty_name := party;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Never let counterparty derivation block a journal posting.
        NULL;
    END;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_derive_journal_counterparty ON public.journal_entries;
CREATE TRIGGER trg_derive_journal_counterparty
    BEFORE INSERT OR UPDATE ON public.journal_entries
    FOR EACH ROW
    EXECUTE FUNCTION app_private.derive_journal_counterparty();

-- ── One-time backfill of historical rows ────────────────────────────────────
-- Each backfill is isolated in a DO block so that a drift-related failure in
-- one source table (e.g. a renamed column) does not abort the whole migration.
DO $$
BEGIN
    UPDATE public.journal_entries je
    SET counterparty_name = si.customer_name
    FROM public.sales_invoices si
    WHERE (je.counterparty_name IS NULL OR btrim(je.counterparty_name) = '')
      AND je.notes = 'Auto-posted from Sales Invoice ' || si.invoice_number;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    UPDATE public.journal_entries je
    SET counterparty_name = sr.customer_name
    FROM public.sales_receipts sr
    WHERE (je.counterparty_name IS NULL OR btrim(je.counterparty_name) = '')
      AND je.notes = 'Auto-posted from Sales Receipt ' || sr.receipt_number;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    UPDATE public.journal_entries je
    SET counterparty_name = cn.customer_name
    FROM public.credit_notes cn
    WHERE (je.counterparty_name IS NULL OR btrim(je.counterparty_name) = '')
      AND je.notes = 'Auto-posted from Credit Note ' || cn.credit_note_number;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    UPDATE public.journal_entries je
    SET counterparty_name = sp.supplier_name
    FROM public.supplier_payments sp
    WHERE (je.counterparty_name IS NULL OR btrim(je.counterparty_name) = '')
      AND je.notes = 'Auto-posted from Supplier Payment ' || sp.payment_reference;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';
