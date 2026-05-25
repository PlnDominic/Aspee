-- ASPEE PHARMACEUTICALS - COMPLETE SALES SYSTEM MIGRATION
-- SIMPLIFIED VERSION - Run in Supabase SQL Editor
-- Copy and paste this entire file into the SQL Editor and execute

-- ==========================================
-- 1. ENHANCE EXISTING TABLES
-- ==========================================

-- Enhance customers table with categorization and assignments
DO $$
BEGIN v
    -- Add columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='customers' AND column_name='category') THEN
        ALTER TABLE customers ADD COLUMN category TEXT 
            CHECK (category IN ('OTC', 'WHOLESALE_PHARMACY', 'RETAIL_PHARMACY', 'CLINIC', 'HOSPITAL', 'MEDICAL_STORE'));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='customers' AND column_name='location') THEN
        ALTER TABLE customers ADD COLUMN location TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='customers' AND column_name='route_id') THEN
        ALTER TABLE customers ADD COLUMN route_id UUID REFERENCES vans(id) ON DELETE SET NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='customers' AND column_name='salesperson_id') THEN
        ALTER TABLE customers ADD COLUMN salesperson_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='customers' AND column_name='balance') THEN
        ALTER TABLE customers ADD COLUMN balance DECIMAL(12,2) DEFAULT 0;
    END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_customers_category ON customers(category);
CREATE INDEX IF NOT EXISTS idx_customers_route_id ON customers(route_id);
CREATE INDEX IF NOT EXISTS idx_customers_salesperson_id ON customers(salesperson_id);

-- Enhance products table with type categorization
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='products' AND column_name='product_type') THEN
        ALTER TABLE products ADD COLUMN product_type TEXT 
            CHECK (product_type IN ('OTHER', 'CONTROL_DRUG')) DEFAULT 'OTHER';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='products' AND column_name='batch_number') THEN
        ALTER TABLE products ADD COLUMN batch_number TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='products' AND column_name='stock_quantity') THEN
        ALTER TABLE products ADD COLUMN stock_quantity INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='products' AND column_name='unit_price') THEN
        ALTER TABLE products ADD COLUMN unit_price DECIMAL(12,2) DEFAULT 0;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_product_type ON products(product_type);

-- ==========================================
-- 2. SALES TRANSACTIONS & INVOICES
-- ==========================================

