-- Adds an exchange rate to purchase orders so foreign-currency POs (e.g. USD)
-- record the rate used to convert to GH₵ at the time of entry.

ALTER TABLE purchase_orders
    ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(14, 6) NOT NULL DEFAULT 1;
