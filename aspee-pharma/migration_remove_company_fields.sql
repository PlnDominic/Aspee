-- Remove company settings fields from system_users table
-- Run this in Supabase SQL editor

-- Remove company_name column if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'system_users' AND column_name = 'company_name'
  ) THEN
    ALTER TABLE system_users DROP COLUMN company_name;
  END IF;
END $$;

-- Remove currency column if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'system_users' AND column_name = 'currency'
  ) THEN
    ALTER TABLE system_users DROP COLUMN currency;
  END IF;
END $$;

-- Remove timezone column if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'system_users' AND column_name = 'timezone'
  ) THEN
    ALTER TABLE system_users DROP COLUMN timezone;
  END IF;
END $$;

-- Remove date_format column if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'system_users' AND column_name = 'date_format'
  ) THEN
    ALTER TABLE system_users DROP COLUMN date_format;
  END IF;
END $$;

-- Verify remaining columns
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'system_users' 
-- ORDER BY ordinal_position;
