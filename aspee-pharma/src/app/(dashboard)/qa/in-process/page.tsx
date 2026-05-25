'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useFetch } from '@/lib/hooks';
import { useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import StatusBadge from '@/components/StatusBadge';
import QAInProcessModal from '@/components/QAInProcessModal';
import EntityLink from '@/components/EntityLink';
import { Plus, Download, ShieldCheck, CheckCircle, XCircle, Clock, Microscope, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import Modal from '@/components/Modal';

export default function QAInProcessPage() {
    // Fetch IPC records with a plain select — no FK join so it works even
    // if migration_production_qa_link.sql has not yet been applied.
    const { data: ipcData, isLoading } = useFetch<any[]>(
        ['qa_in_process'],
        async () => {
            const { data, error } = await supabase
                .from('qa_in_process')
                .select('*')
                .order('created_at', { ascending: false });
            return { data: data || [], error };
        }
    );
    const records = ipcData ?? [];

    // Separately fetch production orders just for the "Job Order" column display.
    const { data: productionOrders = [] } = useFetch<any[]>(
        ['production_orders_basic'],
        async () => {
            const { data, error } = await supabase
                .from('production_orders')
                .select('id, order_number');
            return { data: data || [], error };
        }
    );

    const queryClient = useQueryClient();
    const router = useRouter();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<any | null>(null);

    // NCR-raising state
    const [isNCRModalOpen, setIsNCRModalOpen] = useState(false);
    const [ncrSaving, setNcrSaving] = useState(false);
    const [ncrForm, setNcrForm] = useState({
        ncr_number: '', department: 'Quality Assurance', description: '',
        root_cause: '', corrective_action: '', raised_date: new Date().toISOString().split('T')[0],
        due_date: '', raised_by: '', severity: 'Major', status: 'Open',
    });

    const openNCRModal = (ipcRecord: any) => {
        const order = (productionOrders as any[]).find(o => o.id === ipcRecord.production_order_id);
        const d = new Date();
        const ncr_number = `NCR-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-${Math.floor(1000+Math.random()*9000)}`;
        const description =
            `IPC Failure — Batch: ${ipcRecord.batch_number} | Product: ${ipcRecord.product_name} | Stage: ${ipcRecord.stage}` +
            (order ? ` | Job Order: ${order.order_number}` : '') +
            `\n\nParameters Checked: ${ipcRecord.parameters_checked || '—'}` +
            `\nResults: ${ipcRecord.results || '—'}` +
            (ipcRecord.notes ? `\nNotes: ${ipcRecord.notes}` : '');
        setNcrForm({
            ncr_number,
            department: 'Quality Assurance',
            description,
            root_cause: '',
            corrective_action: '',
            raised_date: new Date().toISOString().split('T')[0],
            due_date: '',
            raised_by: '',
            severity: 'Major',
            status: 'Open',
        });
        setIsNCRModalOpen(true);
    };

    const handleRaiseNCR = async () => {
        if (!ncrForm.ncr_number || !ncrForm.raised_date) {
            toast.error('NCR number and raised date are required');
            return;
        }
        setNcrSaving(true);
        try {
            const { error } = await supabase.from('non_conformances').insert(ncrForm);
            if (error) throw error;
            toast.success(`NCR ${ncrForm.ncr_number} raised — go to Internal Audit → Non-Conformances to track it`);
            setIsNCRModalOpen(false);
        } catch (err: any) {
            toast.error('Failed to raise NCR: ' + err.message);
        } finally {
            setNcrSaving(false);
        }
    };

    // Pending material requests awaiting QA
    const [pendingMaterialRequests, setPendingMaterialRequests] = useState<any[]>([]);
    const [mrLoading, setMrLoading] = useState(false);
    const [approveNotes, setApproveNotes] = useState<{ [id: string]: string }>({});

    const fetchPendingMRs = useCallback(async () => {
        setMrLoading(true);
        try {
            const { data, error } = await supabase
                .from('material_requests')
                .select(`
                    *,
                    production_order:production_orders(
                        order_number,
                        product:products(name)
                    )
                `)
                .eq('qa_status', 'Pending QA')
                .order('created_at', { ascending: true });
            if (error) throw error;
            setPendingMaterialRequests(data || []);
        } catch (err: any) {
            toast.error('Failed to load pending QA requests: ' + err.message);
        } finally {
            setMrLoading(false);
        }
    }, []);

    useEffect(() => { fetchPendingMRs(); }, [fetchPendingMRs]);

    const handleApprove = async (row: any) => {
        try {
            const { error } = await supabase
                .from('material_requests')
                .update({
                    qa_status: 'QA Approved',
                    qa_approved_at: new Date().toISOString(),
                    qa_notes: approveNotes[row.id] || null,
                })
                .eq('id', row.id);
            if (error) throw error;
            toast.success(`Materials approved for ${row.request_number}`);
            fetchPendingMRs();
        } catch (err: any) {
            toast.error('Approval failed: ' + err.message);
        }
    };

    const handleReject = async (row: any) => {
        const reason = approveNotes[row.id] || '';
        if (!reason) {
            toast.error('Please enter a rejection reason in the notes field first');
            return;
        }
        try {
            const { error } = await supabase
                .from('material_requests')
                .update({
                    qa_status: 'QA Rejected',
                    qa_approved_at: new Date().toISOString(),
                    qa_notes: reason,
                })
                .eq('id', row.id);
            if (error) throw error;
            toast.success(`Materials rejected for ${row.request_number}`);
            fetchPendingMRs();
        } catch (err: any) {
            toast.error('Rejection failed: ' + err.message);
        }
    };

    const handleSave = async () => {
        queryClient.invalidateQueries({ queryKey: ['qa_in_process'] });
        setIsModalOpen(false);
        setSelectedRecord(null);
    };

    const statusVariant = (s: string): 'success' | 'warning' | 'danger' | 'default' => {
        switch (s) {
            case 'Passed': return 'success';
            case 'Failed': return 'danger';
            case 'Needs Review': return 'warning';
            default: return 'default';
        }
    };

    const handleExport = () => {
        if (records.length === 0) return;
        const headers = ['Batch No.', 'Product', 'Stage', 'Status', 'Inspector', 'Date'];
        const csvContent = [
            headers.join(','),
            ...records.map((r: any) => [
                `"${r.batch_number}"`,
                `"${r.product_name}"`,
                `"${r.stage}"`,
                `"${r.status}"`,
                `"${r.inspector || ''}"`,
                `"${r.inspection_date ? new Date(r.inspection_date).toLocaleDateString() : ''}"`
            ].join(','))
        ].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `qa_in_process_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const columns = [
        {
            key: 'production_order_id',
            label: 'Job Order',
            render: (value: any) => {
                const order = (productionOrders as any[]).find(o => o.id === value);
                return order?.order_number
                    ? <EntityLink href={`/production?search=${encodeURIComponent(order.order_number)}`} mono>{order.order_number}</EntityLink>
                    : <span style={{ fontSize:10, color:'var(--slate-400)' }}>—</span>;
            }
        },
        {
            key: 'batch_number',
            label: 'Batch No.',
            render: (value: any) => (
                <span style={{ fontWeight: 600, color: 'var(--primary-600)', fontFamily: 'var(--font-mono)' }}>{value}</span>
            )
        },
        { key: 'product_name', label: 'Product' },
        { key: 'stage', label: 'Stage' },
        {
            key: 'status',
            label: 'Status',
            render: (value: any) => (
                <StatusBadge status={value} variant={statusVariant(value)} />
            )
        },
        { key: 'inspector', label: 'Inspector' },
        {
            key: 'inspection_date',
            label: 'Date',
            render: (value: any) => value ? new Date(value).toLocaleDateString() : '-'
        },
        {
            key: 'ipc_actions',
            label: '',
            render: (_: any, row: any) => {
                if (row.status === 'Passed') {
                    return (
                        <button
                            onClick={(e) => { e.stopPropagation(); router.push(`/qa/finished-products?search=${encodeURIComponent(row.batch_number)}`); }}
                            title="Go to Finished Products Analysis for this batch"
                            style={{
                                display: 'flex', alignItems: 'center', gap: 4,
                                padding: '4px 10px', borderRadius: 6,
                                border: '1px solid var(--teal-300, #5eead4)',
                                background: 'var(--teal-50, #f0fdfa)',
                                color: 'var(--teal-700, #0f766e)',
                                fontSize: 10, fontWeight: 600, cursor: 'pointer',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            <Microscope size={11} /> FP Analysis
                        </button>
                    );
                }
                if (row.status === 'Failed') {
                    return (
                        <button
                            onClick={(e) => { e.stopPropagation(); openNCRModal(row); }}
                            title="Raise a Non-Conformance Report for this failure"
                            style={{
                                display: 'flex', alignItems: 'center', gap: 4,
                                padding: '4px 10px', borderRadius: 6,
                                border: '1px solid #fca5a5',
                                background: '#fef2f2',
                                color: '#b91c1c',
                                fontSize: 10, fontWeight: 600, cursor: 'pointer',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            <AlertTriangle size={11} /> Raise NCR
                        </button>
                    );
                }
                return null;
            }
        }
    ];

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="In Process Controls"
                subtitle="QA checks during production — including material inspections"
                breadcrumbs={[
                    { label: 'Quality Assurance', href: '/qa' },
                    { label: 'In Process Controls' },
                ]}
                actions={
                    <>
                        <button
                            onClick={handleExport}
                            disabled={records.length === 0}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '9px 16px', borderRadius: 8,
                                border: '1px solid var(--slate-200)', background: 'var(--card-bg)',
                                fontSize: 11, fontWeight: 500, color: 'var(--slate-700)',
                                cursor: 'pointer', opacity: records.length === 0 ? 0.5 : 1
                            }}
                        >
                            <Download size={16} /> Export
                        </button>
                        <button
                            onClick={() => { setSelectedRecord(null); setIsModalOpen(true); }}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '9px 18px', borderRadius: 8,
                                border: 'none', background: 'linear-gradient(135deg, var(--primary-600), var(--primary-500))',
                                fontSize: 11, fontWeight: 600, color: 'white',
                                cursor: 'pointer',
                            }}
                        >
                            <Plus size={16} /> Add IPC Record
                        </button>
                    </>
                }
            />

            {/* ── Stage 1: Pending Material Approvals ─────────────────── */}
            {(pendingMaterialRequests.length > 0 || mrLoading) && (
                <div style={{
                    background: 'var(--amber-50, #fffbeb)',
                    border: '1.5px solid var(--amber-200, #fde68a)',
                    borderRadius: 12,
                    padding: '16px 20px',
                    marginBottom: 24,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                        <ShieldCheck size={18} color="var(--amber-600, #d97706)" />
                        <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--amber-800, #92400e)' }}>
                            Pending Material Inspections ({pendingMaterialRequests.length})
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--amber-600, #d97706)', marginLeft: 4 }}>
                            — These material batches have been issued by Stores and need QA inspection before use
                        </span>
                    </div>

                    {mrLoading ? (
                        <div style={{ color: 'var(--slate-500)', fontSize: 11, padding: '8px 0' }}>Loading...</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {pendingMaterialRequests.map(req => (
                                <div key={req.id} style={{
                                    background: 'white',
                                    border: '1px solid var(--amber-200, #fde68a)',
                                    borderRadius: 10,
                                    padding: '14px 16px',
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr auto',
                                    gap: 16,
                                    alignItems: 'center',
                                }}>
                                    {/* Request info */}
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--primary-600)', fontFamily: 'var(--font-mono)' }}>
                                            {req.request_number}
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--slate-600)', marginTop: 2 }}>
                                            Job Order: <strong>{req.production_order?.order_number || '—'}</strong>
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--slate-500)' }}>
                                            {req.production_order?.product?.name || '—'}
                                        </div>
                                        <div style={{ fontSize: 10, color: 'var(--slate-400)', marginTop: 2 }}>
                                            <Clock size={10} style={{ display: 'inline', marginRight: 4 }} />
                                            Requested: {new Date(req.created_at).toLocaleDateString('en-GB')}
                                        </div>
                                    </div>

                                    {/* QA Notes */}
                                    <div>
                                        <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--slate-500)', display: 'block', marginBottom: 4 }}>
                                            QA Notes / Rejection Reason
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Inspection notes or rejection reason..."
                                            value={approveNotes[req.id] || ''}
                                            onChange={(e) => setApproveNotes(prev => ({ ...prev, [req.id]: e.target.value }))}
                                            style={{
                                                width: '100%',
                                                padding: '7px 10px',
                                                border: '1px solid var(--slate-200)',
                                                borderRadius: 7,
                                                fontSize: 11,
                                                outline: 'none',
                                                boxSizing: 'border-box',
                                            }}
                                        />
                                    </div>

                                    {/* Approve / Reject */}
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button
                                            onClick={() => handleApprove(req)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 5,
                                                padding: '8px 14px', borderRadius: 8, border: 'none',
                                                background: 'var(--green-600, #16a34a)', color: 'white',
                                                fontSize: 11, fontWeight: 600, cursor: 'pointer',
                                            }}
                                        >
                                            <CheckCircle size={13} /> Approve
                                        </button>
                                        <button
                                            onClick={() => handleReject(req)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 5,
                                                padding: '8px 14px', borderRadius: 8,
                                                border: '1px solid var(--danger, #ef4444)',
                                                background: 'white', color: 'var(--danger, #ef4444)',
                                                fontSize: 11, fontWeight: 600, cursor: 'pointer',
                                            }}
                                        >
                                            <XCircle size={13} /> Reject
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── Standard IPC Records Table ───────────────────────────── */}
            <DataTable
                columns={columns}
                data={records}
                loading={isLoading}
                searchPlaceholder="Search by batch, product or stage..."
                onRowClick={(record) => {
                    setSelectedRecord(record);
                    setIsModalOpen(true);
                }}
                emptyMessage="No In Process Control records found"
            />

            <QAInProcessModal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setSelectedRecord(null);
                }}
                onSave={handleSave}
                record={selectedRecord}
            />

            {/* ── Raise NCR Modal ──────────────────────────────────────── */}
            <Modal
                isOpen={isNCRModalOpen}
                onClose={() => setIsNCRModalOpen(false)}
                title="Raise Non-Conformance Report"
                subtitle="Pre-filled from the failed IPC record — review and submit"
                width={620}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                    {/* Red alert banner */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 14px', borderRadius: 8,
                        background: '#fef2f2', border: '1px solid #fca5a5',
                        fontSize: 12, color: '#b91c1c', fontWeight: 600,
                    }}>
                        <AlertTriangle size={15} />
                        This NCR will be tracked under Internal Audit → Non-Conformances
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        {[
                            { label: 'NCR Number', key: 'ncr_number', type: 'text' },
                            { label: 'Department', key: 'department', type: 'text' },
                            { label: 'Raised By', key: 'raised_by', type: 'text' },
                            { label: 'Raised Date', key: 'raised_date', type: 'date' },
                            { label: 'Due Date', key: 'due_date', type: 'date' },
                        ].map(f => (
                            <div key={f.key}>
                                <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>{f.label}</label>
                                <input
                                    type={f.type}
                                    value={(ncrForm as any)[f.key]}
                                    onChange={e => setNcrForm(p => ({ ...p, [f.key]: e.target.value }))}
                                    style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #e2e8f0', fontSize: 11, outline: 'none', boxSizing: 'border-box' }}
                                />
                            </div>
                        ))}
                        <div>
                            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Severity</label>
                            <select
                                value={ncrForm.severity}
                                onChange={e => setNcrForm(p => ({ ...p, severity: e.target.value }))}
                                style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #e2e8f0', fontSize: 11, outline: 'none', background: 'var(--card-bg)' }}
                            >
                                <option>Minor</option>
                                <option>Major</option>
                                <option>Critical</option>
                            </select>
                        </div>
                    </div>

                    {[
                        { label: 'Description (auto-filled from IPC record)', key: 'description', rows: 4 },
                        { label: 'Root Cause', key: 'root_cause', rows: 2 },
                        { label: 'Corrective Action', key: 'corrective_action', rows: 2 },
                    ].map(f => (
                        <div key={f.key}>
                            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>{f.label}</label>
                            <textarea
                                rows={f.rows}
                                value={(ncrForm as any)[f.key]}
                                onChange={e => setNcrForm(p => ({ ...p, [f.key]: e.target.value }))}
                                style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #e2e8f0', fontSize: 11, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                            />
                        </div>
                    ))}

                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4, borderTop: '1px solid #e2e8f0' }}>
                        <button
                            onClick={() => setIsNCRModalOpen(false)}
                            style={{ padding: '8px 18px', borderRadius: 7, border: '1px solid #e2e8f0', background: 'transparent', fontSize: 12, cursor: 'pointer', color: '#64748b' }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleRaiseNCR}
                            disabled={ncrSaving}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                padding: '8px 20px', borderRadius: 7, border: 'none',
                                background: '#dc2626', color: 'white',
                                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                opacity: ncrSaving ? 0.7 : 1,
                            }}
                        >
                            <AlertTriangle size={13} />
                            {ncrSaving ? 'Raising NCR…' : 'Raise NCR'}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
