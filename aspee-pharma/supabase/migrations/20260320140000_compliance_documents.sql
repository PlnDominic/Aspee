-- Compliance Documents & Regulatory Renewals
-- Creates generic document table for customers/employees and a regulators table with expiry/reminder.

-- 1) Generic entity documents (customers + employees)
CREATE TABLE IF NOT EXISTS entity_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('customer', 'employee')),
  entity_id UUID NOT NULL,
  document_type TEXT NOT NULL,
  document_number TEXT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NULL,
  mime_type TEXT NULL,
  file_size BIGINT NULL,
  expiry_date DATE NULL,
  notes TEXT NULL,
  uploaded_by UUID NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entity_documents_entity ON entity_documents(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_documents_expiry ON entity_documents(expiry_date);

-- 2) Regulators / regulatory documents with renewals
CREATE TABLE IF NOT EXISTS regulatory_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  regulator_name TEXT NOT NULL,
  document_type TEXT NOT NULL,
  license_number TEXT NULL,
  issue_date DATE NULL,
  expiry_date DATE NOT NULL,
  reminder_days INTEGER NOT NULL DEFAULT 60,
  file_path TEXT NULL,
  file_name TEXT NULL,
  mime_type TEXT NULL,
  file_size BIGINT NULL,
  notes TEXT NULL,
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_regulatory_documents_expiry ON regulatory_documents(expiry_date);

-- update trigger for updated_at
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_regulatory_documents_updated_at ON regulatory_documents;
CREATE TRIGGER trg_regulatory_documents_updated_at
BEFORE UPDATE ON regulatory_documents
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- NOTE: RLS / policies are not included here because existing project policy strategy varies.
-- Apply RLS in Supabase dashboard as needed (typically allow authenticated users with roles).
