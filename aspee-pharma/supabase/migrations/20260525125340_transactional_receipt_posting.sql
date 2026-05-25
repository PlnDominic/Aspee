CREATE SCHEMA IF NOT EXISTS app_private;

ALTER TABLE public.sales_receipts
    ADD COLUMN IF NOT EXISTS invoice_number text,
    ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_sales_receipts_invoice_number
ON public.sales_receipts(invoice_number);

CREATE OR REPLACE FUNCTION app_private.resolve_receipt_payment_account(payment_method_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE WHEN coalesce(payment_method_value, '') = 'Cash' THEN 'Petty Cash' ELSE 'Cash at Bank' END;
$$;

CREATE OR REPLACE FUNCTION app_private.post_receipt_journal(
    receipt_label text,
    customer_label text,
    invoice_label text,
    receipt_date date,
    receipt_amount numeric,
    payment_method_value text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
    journal_notes text;
    journal_number text;
BEGIN
    IF coalesce(receipt_amount, 0) <= 0 THEN
        RETURN;
    END IF;

    journal_notes := 'Auto-posted from Sales Receipt ' || coalesce(receipt_label, '-');

    UPDATE public.journal_entries
    SET date = coalesce(receipt_date, current_date),
        description = 'Payment from ' || coalesce(customer_label, 'Customer') || ' - Inv ' || coalesce(invoice_label, '-'),
        debit_account = app_private.resolve_receipt_payment_account(payment_method_value),
        debit_amount = abs(receipt_amount),
        credit_account = 'Accounts Receivable',
        credit_amount = abs(receipt_amount)
    WHERE notes = journal_notes;

    IF FOUND THEN
        RETURN;
    END IF;

    journal_number := 'RCT-' || to_char(now(), 'YYMM') || '-' || floor(1000 + random() * 9000)::text;

    INSERT INTO public.journal_entries (
        entry_number,
        date,
        description,
        ref_type,
        debit_account,
        debit_amount,
        credit_account,
        credit_amount,
        created_by,
        notes
    )
    VALUES (
        journal_number,
        coalesce(receipt_date, current_date),
        'Payment from ' || coalesce(customer_label, 'Customer') || ' - Inv ' || coalesce(invoice_label, '-'),
        'Sales',
        app_private.resolve_receipt_payment_account(payment_method_value),
        abs(receipt_amount),
        'Accounts Receivable',
        abs(receipt_amount),
        'System',
        journal_notes
    );
END;
$$;

CREATE OR REPLACE FUNCTION app_private.post_sales_receipt_impl(
    auth_user_uuid uuid,
    auth_email text,
    receipt_payload jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
    app_user record;
    receipt_uuid uuid;
    invoice_uuid uuid;
    invoice_row record;
    receipt_amount numeric;
    total_paid_excluding_current numeric;
    total_paid numeric;
    new_invoice_status text;
    inserted_receipt_id uuid;
BEGIN
    IF auth_user_uuid IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT id, role, status
    INTO app_user
    FROM public.system_users
    WHERE auth_user_id = auth_user_uuid
       OR lower(email) = lower(coalesce(auth_email, ''))
    ORDER BY CASE WHEN auth_user_id = auth_user_uuid THEN 0 ELSE 1 END
    LIMIT 1;

    IF app_user.id IS NULL THEN
        RAISE EXCEPTION 'System user profile was not found.';
    END IF;

    IF app_user.status IS NOT NULL AND app_user.status <> 'Active' THEN
        RAISE EXCEPTION 'Your account is inactive.';
    END IF;

    IF coalesce(app_user.role, '') NOT IN ('Super Admin', 'Managing Director', 'Accountant', 'Sales Manager', 'Van Sales Rep') THEN
        RAISE EXCEPTION 'Insufficient permissions to post sales receipts.';
    END IF;

    receipt_uuid := nullif(receipt_payload->>'id', '')::uuid;
    invoice_uuid := nullif(receipt_payload->>'invoice_id', '')::uuid;
    receipt_amount := coalesce(nullif(receipt_payload->>'amount', '')::numeric, 0);

    IF invoice_uuid IS NULL THEN
        RAISE EXCEPTION 'Receipt must be linked to an invoice.';
    END IF;

    IF receipt_amount <= 0 THEN
        RAISE EXCEPTION 'Receipt amount must be greater than zero.';
    END IF;

    SELECT id, invoice_number, customer_name, total_amount, status
    INTO invoice_row
    FROM public.sales_invoices
    WHERE id = invoice_uuid
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invoice was not found.';
    END IF;

    SELECT coalesce(sum(amount), 0)
    INTO total_paid_excluding_current
    FROM public.sales_receipts
    WHERE invoice_id = invoice_uuid
      AND coalesce(status, '') NOT IN ('VOID', 'Void', 'CANCELLED', 'Cancelled')
      AND (receipt_uuid IS NULL OR id <> receipt_uuid);

    IF total_paid_excluding_current + receipt_amount > coalesce(invoice_row.total_amount, 0) THEN
        RAISE EXCEPTION 'Amount exceeds outstanding balance. Outstanding %, received %.',
            greatest(coalesce(invoice_row.total_amount, 0) - total_paid_excluding_current, 0),
            receipt_amount;
    END IF;

    IF receipt_uuid IS NOT NULL THEN
        UPDATE public.sales_receipts
        SET receipt_number = receipt_payload->>'receipt_number',
            invoice_id = invoice_uuid,
            invoice_number = coalesce(receipt_payload->>'invoice_number', invoice_row.invoice_number),
            customer_name = coalesce(receipt_payload->>'customer_name', invoice_row.customer_name),
            date = coalesce(nullif(receipt_payload->>'date', '')::date, current_date),
            payment_method = receipt_payload->>'payment_method',
            payment_reference = nullif(receipt_payload->>'payment_reference', ''),
            amount = receipt_amount,
            notes = receipt_payload->>'notes',
            status = coalesce(nullif(receipt_payload->>'status', ''), 'Confirmed'),
            updated_at = now()
        WHERE id = receipt_uuid
        RETURNING id INTO inserted_receipt_id;

        IF inserted_receipt_id IS NULL THEN
            RAISE EXCEPTION 'Receipt was not found.';
        END IF;
    ELSE
        INSERT INTO public.sales_receipts (
            receipt_number,
            invoice_id,
            invoice_number,
            customer_name,
            date,
            payment_method,
            payment_reference,
            amount,
            notes,
            status,
            created_at,
            updated_at
        )
        VALUES (
            receipt_payload->>'receipt_number',
            invoice_uuid,
            coalesce(receipt_payload->>'invoice_number', invoice_row.invoice_number),
            coalesce(receipt_payload->>'customer_name', invoice_row.customer_name),
            coalesce(nullif(receipt_payload->>'date', '')::date, current_date),
            receipt_payload->>'payment_method',
            nullif(receipt_payload->>'payment_reference', ''),
            receipt_amount,
            receipt_payload->>'notes',
            coalesce(nullif(receipt_payload->>'status', ''), 'Confirmed'),
            now(),
            now()
        )
        RETURNING id INTO inserted_receipt_id;
    END IF;

    total_paid := total_paid_excluding_current + receipt_amount;
    new_invoice_status := CASE
        WHEN total_paid >= coalesce(invoice_row.total_amount, 0) THEN 'PAID'
        ELSE 'PARTIAL'
    END;

    UPDATE public.sales_invoices
    SET status = new_invoice_status,
        updated_at = now()
    WHERE id = invoice_uuid;

    PERFORM app_private.post_receipt_journal(
        receipt_payload->>'receipt_number',
        coalesce(receipt_payload->>'customer_name', invoice_row.customer_name),
        coalesce(receipt_payload->>'invoice_number', invoice_row.invoice_number),
        coalesce(nullif(receipt_payload->>'date', '')::date, current_date),
        receipt_amount,
        receipt_payload->>'payment_method'
    );

    RETURN inserted_receipt_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.post_sales_receipt(receipt_payload jsonb)
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, app_private
AS $$
    SELECT app_private.post_sales_receipt_impl(
        auth.uid(),
        lower(coalesce(auth.jwt() ->> 'email', '')),
        receipt_payload
    );
$$;

REVOKE ALL ON FUNCTION app_private.post_sales_receipt_impl(uuid, text, jsonb) FROM PUBLIC;
GRANT USAGE ON SCHEMA app_private TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.post_sales_receipt_impl(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.post_sales_receipt(jsonb) TO authenticated;
