'use client';

import React, { useState } from 'react';
import DataTable from '@/components/DataTable';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';
import { Plus, FileText, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSupabaseQuery, useDelete } from '@/lib/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Modal from '@/components/Modal';

export default function AuditReportsPage() {
    const { data, isLoading } = useSupabaseQuery<any>('audit_reports', { orderBy: 'report_date', ascending: false });
    const reports = data ?? [];
    const queryClient = useQueryClient();
    const deleteMutation = useDelete('audit_reports');

    const [modalOpen, setModalOpen] = useState(false);
    const [selected, setSelected] = useState<any | null>(null);
    const [form, setForm] = useState({ report_number: '', audit_area: '', report_date: '', auditor: '', findings: '', recommendation: '', rating: 'Satisfactory', status: 'Draft' });
    const [saving, setSaving] = useState(false);

    const open = (row?: any) => {
        setSelected(row ?? null);
        setForm(row ? { report_number: row.report_number, audit_area: row.audit_area, report_date: row.report_date, auditor: row.auditor, findings: row.findings, recommendation: row.recommendation, rating: row.rating, status: row.status }
            : { report_number: '', audit_area: '', report_date: '', auditor: '', findings: '', recommendation: '', rating: 'Satisfactory', status: 'Draft' });
        setModalOpen(true);
    };

    const save = async () => {
        if (!form.report_number || !form.report_date) return toast.error('Report number and date are required');
        setSaving(true);
        const { error } = selected
            ? await supabase.from('audit_reports').update(form).eq('id', selected.id)
            : await supabase.from('audit_reports').insert(form);
        setSaving(false);
        if (error) return toast.error(error.message);
        toast.success(selected ? 'Report updated' : 'Report created');
        queryClient.invalidateQueries({ queryKey: ['audit_reports'] });
        setModalOpen(false);
    };

    const ratingVariant = (r: string) => r === 'Satisfactory' ? 'success' : r === 'Needs Improvement' ? 'warning' : 'danger';

    const total = reports.length;
    const satisfactory = reports.filter((r: any) => r.rating === 'Satisfactory').length;
    const needsWork = reports.filter((r: any) => r.rating === 'Needs Improvement').length;
    const unsatisfactory = reports.filter((r: any) => r.rating === 'Unsatisfactory').length;

    const columns = [
        { key: 'report_number', label: 'Report #', render: (v: string) => <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{v}</span> },
        { key: 'audit_area', label: 'Audit Area' },
        { key: 'auditor', label: 'Auditor' },
        { key: 'report_date', label: 'Date' },
        { key: 'rating', label: 'Rating', render: (v: string) => <StatusBadge status={v} variant={ratingVariant(v)} /> },
        { key: 'status', label: 'Status', render: (v: string) => <StatusBadge status={v} variant={v === 'Finalised' ? 'success' : 'warning'} /> },
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
                <StatCard title="Total Reports" value={total} icon={<FileText size={18} />} color="blue" />
                <StatCard title="Satisfactory" value={satisfactory} icon={<CheckCircle size={18} />} color="green" />
                <StatCard title="Needs Improvement" value={needsWork} icon={<AlertTriangle size={18} />} color="amber" />
                <StatCard title="Unsatisfactory" value={unsatisfactory} icon={<XCircle size={18} />} color="red" />
            </div>

            <DataTable
                columns={columns}
                data={reports}
                loading={isLoading}
                actions={
                    <button
                        onClick={() => open()}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--primary-600)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                    >
                        <Plus size={16} /> New Report
                    </button>
                }
            />

            <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={selected ? 'Edit Audit Report' : 'New Audit Report'} size="md">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        {[
                            { label: 'Report Number', key: 'report_number', type: 'text' },
                            { label: 'Report Date', key: 'report_date', type: 'date' },
                            { label: 'Audit Area', key: 'audit_area', type: 'text' },
                            { label: 'Auditor', key: 'auditor', type: 'text' },
                        ].map(f => (
                            <div key={f.key}>
                                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-600)', display: 'block', marginBottom: 6 }}>{f.label}</label>
                                <input type={f.type} value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--slate-200)', fontSize: 13, outline: 'none' }} />
                            </div>
                        ))}
                    </div>
                    {[
                        { label: 'Findings', key: 'findings' },
                        { label: 'Recommendations', key: 'recommendation' },
                    ].map(f => (
                        <div key={f.key}>
                            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-600)', display: 'block', marginBottom: 6 }}>{f.label}</label>
                            <textarea rows={3} value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--slate-200)', fontSize: 13, outline: 'none', resize: 'vertical' }} />
                        </div>
                    ))}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-600)', display: 'block', marginBottom: 6 }}>Rating</label>
                            <select value={form.rating} onChange={e => setForm(p => ({ ...p, rating: e.target.value }))}
                                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--slate-200)', fontSize: 13, outline: 'none' }}>
                                {['Satisfactory', 'Needs Improvement', 'Unsatisfactory'].map(s => <option key={s}>{s}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-600)', display: 'block', marginBottom: 6 }}>Status</label>
                            <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--slate-200)', fontSize: 13, outline: 'none' }}>
                                {['Draft', 'Under Review', 'Finalised'].map(s => <option key={s}>{s}</option>)}
                            </select>
                        </div>
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
