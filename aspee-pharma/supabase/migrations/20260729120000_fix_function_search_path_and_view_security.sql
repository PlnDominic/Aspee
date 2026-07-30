-- ============================================================
-- Migration: Harden function search_path + view security_invoker
--
-- Addresses Supabase database linter warnings:
--   - function_search_path_mutable: these functions had no explicit
--     search_path, so unqualified object references inside them could
--     be hijacked by objects created earlier in whatever search_path
--     the calling role/session happens to have.
--   - security_definer_view: public.v_sales_receipt_reconciliation ran
--     with the view owner's privileges instead of the querying user's.
--
-- Every ALTER is guarded so this migration is safe to re-run and safe
-- against environments where a given function/view doesn't exist.
-- ============================================================

DO $$
DECLARE
    fn text;
    fns text[] := ARRAY[
        'public.update_sales_invoices_updated_at()',
        'public.set_updated_at()',
        'public.update_updated_at_column()',
        'public.update_sales_receipts_updated_at()',
        'public.increment_bank_balance(uuid, numeric)',
        'public.update_petty_cash_updated_at()',
        'public.update_timestamp()',
        'public.update_notifications_updated_at()',
        'public.notify_on_po_approval()',
        'public.set_weekly_reports_updated_at()',
        'public.update_dispatches_updated_at()',
        'public.notify_on_material_request_issued()',
        'public.update_invoice_dispatch_status()',
        'public.check_all_low_stock()',
        'public.notify_on_low_stock()',
        'public.notify_on_invoice_overdue()',
        'public.notify_on_credit_limit_approached()',
        'public.notify_on_expense_pending_approval()',
        'public.notify_on_grn_qa_result()',
        'public.notify_on_production_order_status()',
        'public.notify_on_material_request_issued_v2()',
        'public.notify_on_material_request_created()',
        'public.handle_new_user()'
    ];
BEGIN
    FOREACH fn IN ARRAY fns
    LOOP
        BEGIN
            EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', fn);
        EXCEPTION WHEN undefined_function THEN
            RAISE NOTICE 'Skipping %, function not found', fn;
        END;
    END LOOP;
END $$;

-- app_private helpers: keep both schemas resolvable since some of these
-- functions call sibling app_private functions.
DO $$
DECLARE
    fn text;
    fns text[] := ARRAY[
        'app_private.is_committed_invoice_status(text)',
        'app_private.normalize_invoice_status(text)',
        'app_private.resolve_receipt_payment_account(text)'
    ];
BEGIN
    FOREACH fn IN ARRAY fns
    LOOP
        BEGIN
            EXECUTE format('ALTER FUNCTION %s SET search_path = public, app_private, pg_temp', fn);
        EXCEPTION WHEN undefined_function THEN
            RAISE NOTICE 'Skipping %, function not found', fn;
        END;
    END LOOP;
END $$;

-- v_sales_receipt_reconciliation: run with the querying user's privileges
-- (and their RLS) instead of the view owner's.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.views
        WHERE table_schema = 'public' AND table_name = 'v_sales_receipt_reconciliation'
    ) THEN
        EXECUTE 'ALTER VIEW public.v_sales_receipt_reconciliation SET (security_invoker = true)';
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';
