'use client';

import React from 'react';
import Modal from '@/components/Modal';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Upload, Trash2, FileText } from 'lucide-react';

type EntityType = 'customer' | 'employee';

type EntityDocumentRow = {
  id: string;
  entity_type: EntityType;
  entity_id: string;
  document_type: string;
  document_number: string | null;
  file_path: string;
  file_name: string | null;
  mime_type: string | null;
  file_size: number | null;
  expiry_date: string | null;
  notes: string | null;
  uploaded_at: string;
};

const BUCKET = 'compliance-documents';

function formatBytes(bytes: number) {
  if (!bytes && bytes !== 0) return '--';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function getFileUrl(path: string) {
  // Prefer signed URLs (works for private buckets too). If bucket is public, signed URLs still work.
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}

export default function EntityDocumentsModal(props: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  entityType: EntityType;
  entityId: string;
  allowedDocumentTypes: { label: string; value: string; allowMultiple?: boolean }[];
}) {
  const { isOpen, onClose, title, entityType, entityId, allowedDocumentTypes } = props;

  const [loading, setLoading] = React.useState(false);
  const [docs, setDocs] = React.useState<EntityDocumentRow[]>([]);

  const [documentType, setDocumentType] = React.useState(allowedDocumentTypes[0]?.value || '');
  const [documentNumber, setDocumentNumber] = React.useState('');
  const [expiryDate, setExpiryDate] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [file, setFile] = React.useState<File | null>(null);

  const refresh = React.useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('entity_documents')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('uploaded_at', { ascending: false });

    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDocs((data as any) || []);
  }, [entityId, entityType]);

  React.useEffect(() => {
    if (isOpen) refresh();
  }, [isOpen, refresh]);

  const upload = async () => {
    if (!file) return toast.error('Please select a file');
    if (!documentType) return toast.error('Please select a document type');

    // if not allowMultiple and there is an existing doc for that type, block (forces replacement by deleting first)
    const def = allowedDocumentTypes.find(d => d.value === documentType);
    if (def && !def.allowMultiple) {
      const existing = docs.filter(d => d.document_type === documentType);
      if (existing.length > 0) {
        return toast.error('A document of this type already exists. Delete it first to replace.');
      }
    }

    setLoading(true);
    try {
      const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
      const path = `${entityType}/${entityId}/${documentType}/${Date.now()}_${safeFileName(file.name)}`;

      const { error: upErr } = await supabase
        .storage
        .from(BUCKET)
        .upload(path, file, {
          contentType: file.type || undefined,
          upsert: false,
        });

      if (upErr) throw upErr;

      const { error: dbErr } = await supabase
        .from('entity_documents')
        .insert({
          entity_type: entityType,
          entity_id: entityId,
          document_type: documentType,
          document_number: documentNumber.trim() || null,
          expiry_date: expiryDate || null,
          notes: notes.trim() || null,
          file_path: path,
          file_name: file.name,
          mime_type: file.type || null,
          file_size: file.size || null,
        });

      if (dbErr) throw dbErr;

      toast.success('Document uploaded');
      setFile(null);
      setDocumentNumber('');
      setExpiryDate('');
      setNotes('');
      await refresh();
    } catch (e: any) {
      toast.error(e.message || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const remove = async (row: EntityDocumentRow) => {
    if (!confirm('Delete this document?')) return;
    setLoading(true);
    try {
      const { error: dbErr } = await supabase.from('entity_documents').delete().eq('id', row.id);
      if (dbErr) throw dbErr;

      const { error: stErr } = await supabase.storage.from(BUCKET).remove([row.file_path]);
      if (stErr) {
        // non-fatal; DB already deleted
        console.warn('[entity_documents] storage remove failed', stErr.message);
      }

      toast.success('Deleted');
      await refresh();
    } catch (e: any) {
      toast.error(e.message || 'Delete failed');
    } finally {
      setLoading(false);
    }
  };

  const openDoc = async (row: EntityDocumentRow) => {
    try {
      const url = await getFileUrl(row.file_path);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e: any) {
      toast.error(e.message || 'Unable to open');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="lg">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
        {/* Upload */}
        <div style={{ padding: 14, border: '1px solid var(--slate-200)', borderRadius: 12, background: 'var(--slate-50)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Document Type</label>
              <select value={documentType} onChange={(e) => setDocumentType(e.target.value)} style={inputStyle}>
                {allowedDocumentTypes.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Document Number (optional)</label>
              <input value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Expiry Date (optional)</label>
              <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Notes (optional)</label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} style={inputStyle} />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              style={{ flex: 1 }}
              accept="application/pdf,image/*"
            />
            <button
              onClick={upload}
              disabled={loading}
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                border: 'none',
                background: 'var(--primary-600)',
                color: 'white',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                opacity: loading ? 0.7 : 1,
              }}
            >
              <Upload size={16} /> Upload
            </button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--slate-500)', marginTop: 8 }}>
            Allowed: PDF / images. Storage bucket: <span style={{ fontFamily: 'var(--font-mono)' }}>{BUCKET}</span>
          </div>
        </div>

        {/* List */}
        <div style={{ padding: 14, border: '1px solid var(--slate-200)', borderRadius: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--slate-900)' }}>Uploaded Documents</h3>
            <button onClick={refresh} disabled={loading} style={linkBtnStyle}>Refresh</button>
          </div>

          {docs.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--slate-500)' }}>No documents uploaded yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {docs.map((d) => (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: 10, borderRadius: 10, border: '1px solid var(--slate-200)', background: 'white' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <FileText size={18} />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 800, fontSize: 12, color: 'var(--slate-900)' }}>{d.document_type}</span>
                      <span style={{ fontSize: 11, color: 'var(--slate-500)' }}>
                        {(d.file_name || 'file')} • {formatBytes(d.file_size || 0)}
                        {d.expiry_date ? ` • Exp: ${d.expiry_date}` : ''}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <button onClick={() => openDoc(d)} style={linkBtnStyle}>Open</button>
                    <button onClick={() => remove(d)} style={{ ...linkBtnStyle, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: 'var(--slate-600)',
  display: 'block',
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: 8,
  border: '1px solid var(--slate-200)',
  fontSize: 13,
  outline: 'none',
  background: 'white',
};

const linkBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  padding: 0,
  color: 'var(--primary-600)',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 800,
};
