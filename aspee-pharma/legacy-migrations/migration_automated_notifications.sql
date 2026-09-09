-- ============================================================
-- Migration: Automated Notifications (DB Triggers)
-- Covers:
--  - Low stock -> Procurement
--  - GRN rejected/quarantined by QA -> Warehouse Manager
--  - Invoice overdue -> Accounts
--  - Credit limit approached -> Sales Manager
--  - Expense pending approval -> Finance
-- ============================================================

-- Safety: ensure notifications table exists (from migration_notifications.sql)

-- ============================================================
-- 1) Low stock -> Procurement
--    Trigger on stock_levels (after insert/update qty_on_hand)
-- ============================================================
CREATE OR REPLACE FUNCTION notify_on_low_stock()
RETURNS TRIGGER AS $$
DECLARE
    prod_name TEXT;
    reorder_lvl INTEGER;
    one_hour_ago TIMESTAMPTZ;
    existing_notification BOOLEAN;
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.qty_on_hand = OLD.qty_on_hand THEN
        RETURN NEW;
    END IF;

    SELECT p.name, COALESCE(p.reorder_level, 0)
      INTO prod_name, reorder_lvl
    FROM products p
    WHERE p.id = NEW.product_id;

    IF prod_name IS NULL OR reorder_lvl <= 0 THEN
        RETURN NEW;
    END IF;

    IF NEW.qty_on_hand <= reorder_lvl THEN
        one_hour_ago := NOW() - INTERVAL '1 hour';

        SELECT EXISTS (
            SELECT 1
            FROM notifications
            WHERE title = 'Low Stock Alert'
              AND message LIKE '%' || prod_name || '%'
              AND created_at >= one_hour_ago
        ) INTO existing_notification;

        IF NOT existing_notification THEN
            INSERT INTO notifications(title, message, type, target_role, link)
            VALUES (
                'Low Stock Alert',
                prod_name || ' is at ' || NEW.qty_on_hand || ' units (reorder level: ' || reorder_lvl || '). Consider placing a purchase order.',
                CASE WHEN NEW.qty_on_hand = 0 THEN 'error' ELSE 'warning' END,
                'Procurement',
                '/stores/stock'
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_low_stock ON stock_levels;
CREATE TRIGGER trg_notify_low_stock
    AFTER INSERT OR UPDATE OF qty_on_hand ON stock_levels
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_low_stock();

-- ============================================================
-- 2) GRN rejected/quarantined by QA -> Warehouse Manager
--    Trigger on grn (after update of qa_status)
-- ============================================================
CREATE OR REPLACE FUNCTION notify_on_grn_qa_result()
RETURNS TRIGGER AS $$
DECLARE
    remarks TEXT;
BEGIN
    IF NEW.qa_status IS DISTINCT FROM OLD.qa_status THEN
        IF NEW.qa_status IN ('Rejected', 'Quarantine') THEN
            remarks := COALESCE(NULLIF(NEW.qa_remarks, ''), NULL);

            INSERT INTO notifications(title, message, type, target_role, link)
            VALUES (
                CASE WHEN NEW.qa_status = 'Rejected' THEN 'GRN Rejected by QA' ELSE 'GRN Sent to Quarantine' END,
                NEW.grn_number || ' has been ' || LOWER(NEW.qa_status) || ' by QA.' || CASE WHEN remarks IS NOT NULL THEN ' Remarks: ' || remarks ELSE '' END,
                CASE WHEN NEW.qa_status = 'Rejected' THEN 'error' ELSE 'warning' END,
                'Warehouse Manager',
                '/purchasing/grn'
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_grn_qa_result ON grn;
CREATE TRIGGER trg_notify_grn_qa_result
    AFTER UPDATE OF qa_status ON grn
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_grn_qa_result();

-- ============================================================
-- 3) Invoice overdue -> Accounts
--    Trigger on sales_invoices (after insert/update of due_date/status)
-- ============================================================
CREATE OR REPLACE FUNCTION notify_on_invoice_overdue()
RETURNS TRIGGER AS $$
DECLARE
    today DATE;
    one_day_ago TIMESTAMPTZ;
    existing_notification BOOLEAN;
