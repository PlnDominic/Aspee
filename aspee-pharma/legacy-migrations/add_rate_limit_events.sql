-- Generic request-rate tracking for API routes beyond login (send-email,
-- create-user, forgot-password, weekly-report). One row per allowed
-- request per key checked (e.g. a request checked by both user and IP
-- writes two rows). Accessed only via service role key (bypasses RLS).
CREATE TABLE IF NOT EXISTS rate_limit_events (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    route      TEXT        NOT NULL,
    key_type   TEXT        NOT NULL,
    key_value  TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_events_lookup
    ON rate_limit_events (route, key_type, key_value, created_at DESC);

-- Disable RLS — this table is only touched by service-role API routes.
ALTER TABLE rate_limit_events DISABLE ROW LEVEL SECURITY;
