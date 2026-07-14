-- Bank accounts table
CREATE TABLE IF NOT EXISTS bank_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_name text NOT NULL,
    short_name text NOT NULL,
    color text NOT NULL DEFAULT '#0369a1',
    balance numeric(15, 2) NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Bank transactions table
CREATE TABLE IF NOT EXISTS bank_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_account_id uuid NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
    type text NOT NULL CHECK (type IN ('deposit', 'withdrawal')),
    amount numeric(15, 2) NOT NULL CHECK (amount > 0),
    description text,
    date date NOT NULL DEFAULT CURRENT_DATE,
    created_by text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read bank_accounts"
    ON bank_accounts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert bank_accounts"
    ON bank_accounts FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update bank_accounts"
    ON bank_accounts FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read bank_transactions"
    ON bank_transactions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert bank_transactions"
    ON bank_transactions FOR INSERT TO authenticated WITH CHECK (true);

-- Seed the 6 banks
INSERT INTO bank_accounts (bank_name, short_name, color) VALUES
    ('Juaben Community Bank', 'JCB', '#16a34a'),
    ('GCB Bank',              'GCB', '#dc2626'),
    ('CAL Bank',              'CAL', '#0369a1'),
    ('Zenith Bank',           'ZBL', '#7c3aed'),
    ('Fidelity Bank',         'FBL', '#b45309'),
    ('Prudential Bank',       'PBL', '#0f766e')
ON CONFLICT DO NOTHING;

-- RPC to safely update balance
CREATE OR REPLACE FUNCTION increment_bank_balance(p_bank_id uuid, p_delta numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE bank_accounts
    SET balance = balance + p_delta, updated_at = now()
    WHERE id = p_bank_id;
END;
$$;
