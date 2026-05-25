-- ASPEE PHARMACEUTICALS - COMPLETE SALES SYSTEM MIGRATION
-- Comprehensive schema for Sales, Customer, Inventory, and Reporting

-- ==========================================
-- 1. ENHANCE EXISTING TABLES
-- ==========================================

-- Enhance customers table with categorization and assignments
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS category TEXT 
    CHECK (category IN ('OTC', 'WHOLESALE_PHARMACY', 'RETAIL_PHARMACY', 'CLINIC', 'HOSPITAL', 'MEDICAL_STORE')),
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS route_id UUID REFERENCES vans(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS salesperson_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS credit_limit DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS balance DECIMAL(12,2) DEFAULT 0;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_customers_category ON customers(category);
CREATE INDEX IF NOT EXISTS idx_customers_route_id ON customers(route_id);
CREATE INDEX IF NOT EXISTS idx_customers_salesperson_id ON customers(salesperson_id);
CREATE INDEX IF NOT EXISTS idx_customers_location ON customers(location);

-- Enhance products table with type categorization
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS product_type TEXT 
    CHECK (product_type IN ('OTHER', 'CONTROL_DRUG')) DEFAULT 'OTHER',
ADD COLUMN IF NOT EXISTS batch_number TEXT,
ADD COLUMN IF NOT EXISTS stock_quantity INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS unit_price DECIMAL(12,2) DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_products_product_type ON products(product_type);
CREATE INDEX IF NOT EXISTS idx_products_batch_number ON products(batch_number);

-- Enhance vans table for proper route management
ALTER TABLE vans 
ADD COLUMN IF NOT EXISTS route_area TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_vans_route_area ON vans(route_area);
CREATE INDEX IF NOT EXISTS idx_vans_is_active ON vans(is_active);

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
CREATE INDEX IF NOT EXISTS idx_sales_invoices_status ON sales_invoices(status);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_payment_type ON sales_invoices(payment_type);

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
CREATE INDEX IF NOT EXISTS idx_sales_invoice_items_batch_number ON sales_invoice_items(batch_number);

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
CREATE INDEX IF NOT EXISTS idx_payment_receipts_payment_date ON payment_receipts(payment_date);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_payment_method ON payment_receipts(payment_method);

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

-- Customer account balances (materialized view for performance)
CREATE MATERIALIZED VIEW IF NOT EXISTS customer_account_balances AS
SELECT 
    c.id as customer_id,
    c.name as customer_name,
    c.category,
    c.location,
    c.route_id,
    c.salesperson_id,
    COALESCE(SUM(CASE WHEN si.status IN ('ISSUED', 'PARTIAL', 'OVERDUE') THEN si.total_amount ELSE 0 END), 0) as total_invoiced,
    COALESCE(SUM(pr.amount_paid), 0) as total_paid,
    COALESCE(SUM(CASE WHEN si.status IN ('ISSUED', 'PARTIAL', 'OVERDUE') THEN si.total_amount ELSE 0 END), 0) - 
    COALESCE(SUM(pr.amount_paid), 0) as outstanding_balance
FROM customers c
LEFT JOIN sales_invoices si ON c.id = si.customer_id
LEFT JOIN payment_receipts pr ON si.id = pr.invoice_id
GROUP BY c.id, c.name, c.category, c.location, c.route_id, c.salesperson_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_account_balances_customer_id ON customer_account_balances(customer_id);

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
CREATE INDEX IF NOT EXISTS idx_requisitions_status ON requisitions(status);

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
CREATE INDEX IF NOT EXISTS idx_requisition_items_product_id ON requisition_items(product_id);

-- ==========================================
-- 5. STOCK TRACKING & INVENTORY
-- ==========================================

-- Stock movements log (for audit trail)
CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
    movement_type TEXT CHECK (movement_type IN ('PURCHASE', 'SALE', 'DAMAGED', 'GIFT', 'RETURN', 'ADJUSTMENT', 'REQUISITION')) NOT NULL,
    quantity_change INTEGER NOT NULL,
    reference_id UUID, -- Can reference invoice_id, requisition_id, etc.
    reference_type TEXT, -- 'INVOICE', 'REQUISITION', 'ADJUSTMENT'
    notes TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_movement_type ON stock_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements(created_at);

-- Current stock snapshot (materialized view)
CREATE MATERIALIZED VIEW IF NOT EXISTS current_stock AS
SELECT 
    p.id as product_id,
    p.name as product_name,
    p.product_type,
    p.batch_number,
    p.stock_quantity,
    p.unit_price,
    p.reorder_level,
    CASE 
        WHEN p.stock_quantity <= p.reorder_level THEN 'LOW'
        WHEN p.stock_quantity > p.reorder_level * 3 THEN 'HIGH'
        ELSE 'NORMAL'
    END as stock_status
FROM products p;

CREATE UNIQUE INDEX IF NOT EXISTS idx_current_stock_product_id ON current_stock(product_id);

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

-- Product sales analysis
CREATE OR REPLACE VIEW product_sales_analysis AS
SELECT 
    p.id as product_id,
    p.name as product_name,
    p.product_type,
    SUM(sii.quantity) as total_quantity_sold,
    SUM(sii.total_price) as total_revenue,
    SUM(CASE WHEN sii.is_damaged THEN sii.quantity ELSE 0 END) as damaged_quantity,
    SUM(CASE WHEN sii.is_gifted THEN sii.quantity ELSE 0 END) as gifted_quantity
FROM products p
LEFT JOIN sales_invoice_items sii ON p.id = sii.product_id
LEFT JOIN sales_invoices si ON sii.invoice_id = si.id
WHERE si.status IN ('ISSUED', 'PAID', 'PARTIAL')
GROUP BY p.id, p.name, p.product_type;

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
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Enable RLS on all new tables
ALTER TABLE sales_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE requisition_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

-- Policies for sales_invoices
CREATE POLICY "Users can view invoices for their route" ON sales_invoices FOR SELECT
    USING (
        auth.uid() IS NOT NULL AND (
            salesperson_id = auth.uid() OR
            route_id IN (SELECT route_id FROM customers WHERE salesperson_id = auth.uid()) OR
            EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Sales Manager', 'Admin'))
        )
    );

CREATE POLICY "Sales managers can manage all invoices" ON sales_invoices FOR ALL
    USING (
        auth.uid() IS NOT NULL AND
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Sales Manager', 'Admin'))
    );

-- Policies for payment_receipts
CREATE POLICY "Users can view payments for their customers" ON payment_receipts FOR SELECT
    USING (
        auth.uid() IS NOT NULL AND (
            invoice_id IN (SELECT id FROM sales_invoices WHERE salesperson_id = auth.uid()) OR
            EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Accountant', 'Admin'))
        )
    );

-- Policies for requisitions
CREATE POLICY "Salespersons can manage their requisitions" ON requisitions FOR ALL
    USING (
        auth.uid() IS NOT NULL AND (
            salesperson_id = auth.uid() OR
            EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Store Manager', 'Admin'))
        )
    );

-- ==========================================
-- 8. FUNCTIONS & TRIGGERS
-- ==========================================

-- Function to update customer balance
CREATE OR REPLACE FUNCTION update_customer_balance()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE customers
    SET balance = (
        SELECT COALESCE(SUM(total_amount), 0) - COALESCE(SUM(amount_paid), 0)
        FROM sales_invoices si
        LEFT JOIN payment_receipts pr ON si.id = pr.invoice_id
        WHERE si.customer_id = NEW.customer_id
    )
    WHERE id = NEW.customer_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update balance on invoice creation/update
DROP TRIGGER IF EXISTS trigger_update_customer_balance_on_invoice ON sales_invoices;
CREATE TRIGGER trigger_update_customer_balance_on_invoice
    AFTER INSERT OR UPDATE ON sales_invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_customer_balance();

-- Trigger to update balance on payment
DROP TRIGGER IF EXISTS trigger_update_customer_balance_on_payment ON payment_receipts;
CREATE TRIGGER trigger_update_customer_balance_on_payment
    AFTER INSERT OR UPDATE ON payment_receipts
    FOR EACH ROW
    EXECUTE FUNCTION update_customer_balance();

-- Function to update stock on sale
CREATE OR REPLACE FUNCTION update_stock_on_sale()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update stock for completed sales
    IF NEW.status IN ('ISSUED', 'PAID', 'PARTIAL') THEN
        INSERT INTO stock_movements (product_id, movement_type, quantity_change, reference_id, reference_type)
        SELECT 
            product_id,
            CASE 
                WHEN is_damaged THEN 'DAMAGED'
                WHEN is_gifted THEN 'GIFT'
                ELSE 'SALE'
            END,
            -quantity,
            NEW.id,
            'INVOICE'
        FROM sales_invoice_items
        WHERE invoice_id = NEW.id;
        
        -- Update product stock quantity
        UPDATE products p
        SET stock_quantity = p.stock_quantity - sii.quantity
        FROM sales_invoice_items sii
        WHERE p.id = sii.product_id AND sii.invoice_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update stock on invoice status change
DROP TRIGGER IF EXISTS trigger_update_stock_on_sale ON sales_invoices;
CREATE TRIGGER trigger_update_stock_on_sale
    AFTER UPDATE OF status ON sales_invoices
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION update_stock_on_sale();

-- ==========================================
-- 9. COMMENTS FOR DOCUMENTATION
-- ==========================================

COMMENT ON TABLE customers IS 'Customer master data with categorization and route assignments';
COMMENT ON TABLE sales_invoices IS 'Sales invoice headers with payment tracking';
COMMENT ON TABLE sales_invoice_items IS 'Line items for sales invoices with batch tracking';
COMMENT ON TABLE payment_receipts IS 'Customer payment records with method tracking';
COMMENT ON TABLE requisitions IS 'Stock requisitions from sales persons to store';
COMMENT ON TABLE stock_movements IS 'Audit trail for all stock changes';
