'use client';

import React, { useState } from 'react';
import DataTable from '@/components/DataTable';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';
import { Plus, CalendarDays, Clock, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSupabaseQuery, useDelete } from '@/lib/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Modal from '@/components/Modal';

export default function LeaveManagementPage() {
    const { data, isLoading } = useSupabaseQuery<any>('leave_requests', { orderBy: 'start_date', ascending: false });
    const requests = data ?? [];
    const queryClient = useQueryClient();
    const deleteMutation = useDelete('leave_requests');

    const [modalOpen, setModalOpen] = useState(false);
    const [selected, setSelected] = useState<any | null>(null);
    const [form, setForm] = useState({ employee_id: '', employee_name: '', leave_type: 'Annual', start_date: '', end_date: '', days: '', reason: '', status: 'Pending', approved_by: '' });
    const [saving, setSaving] = useState(false);

    const open = (row?: any) => {
        setSelected(row ?? null);
        setForm(row ? { employee_id: row.employee_id, employee_name: row.employee_name, leave_type: row.leave_type, start_date: row.start_date, end_date: row.end_date, days: row.days, reason: row.reason, status: row.status, approved_by: row.approved_by }
            : { employee_id: '', employee_name: '', leave_type: 'Annual', start_date: '', end_date: '', days: '', reason: '', status: 'Pending', approved_by: '' });
        setModalOpen(true);
    };

    const save = async () => {
        if (!form.employee_name || !form.start_date) return toast.error('Employee name and start date are required');
        setSaving(true);
        const { error } = selected
            ? await supabase.from('leave_requests').update(form).eq('id', selected.id)
            : await supabase.from('leave_requests').insert(form);
        setSaving(false);
        if (error) return toast.error(error.message);
        toast.success(selected ? 'Leave request updated' : 'Leave request submitted');
        queryClient.invalidateQueries({ queryKey: ['leave_requests'] });
        setModalOpen(false);
    };

    const pending = requests.filter((r: any) => r.status === 'Pending').length;
    const approved = requests.filter((r: any) => r.status === 'Approved').length;
    const rejected = requests.filter((r: any) => r.status === 'Rejected').length;

    const leaveTypeVariant = (t: string) => t === 'Sick' ? 'warning' : t === 'Annual' ? 'info' : t === 'Maternity/Paternity' ? 'success' : 'default';

    const columns = [
        { key: 'employee_id', label: 'Emp. ID', render: (v: string) => <span style={{ fontFamily: 'var(--font-mono)' }}>{v}</span> },
        { key: 'employee_name', label: 'Employee', render: (v: string) => <span style={{ fontWeight: 600 }}>{v}</span> },
        { key: 'leave_type', label: 'Leave Type', render: (v: string) => <StatusBadge status={v} variant={leaveTypeVariant(v)} /> },
        { key: 'start_date', label: 'Start Date' },
        { key: 'end_date', label: 'End Date' },
        { key: 'days', label: 'Days', render: (v: string) => <span style={{ fontWeight: 700 }}>{v}</span> },
        { key: 'reason', label: 'Reason', render: (v: string) => <span style={{ maxWidth: 180, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v}</span> },
        { key: 'approved_by', label: 'Approved By' },
        { key: 'status', label: 'Status', render: (v: string) => <StatusBadge status={v} variant={v === 'Approved' ? 'success' : v === 'Rejected' ? 'danger' : 'warning'} /> },
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
                <StatCard title="Total Requests" value={requests.length} icon={<CalendarDays size={18} />} color="blue" />
                <StatCard title="Pending" value={pending} icon={<Clock size={18} />} color="amber" />
                <StatCard title="Approved" value={approved} icon={<CheckCircle size={18} />} color="green" />
                <StatCard title="Rejected" value={rejected} icon={<XCircle size={18} />} color="red" />
            </div>

            <DataTable
                columns={columns}
                data={requests}
                loading={isLoading}
                actions={
                    <button
                        onClick={() => open()}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--primary-600)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                    >
                        <Plus size={16} /> Request Leave
                    </button>
                }
            />

            <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={selected ? 'Edit Leave Request' : 'New Leave Request'} size="md">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        {[
                            { label: 'Employee ID', key: 'employee_id', type: 'text' },
                            { label: 'Employee Name', key: 'employee_name', type: 'text' },
                            { label: 'Start Date', key: 'start_date', type: 'date' },
                            { label: 'End Date', key: 'end_date', type: 'date' },
                            { label: 'Number of Days', key: 'days', type: 'number' },
                            { label: 'Approved By', key: 'approved_by', type: 'text' },
                        ].map(f => (
                            <div key={f.key}>
                                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-600)', display: 'block', marginBottom: 6 }}>{f.label}</label>
                                <input type={f.type} value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--slate-200)', fontSize: 13, outline: 'none' }} />
                            </div>
                        ))}
                        <div>
                            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-600)', display: 'block', marginBottom: 6 }}>Leave Type</label>
                            <select value={form.leave_type} onChange={e => setForm(p => ({ ...p, leave_type: e.target.value }))}
                                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--slate-200)', fontSize: 13, outline: 'none' }}>
                                {['Annual', 'Sick', 'Maternity/Paternity', 'Compassionate', 'Unpaid', 'Study'].map(s => <option key={s}>{s}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-600)', display: 'block', marginBottom: 6 }}>Status</label>
                            <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--slate-200)', fontSize: 13, outline: 'none' }}>
                                {['Pending', 'Approved', 'Rejected', 'Cancelled'].map(s => <option key={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-600)', display: 'block', marginBottom: 6 }}>Reason</label>
                        <textarea rows={3} value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
                            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--slate-200)', fontSize: 13, outline: 'none', resize: 'vertical' }} />
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
