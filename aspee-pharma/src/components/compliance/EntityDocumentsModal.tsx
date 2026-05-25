'use client';

import React from 'react';
import Modal from '@/components/Modal';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Upload, Trash2, FileText, FileCheck, FileX, Shield, Calendar, Hash, File, Image } from 'lucide-react';

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

  const getFileIcon = (mimeType: string | null) => {
    if (!mimeType) return <FileText size={20} style={{ color: '#64748b' }} />;
    if (mimeType.startsWith('image/')) return <Image size={20} style={{ color: '#8b5cf6' }} />;
    if (mimeType === 'application/pdf') return <FileText size={20} style={{ color: '#ef4444' }} />;
    return <File size={20} style={{ color: '#64748b' }} />;
  };

  const isExpired = (expiryDate: string | null) => {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
  };

  return (
    <>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        input:focus, select:focus {
          border-color: var(--primary-400) !important;
          box-shadow: 0 0 0 3px rgba(6, 182, 212, 0.15);
        }
        label:hover > div:first-child {
          border-color: var(--primary-400) !important;
          background: linear-gradient(135deg, #e0f2fe, #dbeafe) !important;
        }
        button:hover {
          transform: translateY(-1px);
        }
      `}</style>
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="lg" noPadding>
      <div style={containerStyle}>
        {/* Upload Section */}
        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>
            <div style={sectionIconStyle}>
              <Upload size={16} />
            </div>
            <span>Upload New Document</span>
          </div>
          
          <div style={formGridStyle}>
            <div>
              <label style={labelStyle}>
                <Hash size={12} /> Document Type
              </label>
              <select 
                value={documentType} 
                onChange={(e) => setDocumentType(e.target.value)} 
                style={selectStyle}
              >
                {allowedDocumentTypes.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>
                <Shield size={12} /> Document Number
              </label>
              <input 
                value={documentNumber} 
                onChange={(e) => setDocumentNumber(e.target.value)} 
                placeholder="e.g. GHA-XXXXXXXXX-X"
                style={inputStyle} 
              />
            </div>
            <div>
              <label style={labelStyle}>
                <Calendar size={12} /> Expiry Date
              </label>
              <input 
                type="date" 
                value={expiryDate} 
                onChange={(e) => setExpiryDate(e.target.value)} 
                style={inputStyle} 
              />
            </div>
            <div>
              <label style={labelStyle}>Notes</label>
              <input 
                value={notes} 
                onChange={(e) => setNotes(e.target.value)} 
                placeholder="Optional notes..."
                style={inputStyle} 
              />
            </div>
          </div>

          <div style={uploadAreaStyle}>
            <input
              type="file"
              id="doc-upload"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              style={{ display: 'none' }}
              accept="application/pdf,image/*"
            />
            <label htmlFor="doc-upload" style={uploadLabelStyle}>
              {file ? (
                <>
                  <div style={filePreviewStyle}>
                    {file.type?.startsWith('image/') ? (
                      <img 
                        src={URL.createObjectURL(file)} 
                        alt="Preview" 
                        style={previewImageStyle}
                      />
                    ) : (
                      <FileText size={32} style={{ color: '#ef4444' }} />
                    )}
                  </div>
                  <div style={fileInfoStyle}>
                    <span style={fileNameStyle}>{file.name}</span>
                    <span style={fileSizeStyle}>{formatBytes(file.size)}</span>
                  </div>
                  <button 
                    type="button"
                    onClick={(e) => { e.preventDefault(); setFile(null); }}
                    style={clearBtnStyle}
                  >
                    ×
                  </button>
                </>
              ) : (
                <>
                  <div style={uploadIconWrapperStyle}>
                    <Upload size={24} />
                  </div>
                  <span style={uploadTextStyle}>Click to upload or drag and drop</span>
                  <span style={uploadHintStyle}>PDF or Images (max 10MB)</span>
                </>
              )}
            </label>
          </div>

          <div style={uploadActionStyle}>
            <button
              onClick={upload}
              disabled={loading || !file}
              style={{
                ...uploadBtnStyle,
                opacity: loading || !file ? 0.6 : 1,
              }}
            >
              {loading ? (
                <>
                  <span style={spinnerStyle} />
                  Saving...
                </>
              ) : (
                <>
                  <Upload size={16} /> Save Document
                </>
              )}
            </button>
            <span style={bucketHintStyle}>
              Storage: <code>{BUCKET}</code>
            </span>
          </div>
        </div>

        {/* Documents List Section */}
        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>
            <div style={sectionIconStyle}>
              <FileCheck size={16} />
            </div>
            <span>Uploaded Documents</span>
            <span style={docCountBadgeStyle}>{docs.length}</span>
            <button onClick={refresh} disabled={loading} style={refreshBtnStyle}>
              ↻ Refresh
            </button>
          </div>

          {docs.length === 0 ? (
            <div style={emptyStateStyle}>
              <FileX size={40} style={{ color: '#cbd5e1' }} />
              <p>No documents uploaded yet</p>
              <span>Upload a document using the form above</span>
            </div>
          ) : (
            <div style={docListStyle}>
              {docs.map((d) => (
                <div key={d.id} style={docCardStyle}>
                  <div style={docCardLeftStyle}>
                    <div style={docIconWrapperStyle}>
                      {getFileIcon(d.mime_type)}
                    </div>
                    <div style={docInfoStyle}>
                      <span style={docTypeStyle}>{d.document_type}</span>
                      <span style={docMetaStyle}>
                        {d.file_name || 'Unnamed file'} • {formatBytes(d.file_size || 0)}
                      </span>
                      {d.document_number && (
                        <span style={docNumberStyle}>
                          <Hash size={10} /> {d.document_number}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div style={docCardRightStyle}>
                    {d.expiry_date && (
                      <span style={{
                        ...expiryBadgeStyle,
                        background: isExpired(d.expiry_date) ? '#fef2f2' : '#f0fdf4',
                        color: isExpired(d.expiry_date) ? '#dc2626' : '#16a34a',
                        borderColor: isExpired(d.expiry_date) ? '#fecaca' : '#bbf7d0',
                      }}>
                        <Calendar size={10} />
                        {d.expiry_date}
                        {isExpired(d.expiry_date) && ' (Expired)'}
                      </span>
                    )}
                    <div style={docActionsStyle}>
                      <button onClick={() => openDoc(d)} style={actionBtnStyle}>
                        <FileText size={14} /> View
                      </button>
                      <button onClick={() => remove(d)} style={deleteBtnStyle}>
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
    </>
  );
}

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
};

const sectionStyle: React.CSSProperties = {
  padding: 20,
  borderBottom: '1px solid var(--slate-100)',
};

const sectionHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  fontSize: 13,
  fontWeight: 700,
  color: 'var(--slate-800)',
  marginBottom: 16,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const sectionIconStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 8,
  background: 'linear-gradient(135deg, var(--primary-600), var(--primary-500))',
  color: 'white',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const formGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 14,
  marginBottom: 16,
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--slate-600)',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: 10,
  border: '1.5px solid var(--slate-200)',
  fontSize: 13,
  outline: 'none',
  background: 'white',
  transition: 'border-color 0.2s, box-shadow 0.2s',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
  appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 12px center',
  paddingRight: 36,
};

const uploadAreaStyle: React.CSSProperties = {
  marginBottom: 16,
};

const uploadLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  padding: '14px 18px',
  border: '2px dashed var(--slate-300)',
  borderRadius: 12,
  background: 'var(--slate-50)',
  cursor: 'pointer',
  transition: 'all 0.2s',
};

const uploadIconWrapperStyle: React.CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: 10,
  background: 'linear-gradient(135deg, #e0f2fe, #bae6fd)',
  color: '#0284c7',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const uploadTextStyle: React.CSSProperties = {
  flex: 1,
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--slate-700)',
};

const uploadHintStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--slate-400)',
};

const filePreviewStyle: React.CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: 8,
  background: 'var(--slate-100)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
};

const previewImageStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
};

const fileInfoStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
};

const fileNameStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--slate-800)',
};

const fileSizeStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--slate-500)',
};

const clearBtnStyle: React.CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: '50%',
  border: 'none',
  background: 'var(--slate-200)',
  color: 'var(--slate-600)',
  fontSize: 16,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const uploadActionStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const uploadBtnStyle: React.CSSProperties = {
  padding: '11px 20px',
  borderRadius: 10,
  border: 'none',
  background: 'linear-gradient(135deg, var(--primary-600), var(--primary-500))',
  color: 'white',
  fontWeight: 600,
  fontSize: 13,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  boxShadow: '0 2px 8px rgba(6,182,212,0.25)',
};

const spinnerStyle: React.CSSProperties = {
  width: 14,
  height: 14,
  borderRadius: '50%',
  border: '2px solid rgba(255,255,255,0.3)',
  borderTopColor: 'white',
  animation: 'spin 0.6s linear infinite',
  display: 'inline-block',
};

const bucketHintStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--slate-400)',
};

const docCountBadgeStyle: React.CSSProperties = {
  marginLeft: 'auto',
  background: 'var(--primary-100)',
  color: 'var(--primary-700)',
  padding: '2px 10px',
  borderRadius: 12,
  fontSize: 11,
  fontWeight: 700,
};

const refreshBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  padding: '4px 10px',
  color: 'var(--primary-600)',
  cursor: 'pointer',
  fontSize: 11,
  fontWeight: 600,
  marginLeft: 8,
};

const emptyStateStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '40px 20px',
  textAlign: 'center',
};

const docListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

const docCardStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  padding: 14,
  borderRadius: 12,
  border: '1px solid var(--slate-200)',
  background: 'white',
  transition: 'box-shadow 0.2s',
};

const docCardLeftStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  flex: 1,
  minWidth: 0,
};

const docIconWrapperStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 10,
  background: 'var(--slate-100)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

const docInfoStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 3,
  minWidth: 0,
};

const docTypeStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: 'var(--slate-800)',
};

const docMetaStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--slate-500)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const docNumberStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--primary-600)',
  fontWeight: 600,
  display: 'flex',
  alignItems: 'center',
  gap: 4,
};

const docCardRightStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  flexShrink: 0,
};

const expiryBadgeStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: '3px 8px',
  borderRadius: 6,
  fontSize: 10,
  fontWeight: 600,
  border: '1px solid',
};

const docActionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
};

const actionBtnStyle: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 8,
  border: '1px solid var(--slate-200)',
  background: 'white',
  color: 'var(--slate-700)',
  fontSize: 11,
  fontWeight: 600,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  transition: 'all 0.2s',
};

const deleteBtnStyle: React.CSSProperties = {
  ...actionBtnStyle,
  borderColor: '#fecaca',
  color: '#dc2626',
  background: '#fef2f2',
};