-- Sales invoices header
CREATE TABLE IF NOT EXISTS sales_invoices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    invoice_number TEXT UNIQUE NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE RESTRICT,
    salesperson_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    route_id UUID REFERENCES vans(id) ON DELETE SET NULL,
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    subtotal DECIMAL(12,2) DEFAULT 0,
    discount_amount DECIMAL(12,2) DEFAULT 0,
    total_amount DECIMAL(12,2) DEFAULT 0,
    payment_type TEXT CHECK (payment_type IN ('CASH', 'CREDIT')) DEFAULT 'CREDIT',
    status TEXT CHECK (status IN ('DRAFT', 'ISSUED', 'PAID', 'PARTIAL', 'OVERDUE', 'CANCELLED')) DEFAULT 'DRAFT',
    notes TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_invoices_customer_id ON sales_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_salesperson_id ON sales_invoices(salesperson_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_route_id ON sales_invoices(route_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_invoice_date ON sales_invoices(invoice_date);

-- Sales invoice items (line items)
CREATE TABLE IF NOT EXISTS sales_invoice_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    invoice_id UUID REFERENCES sales_invoices(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(12,2) NOT NULL CHECK (unit_price >= 0),
    total_price DECIMAL(12,2) NOT NULL CHECK (total_price >= 0),
    batch_number TEXT,
    is_damaged BOOLEAN DEFAULT false,
    is_gifted BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_invoice_items_invoice_id ON sales_invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoice_items_product_id ON sales_invoice_items(product_id);

-- ==========================================
-- 3. PAYMENTS & DEBTORS TRACKING
-- ==========================================

-- Payment receipts
CREATE TABLE IF NOT EXISTS payment_receipts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    receipt_number TEXT UNIQUE NOT NULL,
    invoice_id UUID REFERENCES sales_invoices(id) ON DELETE RESTRICT,
    customer_id UUID REFERENCES customers(id) ON DELETE RESTRICT,
    amount_paid DECIMAL(12,2) NOT NULL CHECK (amount_paid > 0),
    payment_method TEXT CHECK (payment_method IN ('CASH', 'CHEQUE')) DEFAULT 'CASH',
    cheque_number TEXT,
    cheque_bank TEXT,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_receipts_invoice_id ON payment_receipts(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_customer_id ON payment_receipts(customer_id);

-- Normalize legacy schemas where sales/payment tables used customer or customerid
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sales_invoices')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sales_invoices' AND column_name = 'customer_id') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sales_invoices' AND column_name = 'customer') THEN
            ALTER TABLE public.sales_invoices RENAME COLUMN customer TO customer_id;
        ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sales_invoices' AND column_name = 'customerid') THEN
            ALTER TABLE public.sales_invoices RENAME COLUMN customerid TO customer_id;
        ELSE
            ALTER TABLE public.sales_invoices ADD COLUMN customer_id UUID REFERENCES public.customers(id) ON DELETE RESTRICT;
        END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payment_receipts')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payment_receipts' AND column_name = 'customer_id') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payment_receipts' AND column_name = 'customer') THEN
            ALTER TABLE public.payment_receipts RENAME COLUMN customer TO customer_id;
        ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payment_receipts' AND column_name = 'customerid') THEN
            ALTER TABLE public.payment_receipts RENAME COLUMN customerid TO customer_id;
        ELSE
            ALTER TABLE public.payment_receipts ADD COLUMN customer_id UUID REFERENCES public.customers(id) ON DELETE RESTRICT;
        END IF;
    END IF;
END $$;

-- ==========================================
-- 4. REQUISITION SYSTEM
-- ==========================================

-- Requisitions from salesperson to store
CREATE TABLE IF NOT EXISTS requisitions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    requisition_number TEXT UNIQUE NOT NULL,
    salesperson_id UUID REFERENCES profiles(id) ON DELETE RESTRICT,
    route_id UUID REFERENCES vans(id) ON DELETE SET NULL,
    status TEXT CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'FULFILLED')) DEFAULT 'PENDING',
    notes TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_requisitions_salesperson_id ON requisitions(salesperson_id);
CREATE INDEX IF NOT EXISTS idx_requisitions_route_id ON requisitions(route_id);

