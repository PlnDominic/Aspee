-- Brute-force protection: tracks login attempts per email and IP address.
-- Accessed only via service role key (bypasses RLS).
CREATE TABLE IF NOT EXISTS login_attempts (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email        TEXT        NOT NULL,
    ip_address   TEXT        NOT NULL,
    success      BOOLEAN     NOT NULL DEFAULT false,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_agent   TEXT
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_email_time
    ON login_attempts (email, attempted_at DESC);

CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time
    ON login_attempts (ip_address, attempted_at DESC);

-- Disable RLS — this table is only touched by service-role API routes.
ALTER TABLE login_attempts DISABLE ROW LEVEL SECURITY;
