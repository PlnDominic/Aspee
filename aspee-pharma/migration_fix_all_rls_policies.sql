-- ============================================================
-- Bulk RLS Policy Fix — All core application tables
-- Run once in Supabase SQL editor to grant authenticated
-- users full CRUD access on all tables.
-- ============================================================

DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'products',
    'bill_of_materials',
    'bom_items',
    'production_orders',
    'production_order_items',
    'material_requests',
    'material_request_items',
    'stock_levels',
    'stock_movements',
    'stock_locations',
    'stock_transfers',
    'qa_in_process',
    'qa_finished_products',
    'purchase_orders',
    'purchase_order_items',
    'goods_receipts',
    'goods_receipt_items',
    'suppliers',
    'customers',
    'sales_invoices',
    'sales_invoice_items',
    'sales_receipts',
    'credit_notes',
    'dispatches',
    'routes',
    'vans',
    'employees',
    'attendance_records',
    'leave_requests',
    'payroll_records',
    'journal_entries',
    'journal_entry_lines',
    'expenses',
    'tax_periods',
    'petty_cash',
    'internal_audits',
    'audit_reports',
    'non_conformances',
    'weekly_reports',
    'notifications',
    'audit_logs',
    'users'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    -- Skip if table doesn't exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = tbl AND table_schema = 'public') THEN

      -- Drop old policies to avoid duplicates
      EXECUTE format('DROP POLICY IF EXISTS "Allow authenticated select on %I" ON %I', tbl, tbl);
      EXECUTE format('DROP POLICY IF EXISTS "Allow authenticated insert on %I" ON %I', tbl, tbl);
      EXECUTE format('DROP POLICY IF EXISTS "Allow authenticated update on %I" ON %I', tbl, tbl);
      EXECUTE format('DROP POLICY IF EXISTS "Allow authenticated delete on %I" ON %I', tbl, tbl);

      -- Create full-access policies for authenticated users
      EXECUTE format('CREATE POLICY "Allow authenticated select on %I" ON %I FOR SELECT TO authenticated USING (true)', tbl, tbl);
      EXECUTE format('CREATE POLICY "Allow authenticated insert on %I" ON %I FOR INSERT TO authenticated WITH CHECK (true)', tbl, tbl);
      EXECUTE format('CREATE POLICY "Allow authenticated update on %I" ON %I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)', tbl, tbl);
      EXECUTE format('CREATE POLICY "Allow authenticated delete on %I" ON %I FOR DELETE TO authenticated USING (true)', tbl, tbl);

      -- Make sure RLS is enabled
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);

    END IF;
  END LOOP;
END $$;
