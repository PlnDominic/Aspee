-- Store official finished-goods cash and credit prices separately.

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS cash_price DECIMAL(12,2),
    ADD COLUMN IF NOT EXISTS credit_price DECIMAL(12,2);
