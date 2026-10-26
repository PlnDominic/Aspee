-- The previous migration (20261013000000_immutable_invoices_button_permissions.sql)
-- added triggers that permanently lock an invoice the moment its status
-- leaves DRAFT. In practice every invoice is created directly as ISSUED
-- (InvoiceModal has no draft step), so that trigger made every invoice
-- permanently uneditable from the moment it was created — including to fix
-- a typo seconds later.
--
-- What's actually wanted: Edit/Delete should stay available, limited by a
-- configurable number of days (Settings -> User Management -> Edit Window
-- Override, role default otherwise) — which already exists and is already
-- enforced:
--   - Edit goes through the post_sales_invoice RPC, which already calls
--     app_private.within_edit_window(previous_date) — see
--     20260927000001_enforce_edit_window_in_rpcs.sql.
--   - Delete goes straight to the sales_invoices / sales_invoice_items
--     tables, which already carry a RESTRICTIVE RLS policy built from the
--     same app_private.within_edit_window() — see
--     20260927000000_user_module_permissions.sql
--     (public._set_edit_window_guard('sales_invoices', ...) and
--     ('sales_invoice_items', ...)).
--
-- So the hard DRAFT-only trigger is redundant with, and stricter than, the
-- day-window system already in place. Drop it; the button-permission table
-- from that same migration (user_button_permissions) is unrelated and stays.

DROP TRIGGER IF EXISTS guard_issued_invoice_update ON public.sales_invoices;
DROP FUNCTION IF EXISTS public.guard_issued_invoice_update();

DROP TRIGGER IF EXISTS guard_issued_invoice_items_insert_update ON public.sales_invoice_items;
DROP FUNCTION IF EXISTS public.guard_issued_invoice_items();
