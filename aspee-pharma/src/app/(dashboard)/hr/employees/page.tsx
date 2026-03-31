'use client';

import React, { useState } from 'react';
import DataTable from '@/components/DataTable';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';
import { Plus, Users, Briefcase, UserCheck, UserX, IdCard, BadgeCheck, GraduationCap, Send } from 'lucide-react';
import EntityDocumentsModal from '@/components/compliance/EntityDocumentsModal';
import { supabase } from '@/lib/supabase';
import { useSupabaseQuery, useDelete } from '@/lib/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Modal from '@/components/Modal';
import PageHeader from '@/components/PageHeader';
import SendToMDModal from '@/components/SendToMDModal';

export default function EmployeesPage() {
    const { data, isLoading } = useSupabaseQuery<any>('employees', { orderBy: 'full_name', ascending: true });
    const employees = data ?? [];
    const queryClient = useQueryClient();
    const deleteMutation = useDelete('employees');

    const [modalOpen, setModalOpen] = useState(false);
    const [docsOpen, setDocsOpen] = useState(false);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [docsEmployee, setDocsEmployee] = useState<any | null>(null);

    const openDocs = (row: any) => {
        setDocsEmployee(row);
        setDocsOpen(true);
    };

    const closeDocs = () => {
        setDocsOpen(false);
        setDocsEmployee(null);
    };
    const [selected, setSelected] = useState<any | null>(null);
    const [form, setForm] = useState({
        employee_id: '', full_name: '', department: '', job_title: '', employment_type: 'Full-Time',
        date_joined: '', phone: '', email: '', status: 'Active',
        ghana_card_number: '', nhis_number: '', nhis_provider: '', credentials: '',
    });
    const [saving, setSaving] = useState(false);

    const open = (row?: any) => {
        setSelected(row ?? null);
        setForm(row ? {
            employee_id: row.employee_id, full_name: row.full_name, department: row.department,
            job_title: row.job_title, employment_type: row.employment_type, date_joined: row.date_joined,
            phone: row.phone, email: row.email, status: row.status,
            ghana_card_number: row.ghana_card_number || '', nhis_number: row.nhis_number || '',
            nhis_provider: row.nhis_provider || '', credentials: row.credentials || '',
        } : { employee_id: '', full_name: '', department: '', job_title: '', employment_type: 'Full-Time', date_joined: '', phone: '', email: '', status: 'Active', ghana_card_number: '', nhis_number: '', nhis_provider: '', credentials: '' });
        setModalOpen(true);
    };

    const save = async () => {
        if (!form.full_name || !form.department) return toast.error('Name and department are required');
        setSaving(true);
        const { error } = selected
            ? await supabase.from('employees').update(form).eq('id', selected.id)
            : await supabase.from('employees').insert(form);
        setSaving(false);
        if (error) return toast.error(error.message);
        toast.success(selected ? 'Employee updated' : 'Employee added');
        queryClient.invalidateQueries({ queryKey: ['employees'] });
        setModalOpen(false);
    };

    const active = employees.filter((e: any) => e.status === 'Active').length;
    const inactive = employees.filter((e: any) => e.status === 'Inactive').length;
    const depts = new Set(employees.map((e: any) => e.department)).size;

    const columns = [
        { key: 'employee_id', label: 'Employee ID', render: (v: string) => <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{v}</span> },
        { key: 'full_name', label: 'Full Name', render: (v: string) => <span style={{ fontWeight: 600 }}>{v}</span> },
        { key: 'department', label: 'Department' },
        { key: 'job_title', label: 'Job Title' },
        { key: 'employment_type', label: 'Type', render: (v: string) => <StatusBadge status={v} variant={v === 'Full-Time' ? 'success' : 'info'} /> },
        { key: 'date_joined', label: 'Date Joined' },
        { key: 'phone', label: 'Phone' },
        { key: 'status', label: 'Status', render: (v: string) => <StatusBadge status={v} variant={v === 'Active' ? 'success' : 'danger'} /> },
        { key: 'actions', label: '', render: (_: any, row: any) => (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button onClick={() => openDocs(row)} title="Employee Documents" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--slate-700)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
                    <IdCard size={14} /> Docs
                </button>
                <button onClick={() => open(row)} style={{ fontSize: 11, color: 'var(--primary-600)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Edit</button>
                <button onClick={() => deleteMutation.mutate(row.id)} style={{ fontSize: 11, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Delete</button>
            </div>
        )},
    ];

    return (
        <div className="animate-fade-in">
            <PageHeader 
                title="HR Management" 
                subtitle="Manage employee records, attendance, and payroll preparation"
                breadcrumbs={[{ label: 'HR' }, { label: 'Employees' }]}
                actions={
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
                }
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
                <StatCard title="Total Employees" value={employees.length} icon={<Users size={18} />} color="blue" />
                <StatCard title="Active" value={active} icon={<UserCheck size={18} />} color="green" />
                <StatCard title="Inactive" value={inactive} icon={<UserX size={18} />} color="red" />
                <StatCard title="Departments" value={depts} icon={<Briefcase size={18} />} color="purple" />
            </div>

            <EntityDocumentsModal
                isOpen={docsOpen}
                onClose={closeDocs}
                title={`Employee Documents — ${docsEmployee?.full_name || ''}`}
                entityType="employee"
                entityId={docsEmployee?.id || ''}
                allowedDocumentTypes={[
                    { label: 'Ghana Card', value: 'GHANA_CARD', allowMultiple: false },
                    { label: 'Health Insurance', value: 'HEALTH_INSURANCE', allowMultiple: false },
                    { label: 'Credentials (Certificates)', value: 'CREDENTIAL', allowMultiple: true },
                ]}
            />

            <DataTable
                columns={columns}
                data={employees}
                loading={isLoading}
                actions={
                    <button
                        onClick={() => open()}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--primary-600)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                    >
                        <Plus size={16} /> Add Employee
                    </button>
                }
            />

            <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={selected ? 'Edit Employee' : 'Add Employee'} size="lg">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        {[
                            { label: 'Employee ID', key: 'employee_id', type: 'text' },
                            { label: 'Full Name', key: 'full_name', type: 'text' },
                            { label: 'Department', key: 'department', type: 'text' },
                            { label: 'Job Title', key: 'job_title', type: 'text' },
                            { label: 'Phone', key: 'phone', type: 'tel' },
                            { label: 'Email', key: 'email', type: 'email' },
                            { label: 'Date Joined', key: 'date_joined', type: 'date' },
                        ].map(f => (
                            <div key={f.key}>
                                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-600)', display: 'block', marginBottom: 6 }}>{f.label}</label>
                                <input type={f.type} value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--slate-200)', fontSize: 13, outline: 'none' }} />
                            </div>
                        ))}
                        <div>
                            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-600)', display: 'block', marginBottom: 6 }}>Employment Type</label>
                            <select value={form.employment_type} onChange={e => setForm(p => ({ ...p, employment_type: e.target.value }))}
                                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--slate-200)', fontSize: 13, outline: 'none' }}>
                                {['Full-Time', 'Part-Time', 'Contract', 'Intern'].map(s => <option key={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-600)', display: 'block', marginBottom: 6 }}>Status</label>
                        <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--slate-200)', fontSize: 13, outline: 'none' }}>
                            {['Active', 'Inactive', 'On Leave', 'Terminated'].map(s => <option key={s}>{s}</option>)}
                        </select>
                    </div>

                    {/* ── Identity & Credentials ── */}
                    <div style={{ borderTop: '1px solid var(--slate-100)', paddingTop: 14 }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--slate-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                            Identity &amp; Credentials
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div>
                                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-600)', display: 'block', marginBottom: 6 }}>Ghana Card Number</label>
                                <input
                                    type="text"
                                    placeholder="GHA-XXXXXXXXX-X"
                                    value={form.ghana_card_number}
                                    onChange={e => setForm(p => ({ ...p, ghana_card_number: e.target.value }))}
                                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--slate-200)', fontSize: 13, outline: 'none', fontFamily: 'var(--font-mono)' }}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-600)', display: 'block', marginBottom: 6 }}>NHIS Number</label>
                                <input
                                    type="text"
                                    placeholder="Health insurance ID"
                                    value={form.nhis_number}
                                    onChange={e => setForm(p => ({ ...p, nhis_number: e.target.value }))}
                                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--slate-200)', fontSize: 13, outline: 'none', fontFamily: 'var(--font-mono)' }}
                                />
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-600)', display: 'block', marginBottom: 6 }}>Health Insurance Provider</label>
                                <input
                                    type="text"
                                    placeholder="e.g. NHIA, Enterprise Life, etc."
                                    value={form.nhis_provider}
                                    onChange={e => setForm(p => ({ ...p, nhis_provider: e.target.value }))}
                                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--slate-200)', fontSize: 13, outline: 'none' }}
                                />
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-600)', display: 'block', marginBottom: 6 }}>Credentials / Qualifications</label>
                                <textarea
                                    rows={3}
                                    placeholder="e.g. B.Pharm (UG, 2018), Pharmacy Council License #12345"
                                    value={form.credentials}
                                    onChange={e => setForm(p => ({ ...p, credentials: e.target.value }))}
                                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--slate-200)', fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
                                />
                            </div>
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

            <SendToMDModal 
                isOpen={isReportModalOpen} 
                onClose={() => setIsReportModalOpen(false)} 
                department="Human Resources" 
            />
        </div>
    );
}