BEGIN
    today := CURRENT_DATE;

    -- Only consider active/issued invoices
    IF NEW.status NOT IN ('Issued', 'Partially Paid') THEN
        RETURN NEW;
    END IF;

    IF NEW.due_date IS NULL THEN
        RETURN NEW;
    END IF;

    -- Notify when invoice is already overdue after change, or inserted overdue
    IF NEW.due_date < today THEN
        one_day_ago := NOW() - INTERVAL '1 day';

        SELECT EXISTS (
            SELECT 1
            FROM notifications
            WHERE title = 'Invoice Overdue'
              AND message LIKE '%' || NEW.invoice_number || '%'
              AND created_at >= one_day_ago
        ) INTO existing_notification;

        IF NOT existing_notification THEN
            INSERT INTO notifications(title, message, type, target_role, link)
            VALUES (
                'Invoice Overdue',
                NEW.invoice_number || ' from ' || COALESCE(NEW.customer_name, 'Customer') || ' (GH\u20B5 ' || COALESCE(NEW.total_amount, 0)::TEXT || ') is overdue (Due: ' || NEW.due_date::TEXT || ').',
                'warning',
                'Accounts',
                '/sales/invoices'
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_invoice_overdue ON sales_invoices;
CREATE TRIGGER trg_notify_invoice_overdue
    AFTER INSERT OR UPDATE OF due_date, status ON sales_invoices
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_invoice_overdue();

-- ============================================================
-- 4) Credit limit approached -> Sales Manager
--    Trigger on customers (after update of outstanding_balance/credit_limit)
--    NOTE: Assumes columns: customers.credit_limit, customers.balance
-- ============================================================
CREATE OR REPLACE FUNCTION notify_on_credit_limit_approached()
RETURNS TRIGGER AS $$
DECLARE
    threshold NUMERIC;
    one_hour_ago TIMESTAMPTZ;
    existing_notification BOOLEAN;
BEGIN
    IF NEW.credit_limit IS NULL OR NEW.credit_limit <= 0 THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' AND NEW.balance = OLD.balance AND NEW.credit_limit = OLD.credit_limit THEN
        RETURN NEW;
    END IF;

    threshold := NEW.credit_limit * 0.9; -- 90% threshold

    IF NEW.balance >= threshold THEN
        one_hour_ago := NOW() - INTERVAL '1 hour';

        SELECT EXISTS (
            SELECT 1
            FROM notifications
            WHERE title = 'Credit Limit Approaching'
              AND message LIKE '%' || COALESCE(NEW.name, '') || '%'
              AND created_at >= one_hour_ago
        ) INTO existing_notification;

        IF NOT existing_notification THEN
            INSERT INTO notifications(title, message, type, target_role, link)
            VALUES (
                'Credit Limit Approaching',
                COALESCE(NEW.name, 'Customer') || ' has used GH\u20B5 ' || COALESCE(NEW.balance, 0)::TEXT || ' of GH\u20B5 ' || NEW.credit_limit::TEXT || ' credit limit.',
                CASE WHEN NEW.balance >= NEW.credit_limit THEN 'error' ELSE 'warning' END,
                'Sales Manager',
                '/sales/customers'
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_credit_limit_approached ON customers;
CREATE TRIGGER trg_notify_credit_limit_approached
    AFTER INSERT OR UPDATE OF balance, credit_limit ON customers
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_credit_limit_approached();

-- ============================================================
-- 5) Expense pending approval -> Finance
--    Trigger on expenses (after insert or update status)
--    NOTE: Assumes columns: expenses.expense_number, expenses.amount, expenses.category, expenses.status
-- ============================================================
CREATE OR REPLACE FUNCTION notify_on_expense_pending_approval()
RETURNS TRIGGER AS $$
DECLARE
    one_hour_ago TIMESTAMPTZ;
    existing_notification BOOLEAN;
BEGIN
    IF NEW.status = 'Pending' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
        one_hour_ago := NOW() - INTERVAL '1 hour';

        SELECT EXISTS (
            SELECT 1
            FROM notifications
            WHERE title = 'Expense Pending Approval'
              AND message LIKE '%' || COALESCE(NEW.expense_number, '') || '%'
              AND created_at >= one_hour_ago
        ) INTO existing_notification;

        IF NOT existing_notification THEN
            INSERT INTO notifications(title, message, type, target_role, link)
            VALUES (
                'Expense Pending Approval',
                COALESCE(NEW.expense_number, 'Expense') || ' for GH\u20B5 ' || COALESCE(NEW.amount, 0)::TEXT || ' (' || COALESCE(NEW.category, 'Uncategorized') || ') requires approval.',
                'info',
                'Finance',
                '/accounting/expenses'
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_expense_pending_approval ON expenses;
CREATE TRIGGER trg_notify_expense_pending_approval
    AFTER INSERT OR UPDATE OF status ON expenses
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_expense_pending_approval();
