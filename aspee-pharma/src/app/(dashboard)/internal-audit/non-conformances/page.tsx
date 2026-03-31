'use client';

import React, { useState } from 'react';
import DataTable from '@/components/DataTable';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';
import { Plus, AlertTriangle, CheckCircle, Clock, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSupabaseQuery, useDelete } from '@/lib/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Modal from '@/components/Modal';

export default function NonConformancesPage() {
    const { data, isLoading } = useSupabaseQuery<any>('non_conformances', { orderBy: 'raised_date', ascending: false });
    const ncrs = data ?? [];
    const queryClient = useQueryClient();
    const deleteMutation = useDelete('non_conformances');

    const [modalOpen, setModalOpen] = useState(false);
    const [selected, setSelected] = useState<any | null>(null);
    const [form, setForm] = useState({ ncr_number: '', department: '', description: '', root_cause: '', corrective_action: '', raised_date: '', due_date: '', raised_by: '', severity: 'Minor', status: 'Open' });
    const [saving, setSaving] = useState(false);

    const open = (row?: any) => {
        setSelected(row ?? null);
        setForm(row ? { ncr_number: row.ncr_number, department: row.department, description: row.description, root_cause: row.root_cause, corrective_action: row.corrective_action, raised_date: row.raised_date, due_date: row.due_date, raised_by: row.raised_by, severity: row.severity, status: row.status }
            : { ncr_number: '', department: '', description: '', root_cause: '', corrective_action: '', raised_date: '', due_date: '', raised_by: '', severity: 'Minor', status: 'Open' });
        setModalOpen(true);
    };

    const save = async () => {
        if (!form.ncr_number || !form.raised_date) return toast.error('NCR number and date are required');
        setSaving(true);
        const { error } = selected
            ? await supabase.from('non_conformances').update(form).eq('id', selected.id)
            : await supabase.from('non_conformances').insert(form);
        setSaving(false);
        if (error) return toast.error(error.message);
        toast.success(selected ? 'NCR updated' : 'NCR raised');
        queryClient.invalidateQueries({ queryKey: ['non_conformances'] });
        setModalOpen(false);
    };

    const open_ = ncrs.filter((r: any) => r.status === 'Open').length;
    const inProgress_ = ncrs.filter((r: any) => r.status === 'In Progress').length;
    const closed_ = ncrs.filter((r: any) => r.status === 'Closed').length;
    const overdue_ = ncrs.filter((r: any) => {
        if (!r.due_date || r.status === 'Closed') return false;
        return new Date(r.due_date) < new Date();
    }).length;

    const sevVariant = (s: string) => s === 'Critical' ? 'danger' : s === 'Major' ? 'warning' : 'info';

    const columns = [
        { key: 'ncr_number', label: 'NCR #', render: (v: string) => <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{v}</span> },
        { key: 'department', label: 'Department' },
        { key: 'description', label: 'Description', render: (v: string) => <span style={{ maxWidth: 220, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v}</span> },
        { key: 'severity', label: 'Severity', render: (v: string) => <StatusBadge status={v} variant={sevVariant(v)} /> },
        { key: 'raised_date', label: 'Raised' },
        { key: 'due_date', label: 'Due Date' },
        { key: 'raised_by', label: 'Raised By' },
        { key: 'status', label: 'Status', render: (v: string) => <StatusBadge status={v} variant={v === 'Closed' ? 'success' : v === 'In Progress' ? 'info' : 'warning'} /> },
        { key: 'actions', label: '', render: (_: any, row: any) => (
            <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => open(row)} style={{ fontSize: 11, color: 'var(--primary-600)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Edit</button>
                <button onClick={() => deleteMutation.mutate(row.id)} style={{ fontSize: 11, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Delete</button>
            </div>
        )},
    ];

    return (
        <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
                <StatCard title="Open NCRs" value={open_} icon={<AlertTriangle size={18} />} color="red" />
                <StatCard title="In Progress" value={inProgress_} icon={<Clock size={18} />} color="amber" />
                <StatCard title="Overdue" value={overdue_} icon={<XCircle size={18} />} color="red" />
                <StatCard title="Closed" value={closed_} icon={<CheckCircle size={18} />} color="green" />
            </div>

            <DataTable
                columns={columns}
                data={ncrs}
                loading={isLoading}
                actions={
                    <button
                        onClick={() => open()}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                    >
                        <Plus size={16} /> Raise NCR
                    </button>
                }
            />

            <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={selected ? 'Edit NCR' : 'Raise Non-Conformance'} size="md">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        {[
                            { label: 'NCR Number', key: 'ncr_number', type: 'text' },
                            { label: 'Department', key: 'department', type: 'text' },
                            { label: 'Raised By', key: 'raised_by', type: 'text' },
                            { label: 'Raised Date', key: 'raised_date', type: 'date' },
                            { label: 'Due Date', key: 'due_date', type: 'date' },
                        ].map(f => (
                            <div key={f.key}>
                                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-600)', display: 'block', marginBottom: 6 }}>{f.label}</label>
                                <input type={f.type} value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--slate-200)', fontSize: 13, outline: 'none' }} />
                            </div>
                        ))}
                        <div>
                            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-600)', display: 'block', marginBottom: 6 }}>Severity</label>
                            <select value={form.severity} onChange={e => setForm(p => ({ ...p, severity: e.target.value }))}
                                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--slate-200)', fontSize: 13, outline: 'none' }}>
                                {['Minor', 'Major', 'Critical'].map(s => <option key={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>
                    {[
                        { label: 'Description', key: 'description' },
                        { label: 'Root Cause', key: 'root_cause' },
                        { label: 'Corrective Action', key: 'corrective_action' },
                    ].map(f => (
                        <div key={f.key}>
                            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-600)', display: 'block', marginBottom: 6 }}>{f.label}</label>
                            <textarea rows={2} value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--slate-200)', fontSize: 13, outline: 'none', resize: 'vertical' }} />
                        </div>
                    ))}
                    <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-600)', display: 'block', marginBottom: 6 }}>Status</label>
                        <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--slate-200)', fontSize: 13, outline: 'none' }}>
                            {['Open', 'In Progress', 'Closed'].map(s => <option key={s}>{s}</option>)}
                        </select>
                    </div>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                        <button onClick={() => setModalOpen(false)} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid var(--slate-200)', background: 'transparent', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                        <button onClick={save} disabled={saving} style={{ padding: '9px 20px', borderRadius: 8, background: 'var(--primary-600)', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                            {saving ? 'Saving…' : 'Save'}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