-- Requisition items
CREATE TABLE IF NOT EXISTS requisition_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    requisition_id UUID REFERENCES requisitions(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
    quantity_requested INTEGER NOT NULL CHECK (quantity_requested > 0),
    quantity_approved INTEGER CHECK (quantity_approved > 0),
    quantity_issued INTEGER CHECK (quantity_issued > 0),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_requisition_items_requisition_id ON requisition_items(requisition_id);

-- ==========================================
-- 5. STOCK TRACKING & INVENTORY
-- ==========================================

-- Stock movements log (for audit trail)
CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
    movement_type TEXT CHECK (movement_type IN ('PURCHASE', 'SALE', 'DAMAGED', 'GIFT', 'RETURN', 'ADJUSTMENT', 'REQUISITION')) NOT NULL,
    quantity_change INTEGER NOT NULL,
    reference_id UUID,
    reference_type TEXT,
    notes TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_movement_type ON stock_movements(movement_type);

-- ==========================================
-- 6. REPORTING VIEWS
-- ==========================================

-- Sales performance by route
CREATE OR REPLACE VIEW sales_by_route AS
SELECT 
    v.id as route_id,
    v.van_id as route_name,
    v.route_area,
    COUNT(DISTINCT si.id) as total_invoices,
    SUM(si.total_amount) as total_sales,
    SUM(CASE WHEN si.payment_type = 'CASH' THEN si.total_amount ELSE 0 END) as cash_sales,
    SUM(CASE WHEN si.payment_type = 'CREDIT' THEN si.total_amount ELSE 0 END) as credit_sales,
    COUNT(DISTINCT si.customer_id) as unique_customers
FROM vans v
LEFT JOIN sales_invoices si ON v.id = si.route_id
WHERE si.status IN ('ISSUED', 'PAID', 'PARTIAL')
GROUP BY v.id, v.van_id, v.route_area;

-- Sales performance by salesperson
CREATE OR REPLACE VIEW sales_by_salesperson AS
SELECT 
    p.id as salesperson_id,
    p.name as salesperson_name,
    p.email,
    COUNT(DISTINCT si.id) as total_invoices,
    SUM(si.total_amount) as total_sales,
    SUM(CASE WHEN si.payment_type = 'CASH' THEN si.total_amount ELSE 0 END) as cash_sales,
    SUM(CASE WHEN si.payment_type = 'CREDIT' THEN si.total_amount ELSE 0 END) as credit_sales,
    COUNT(DISTINCT si.customer_id) as unique_customers
FROM profiles p
LEFT JOIN sales_invoices si ON p.id = si.salesperson_id
WHERE si.status IN ('ISSUED', 'PAID', 'PARTIAL')
GROUP BY p.id, p.name, p.email;

-- Debtors aging report
CREATE OR REPLACE VIEW debtors_aging AS
SELECT 
    c.id as customer_id,
    c.name as customer_name,
    c.category,
    c.location,
    c.route_id,
    c.salesperson_id,
    si.invoice_number,
    si.invoice_date,
    si.total_amount,
    COALESCE(SUM(pr.amount_paid), 0) as amount_paid,
    si.total_amount - COALESCE(SUM(pr.amount_paid), 0) as outstanding_amount,
    CURRENT_DATE - si.invoice_date as days_overdue,
    CASE 
        WHEN CURRENT_DATE - si.invoice_date <= 30 THEN '0-30 Days'
        WHEN CURRENT_DATE - si.invoice_date <= 60 THEN '31-60 Days'
        WHEN CURRENT_DATE - si.invoice_date <= 90 THEN '61-90 Days'
        ELSE '90+ Days'
    END as aging_bucket
FROM customers c
JOIN sales_invoices si ON c.id = si.customer_id
LEFT JOIN payment_receipts pr ON si.id = pr.invoice_id
WHERE si.status IN ('ISSUED', 'PARTIAL', 'OVERDUE')
GROUP BY c.id, c.name, c.category, c.location, c.route_id, c.salesperson_id, si.invoice_number, si.invoice_date, si.total_amount;

-- ==========================================
-- 7. COMMENTS FOR DOCUMENTATION
-- ==========================================

COMMENT ON TABLE customers IS 'Customer master data with categorization and route assignments';
COMMENT ON TABLE sales_invoices IS 'Sales invoice headers with payment tracking';
COMMENT ON TABLE sales_invoice_items IS 'Line items for sales invoices with batch tracking';
COMMENT ON TABLE payment_receipts IS 'Customer payment records with method tracking';
COMMENT ON TABLE requisitions IS 'Stock requisitions from sales persons to store';
COMMENT ON TABLE stock_movements IS 'Audit trail for all stock changes';

-- ==========================================
-- MIGRATION COMPLETE
-- ==========================================

SELECT '✅ Sales System Migration Completed Successfully!' as status;
SELECT 'Tables created/enhanced: customers, products, sales_invoices, sales_invoice_items, payment_receipts, requisitions, stock_movements' as details;
SELECT 'Views created: sales_by_route, sales_by_salesperson, debtors_aging' as reporting;
