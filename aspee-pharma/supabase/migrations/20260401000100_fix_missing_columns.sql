-- Fix missing columns on existing tables
-- Addresses: "column route_id does not exist" and related index failures

-- sales_invoices: add columns that only exist in the CREATE TABLE definition
-- (skipped because the table already existed before complete_sales_system migration)
ALTER TABLE public.sales_invoices
  ADD COLUMN IF NOT EXISTS route_id         UUID REFERENCES vans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS salesperson_id   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS due_date         DATE,
  ADD COLUMN IF NOT EXISTS subtotal         DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount  DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_type     TEXT CHECK (payment_type IN ('CASH', 'CREDIT')) DEFAULT 'CREDIT',
  ADD COLUMN IF NOT EXISTS notes            TEXT,
  ADD COLUMN IF NOT EXISTS created_by       UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ DEFAULT now();

-- Now create the indexes safely
CREATE INDEX IF NOT EXISTS idx_sales_invoices_route_id       ON public.sales_invoices(route_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_salesperson_id ON public.sales_invoices(salesperson_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_date           ON public.sales_invoices(date);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_status         ON public.sales_invoices(status);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_payment_type   ON public.sales_invoices(payment_type);

-- requisitions table (may not exist yet)
CREATE TABLE IF NOT EXISTS requisitions (
    id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    requisition_number TEXT UNIQUE NOT NULL,
    salesperson_id     UUID REFERENCES profiles(id) ON DELETE RESTRICT,
    route_id           UUID REFERENCES vans(id) ON DELETE SET NULL,
    status             TEXT CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'FULFILLED')) DEFAULT 'PENDING',
    notes              TEXT,
    created_by         UUID REFERENCES profiles(id),
    created_at         TIMESTAMPTZ DEFAULT now(),
    updated_at         TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_requisitions_salesperson_id ON requisitions(salesperson_id);
CREATE INDEX IF NOT EXISTS idx_requisitions_route_id       ON requisitions(route_id);
CREATE INDEX IF NOT EXISTS idx_requisitions_status         ON requisitions(status);

CREATE TABLE IF NOT EXISTS requisition_items (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    requisition_id      UUID REFERENCES requisitions(id) ON DELETE CASCADE,
    product_id          UUID REFERENCES products(id) ON DELETE RESTRICT,
    quantity_requested  INTEGER NOT NULL CHECK (quantity_requested > 0),
    quantity_approved   INTEGER CHECK (quantity_approved > 0),
    quantity_issued     INTEGER CHECK (quantity_issued > 0),
    notes               TEXT,
    created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_requisition_items_requisition_id ON requisition_items(requisition_id);
CREATE INDEX IF NOT EXISTS idx_requisition_items_product_id     ON requisition_items(product_id);

-- Enable RLS
ALTER TABLE requisitions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE requisition_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'requisitions' AND policyname = 'Enable all on requisitions') THEN
        CREATE POLICY "Enable all on requisitions" ON requisitions FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'requisition_items' AND policyname = 'Enable all on requisition_items') THEN
        CREATE POLICY "Enable all on requisition_items" ON requisition_items FOR ALL USING (true);
    END IF;
END $$;

-- sales_receipts table
CREATE TABLE IF NOT EXISTS sales_receipts (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_number   TEXT UNIQUE NOT NULL,
    invoice_id       UUID REFERENCES sales_invoices(id) ON DELETE CASCADE,
    customer_name    TEXT NOT NULL,
    date             DATE NOT NULL,
    payment_method   TEXT NOT NULL,
    payment_reference TEXT,
    amount           DECIMAL(15,2) NOT NULL,
    currency         TEXT DEFAULT 'GHS',
    notes            TEXT,
    status           TEXT DEFAULT 'Confirmed',
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_receipts_invoice_id      ON sales_receipts(invoice_id);
CREATE INDEX IF NOT EXISTS idx_sales_receipts_date            ON sales_receipts(date);
CREATE INDEX IF NOT EXISTS idx_sales_receipts_payment_method  ON sales_receipts(payment_method);

ALTER TABLE sales_receipts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sales_receipts' AND policyname = 'Enable all for all on sales_receipts') THEN
        CREATE POLICY "Enable all for all on sales_receipts" ON sales_receipts FOR ALL USING (true);
    END IF;
END $$;
