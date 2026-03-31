'use client';

import React from 'react';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import StatCard from '@/components/StatCard';
import Modal from '@/components/Modal';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Plus, ShieldCheck, AlertTriangle, CalendarDays, FileText, Upload, Trash2, Send } from 'lucide-react';
import SendToMDModal from '@/components/SendToMDModal';

const BUCKET = 'compliance-documents';

type RegulatoryDoc = {
  id: string;
  regulator_name: string;
  document_type: string;
  license_number: string | null;
  issue_date: string | null;
  expiry_date: string;
  reminder_days: number;
  file_path: string | null;
  file_name: string | null;
  notes: string | null;
  created_at: string;
};

function daysUntil(date: string) {
  const target = new Date(date);
  const now = new Date();
  target.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  const diff = target.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

async function getFileUrl(path: string) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export default function RegulatorsPage() {
  const [rows, setRows] = React.useState<RegulatoryDoc[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = React.useState(false);

  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<RegulatoryDoc | null>(null);

  const [form, setForm] = React.useState({
    regulator_name: '',
    document_type: '',
    license_number: '',
    issue_date: '',
    expiry_date: '',
    reminder_days: 60,
    notes: '',
  });

  const [file, setFile] = React.useState<File | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('regulatory_documents')
      .select('*')
      .order('expiry_date', { ascending: true });
    setLoading(false);

    if (error) return toast.error(error.message);
    setRows((data as any) || []);
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const dueSoon = rows.filter(r => {
    const d = daysUntil(r.expiry_date);
    return d <= (r.reminder_days || 60);
  });

  const expired = rows.filter(r => daysUntil(r.expiry_date) < 0);

  const openModal = (row?: RegulatoryDoc) => {
    setSelected(row ?? null);
    setForm(row ? {
      regulator_name: row.regulator_name,
      document_type: row.document_type,
      license_number: row.license_number || '',
      issue_date: row.issue_date || '',
      expiry_date: row.expiry_date,
      reminder_days: row.reminder_days || 60,
      notes: row.notes || '',
    } : {
      regulator_name: '',
      document_type: '',
      license_number: '',
      issue_date: '',
      expiry_date: '',
      reminder_days: 60,
      notes: '',
    });
    setFile(null);
    setOpen(true);
  };

  const save = async () => {
    if (!form.regulator_name.trim() || !form.document_type.trim() || !form.expiry_date) {
      return toast.error('Regulator name, document type and expiry date are required');
    }

    setLoading(true);
    try {
      let file_path: string | null = selected?.file_path || null;
      let file_name: string | null = selected?.file_name || null;

      if (file) {
        const path = `regulators/${safeFileName(form.regulator_name)}/${safeFileName(form.document_type)}/${Date.now()}_${safeFileName(file.name)}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
          contentType: file.type || undefined,
          upsert: false,
        });
        if (upErr) throw upErr;
        file_path = path;
        file_name = file.name;
      }

      const payload: any = {
        regulator_name: form.regulator_name.trim(),
        document_type: form.document_type.trim(),
        license_number: form.license_number.trim() || null,
        issue_date: form.issue_date || null,
        expiry_date: form.expiry_date,
        reminder_days: Number(form.reminder_days) || 60,
        notes: form.notes.trim() || null,
        file_path,
        file_name,
        mime_type: file?.type || null,
        file_size: file?.size || null,
      };

      const { error } = selected
        ? await supabase.from('regulatory_documents').update(payload).eq('id', selected.id)
        : await supabase.from('regulatory_documents').insert(payload);

      if (error) throw error;

      toast.success(selected ? 'Updated' : 'Created');
      setOpen(false);
      await refresh();
    } catch (e: any) {
      toast.error(e.message || 'Save failed');
    } finally {
      setLoading(false);
    }
  };

  const remove = async (row: RegulatoryDoc) => {
    if (!confirm('Delete this regulator record?')) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('regulatory_documents').delete().eq('id', row.id);
      if (error) throw error;

      if (row.file_path) {
        const { error: stErr } = await supabase.storage.from(BUCKET).remove([row.file_path]);
        if (stErr) console.warn('[regulatory_documents] storage remove failed', stErr.message);
      }

      toast.success('Deleted');
      await refresh();
    } catch (e: any) {
      toast.error(e.message || 'Delete failed');
    } finally {
      setLoading(false);
    }
  };

  const openFile = async (row: RegulatoryDoc) => {
    if (!row.file_path) return toast.error('No file uploaded');
    const url = await getFileUrl(row.file_path);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const columns = [
    { key: 'regulator_name', label: 'Regulator' },
    { key: 'document_type', label: 'Document' },
    { key: 'license_number', label: 'License No.' },
    {
      key: 'expiry_date',
      label: 'Expiry',
      render: (v: any, row: RegulatoryDoc) => {
        const d = daysUntil(row.expiry_date);
        const color = d < 0 ? 'var(--danger)' : d <= row.reminder_days ? 'var(--amber-700)' : 'var(--slate-700)';
        const txt = d < 0 ? `Expired (${Math.abs(d)}d ago)` : `${row.expiry_date} (${d}d)`;
        return <span style={{ fontWeight: 800, color }}>{txt}</span>;
      }
    },
    { key: 'reminder_days', label: 'Reminder (days)' },
    {
      key: 'file',
      label: 'File',
      render: (_: any, row: RegulatoryDoc) => (
        <button onClick={() => openFile(row)} disabled={!row.file_path} style={{ background: 'none', border: 'none', color: row.file_path ? 'var(--primary-600)' : 'var(--slate-400)', cursor: row.file_path ? 'pointer' : 'not-allowed', fontWeight: 800, fontSize: 12 }}>
          <FileText size={14} style={{ display: 'inline', marginRight: 6 }} /> Open
        </button>
      )
    },
    {
      key: 'actions',
      label: '',
      render: (_: any, row: RegulatoryDoc) => (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={() => openModal(row)} style={actionBtn}>Edit</button>
          <button onClick={() => remove(row)} style={{ ...actionBtn, color: 'var(--danger)' }}>
            <Trash2 size={14} style={{ display: 'inline', marginRight: 6 }} /> Delete
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Regulators & Renewals"
        subtitle="Track regulator permits/licenses and get early renewal prompts"
        breadcrumbs={[{ label: 'Compliance' }, { label: 'Regulators' }]}
        actions={
          <div style={{ display: 'flex', gap: 10 }}>
            <button
                onClick={() => setIsReportModalOpen(true)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 16px',
                    borderRadius: 10,
                    background: 'linear-gradient(135deg, #0f766e, #14b8a6)',
                    color: 'white',
                    fontSize: 13,
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                }}
            >
                <Send size={15} /> Send Weekly Report
            </button>
            <button onClick={() => openModal()} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--primary-600)', color: 'white', fontWeight: 800, cursor: 'pointer' }}>
              <Plus size={16} /> Add Regulator Document
            </button>
          </div>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
        <StatCard title="Total" value={rows.length} icon={<ShieldCheck size={18} />} color="blue" />
        <StatCard title="Due Soon" value={dueSoon.length} icon={<AlertTriangle size={18} />} color="amber" />
        <StatCard title="Expired" value={expired.length} icon={<AlertTriangle size={18} />} color="red" />
        <StatCard title="Next Renewal" value={rows[0]?.expiry_date ? `${daysUntil(rows[0].expiry_date)}d` : '--'} icon={<CalendarDays size={18} />} color="green" />
      </div>

      <DataTable
        columns={columns as any}
        data={rows}
        loading={loading}
      />

      <Modal isOpen={open} onClose={() => setOpen(false)} title={selected ? 'Edit Regulator Document' : 'Add Regulator Document'} size="lg">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Regulator Name">
              <input value={form.regulator_name} onChange={(e) => setForm(p => ({ ...p, regulator_name: e.target.value }))} style={input} />
            </Field>
            <Field label="Document Type">
              <input value={form.document_type} onChange={(e) => setForm(p => ({ ...p, document_type: e.target.value }))} style={input} placeholder="e.g. FDA License" />
            </Field>
            <Field label="License Number (optional)">
              <input value={form.license_number} onChange={(e) => setForm(p => ({ ...p, license_number: e.target.value }))} style={input} />
            </Field>
            <Field label="Reminder Days">
              <input type="number" value={form.reminder_days} onChange={(e) => setForm(p => ({ ...p, reminder_days: Number(e.target.value) }))} style={input} min={1} />
            </Field>
            <Field label="Issue Date (optional)">
              <input type="date" value={form.issue_date} onChange={(e) => setForm(p => ({ ...p, issue_date: e.target.value }))} style={input} />
            </Field>
            <Field label="Expiry Date">
              <input type="date" value={form.expiry_date} onChange={(e) => setForm(p => ({ ...p, expiry_date: e.target.value }))} style={input} />
            </Field>
          </div>

          <Field label="Notes (optional)">
            <input value={form.notes} onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))} style={input} />
          </Field>

          <div style={{ padding: 12, border: '1px dashed var(--slate-200)', borderRadius: 12, background: 'var(--slate-50)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, color: 'var(--slate-800)' }}>
                <Upload size={16} /> Upload License/Permit (optional)
              </div>
              <div style={{ fontSize: 11, color: 'var(--slate-500)' }}>Bucket: {BUCKET}</div>
            </div>
            <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} accept="application/pdf,image/*" style={{ marginTop: 10 }} />
            {selected?.file_name && !file && (
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--slate-600)' }}>
                Current file: <strong>{selected.file_name}</strong>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button onClick={() => setOpen(false)} style={btnSecondary}>Cancel</button>
            <button onClick={save} disabled={loading} style={btnPrimary}>
              {loading ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>

      <SendToMDModal 
          isOpen={isReportModalOpen} 
          onClose={() => setIsReportModalOpen(false)} 
          department="Compliance" 
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--slate-600)', display: 'block', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

const input: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: 10,
  border: '1px solid var(--slate-200)',
  fontSize: 13,
  outline: 'none',
  background: 'white',
};

const actionBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--primary-600)',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 900,
};

const btnPrimary: React.CSSProperties = {
  padding: '10px 18px',
  borderRadius: 10,
  border: 'none',
  background: 'var(--primary-600)',
  color: 'white',
  fontWeight: 900,
  cursor: 'pointer',
};

const btnSecondary: React.CSSProperties = {
  padding: '10px 18px',
  borderRadius: 10,
  border: '1px solid var(--slate-200)',
  background: 'transparent',
  fontWeight: 900,
  cursor: 'pointer',
};
