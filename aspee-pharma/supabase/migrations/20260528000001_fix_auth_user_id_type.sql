-- Fix: system_users.auth_user_id was TEXT but all transactional RPC functions
-- (post_sales_receipt_impl, post_sales_invoice_impl, post_stock_transfer_impl,
-- delete_stock_transfer_impl, post_grn_impl, issue_material_request_impl)
-- declare auth_user_uuid as UUID and compare with =, which PostgreSQL rejects
-- as "operator does not exist: text = uuid".
--
-- Changing the column to UUID fixes every function at once. The cast is safe
-- because all values originate from Supabase Auth (always valid UUID strings).

ALTER TABLE public.system_users
    ALTER COLUMN auth_user_id TYPE uuid USING auth_user_id::uuid;
