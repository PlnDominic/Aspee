-- Ensure storage bucket exists for compliance and Ghana Card uploads.

INSERT INTO storage.buckets (id, name, public)
VALUES ('compliance-documents', 'compliance-documents', false)
ON CONFLICT (id) DO NOTHING;
