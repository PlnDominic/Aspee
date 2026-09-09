-- ============================================================================
-- Row-level follow-up to 20260909000000_role_based_rls_policies.sql.
--
-- That migration granted table-level CRUD per role, matching
-- routePermissions.ts — a big improvement over "everyone, everything," but
-- it doesn't yet stop someone with legitimate write access to a table from
-- deleting/altering a row the app itself would never let them touch through
-- its own UI. This migration closes the gaps that are actually evidenced in
-- the client code — not new, invented business rules — so nothing here
-- should change what any legitimate workflow can currently do; it only
-- closes what a direct Supabase REST call could already bypass.
--
-- Evidence for each rule (grepped from src/, not guessed):
--
--   sales_invoices — src/app/(dashboard)/sales/invoices/page.tsx only shows
--   its Delete button, and only calls handleDeleteInvoice, when
--   normalizeInvoiceStatus(row.status) === 'DRAFT'; the handler itself
--   re-checks and refuses otherwise ("Cannot delete an invoice that has
--   already been issued."). Status values are free-text and get uppercased
--   client-side, so the DB check does the same normalization.
--
--   credit_notes — src/app/(dashboard)/sales/credit-notes/page.tsx only
--   renders its Delete button when row.status === 'Draft' (exact case, no
--   normalization used for this table anywhere in that file).
--
--   requisitions (Sales Requests) — src/app/(dashboard)/sales/requests/page.tsx
--   only renders Edit/Delete when row.status === 'PENDING' (exact case).
--   The Stores-side view of the same table
--   (src/app/(dashboard)/stores/sales-requests/page.tsx) had its Delete
--   button removed entirely in an earlier change, per an explicit request
--   that Store staff should not be able to delete a sales request at all —
--   this migration's requisitions_delete_pending_or_admin policy still lets
--   a Sales-role holder delete their own still-pending request (matching
--   what that page already offers), it just can no longer be done once
--   approved/fulfilled/rejected, from either page or a direct API call.
--
--   journal_entries — grepped across all of src/: no client code anywhere
--   ever calls .update() or .delete() on journal_entries. Every reference
--   is .select() (ledger/reports pages) or .insert() (autoPostJournal.ts,
--   BankReconciliationModal.tsx). The app treats posted GL entries as
--   append-only, which is correct accounting practice (reverse with an
--   offsetting entry, never edit/delete history) — but
--   20260421000100_harden_sensitive_access.sql's journal_entries_accounting_only
--   policy is FOR ALL, so Accountant/Managing Director could currently
--   UPDATE or DELETE any entry directly via the API despite the UI never
--   offering it. Narrowed to Super Admin only for UPDATE/DELETE, as an
--   emergency-correction escape hatch; SELECT/INSERT stay exactly as that
--   migration already set them (not touched here).
--
-- Every rule below also lets Super Admin bypass it — consistent with every
-- other policy in this migration set, and because *some* role needs an
-- escape hatch for a genuine correction (e.g. voiding a wrongly-issued
-- invoice) that the normal workflow doesn't cover.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- sales_invoices — delete only while still Draft (or status not set).
-- ----------------------------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sales_invoices') THEN
        RETURN;
    END IF;

    DROP POLICY IF EXISTS sales_invoices_delete_role ON public.sales_invoices;

    CREATE POLICY sales_invoices_delete_draft_or_admin
    ON public.sales_invoices FOR DELETE TO authenticated
    USING (
        public.app_role_ok(ARRAY['Super Admin'])
        OR (
            public.app_role_ok(ARRAY['Super Admin','Sales Manager','Van Sales Rep','Accountant'])
            AND (status IS NULL OR upper(trim(status)) = 'DRAFT')
        )
    );
END $$;

-- ----------------------------------------------------------------------------
-- credit_notes — delete only while still Draft.
-- ----------------------------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'credit_notes') THEN
        RETURN;
    END IF;

    DROP POLICY IF EXISTS credit_notes_delete_role ON public.credit_notes;

    CREATE POLICY credit_notes_delete_draft_or_admin
    ON public.credit_notes FOR DELETE TO authenticated
    USING (
        public.app_role_ok(ARRAY['Super Admin'])
        OR (
            public.app_role_ok(ARRAY['Super Admin','Sales Manager','Van Sales Rep','Accountant'])
            AND status = 'Draft'
        )
    );
END $$;

-- ----------------------------------------------------------------------------
-- requisitions — delete only while still Pending.
-- ----------------------------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'requisitions') THEN
        RETURN;
    END IF;

    DROP POLICY IF EXISTS requisitions_delete_role ON public.requisitions;

    CREATE POLICY requisitions_delete_pending_or_admin
    ON public.requisitions FOR DELETE TO authenticated
    USING (
        public.app_role_ok(ARRAY['Super Admin'])
        OR (
            public.app_role_ok(ARRAY['Sales Manager','Van Sales Rep','Store Manager','Accountant'])
            AND status = 'PENDING'
        )
    );
END $$;

-- ----------------------------------------------------------------------------
-- journal_entries — append-only in practice. Narrow UPDATE/DELETE to Super
-- Admin only; SELECT/INSERT keep the exact same roles
-- 20260421000100_harden_sensitive_access.sql already granted them.
-- ----------------------------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'journal_entries') THEN
        RETURN;
    END IF;

    DROP POLICY IF EXISTS journal_entries_accounting_only ON public.journal_entries;

    CREATE POLICY journal_entries_select_accounting
    ON public.journal_entries FOR SELECT TO authenticated
    USING (public.has_any_app_role(ARRAY['Super Admin','Managing Director','Accountant']));

    CREATE POLICY journal_entries_insert_accounting
    ON public.journal_entries FOR INSERT TO authenticated
    WITH CHECK (public.has_any_app_role(ARRAY['Super Admin','Managing Director','Accountant']));

    CREATE POLICY journal_entries_update_admin_only
    ON public.journal_entries FOR UPDATE TO authenticated
    USING (public.has_any_app_role(ARRAY['Super Admin']))
    WITH CHECK (public.has_any_app_role(ARRAY['Super Admin']));

    CREATE POLICY journal_entries_delete_admin_only
    ON public.journal_entries FOR DELETE TO authenticated
    USING (public.has_any_app_role(ARRAY['Super Admin']));
END $$;

-- ----------------------------------------------------------------------------
-- Deliberately NOT touched in this pass (no existing app-layer rule found to
-- mirror — restricting these now would be inventing policy, not closing an
-- evidenced gap):
--
--   purchase_orders — its Delete button has no status gate anywhere in
--   src/app/(dashboard)/purchasing/purchase-orders/page.tsx; unclear whether
--   that's intentional or its own pre-existing gap. Worth asking whoever
--   owns that workflow before restricting it.
--
--   sales_receipts — deletion goes through the delete_sales_receipt() RPC
--   (not a raw table delete), which likely already runs its own checks as
--   a SECURITY DEFINER function whose source isn't in this repo's tracked
--   migrations. Narrowing the raw table's DELETE policy here risks
--   breaking that RPC if it executes with the caller's own privileges
--   rather than bypassing RLS — needs the RPC's actual definition checked
--   first, not a guess.
-- ----------------------------------------------------------------------------
