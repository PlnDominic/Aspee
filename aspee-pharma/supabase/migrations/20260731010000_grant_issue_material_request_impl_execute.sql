-- The original migration (20260525150321) revoked EXECUTE on
-- app_private.issue_material_request_impl from PUBLIC but never granted it
-- back to `authenticated` — unlike every other impl function in this
-- pattern (post_sales_invoice_impl, post_sales_receipt_impl,
-- post_stock_transfer_impl, post_grn_impl all have this grant). Since the
-- public.issue_material_request wrapper is SECURITY INVOKER, the calling
-- role (not an elevated role) needs direct EXECUTE on the impl function it
-- calls internally, causing "permission denied for function
-- issue_material_request_impl".
GRANT EXECUTE ON FUNCTION app_private.issue_material_request_impl(uuid, text, uuid) TO authenticated;
