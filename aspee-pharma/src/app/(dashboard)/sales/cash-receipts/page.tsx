'use client';

import React, { useEffect, useMemo, useState } from 'react';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';
import { Plus, Trash2, Save, Banknote, CreditCard, FileText, ClipboardList, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { formatCurrency, CURRENCY_SYMBOL } from '@/lib/currency';
import { useFetch } from '@/lib/hooks';
import { useQueryClient } from '@tanstack/react-query';

interface Customer { id: string; name: string; }
interface SalesPerson { id: string; name: string; role?: string; }
interface Van { id: string; van_number?: string; driver_name?: string; route_name?: string; }

interface ReceiptRow {
    key: string;
    customer_id: string;
    customer_name: string;
    amount: string;
    receipt_number: string;
    route_id: string;
    sales_person_id: string;
    payment_method: string;
    payment_reference: string;
    date: string;
    notes: string;
    saving?: boolean;
    saved?: boolean;
    error?: string;
}

function genReceiptNumber(offset = 0): string {
    const d = new Date();
    const yy = d.getFullYear().toString().slice(-2);
    const mm = (d.getMonth() + 1).toString().padStart(2, '0');
    const seed = Math.floor(1000 + Math.random() * 9000) + offset;
    return `RCT-${yy}${mm}-${seed}`;
}

function emptyRow(idx: number): ReceiptRow {
    return {
        key: `${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
        customer_id: '',
        customer_name: '',
        amount: '',
        receipt_number: genReceiptNumber(idx),
        route_id: '',
        sales_person_id: '',
        payment_method: 'Cash',
        payment_reference: '',
        date: new Date().toISOString().split('T')[0],
        notes: '',
    };
}

export default function CashReceiptRegistrationPage() {
    const queryClient = useQueryClient();
    const [rows, setRows] = useState<ReceiptRow[]>(() => [emptyRow(0), emptyRow(1), emptyRow(2)]);
    const [savingAll, setSavingAll] = useState(false);

    const { data: customers = [] } = useFetch<Customer[]>(['customers_for_receipts'], async () => {
        const { data, error } = await supabase
            .from('customers')
            .select('id, name')
            .order('name', { ascending: true });
        return { data: data as Customer[] | null, error };
    });

    const { data: salesPersons = [] } = useFetch<SalesPerson[]>(['sales_persons_for_receipts'], async () => {
        const { data, error } = await supabase
            .from('system_users')
            .select('id, name, role')
            .in('role', ['Van Sales Rep', 'Sales Manager'])
            .order('name', { ascending: true });
        return { data: data as SalesPerson[] | null, error };
    });

    const { data: vans = [] } = useFetch<Van[]>(['vans_for_receipts'], async () => {
        const { data, error } = await supabase
            .from('vans')
            .select('id, van_number, driver_name, route_name')
            .order('van_number', { ascending: true });
        return { data: data as Van[] | null, error };
    });

    const updateRow = (key: string, patch: Partial<ReceiptRow>) => {
        setRows(prev => prev.map(r => r.key === key ? { ...r, ...patch } : r));
    };

    const handleCustomerChange = (key: string, customerId: string) => {
        const customer = customers.find(c => c.id === customerId);
        updateRow(key, {
            customer_id: customerId,
            customer_name: customer?.name ?? '',
        });
    };

    const addRow = () => setRows(prev => [...prev, emptyRow(prev.length)]);

    const removeRow = (key: string) => {
        setRows(prev => prev.length > 1 ? prev.filter(r => r.key !== key) : prev);
    };

    const validateRow = (r: ReceiptRow): string | null => {
        if (!r.customer_id) return 'Customer required';
        const amt = parseFloat(r.amount);
        if (!amt || amt <= 0) return 'Amount must be > 0';
        if (!r.receipt_number) return 'Receipt number required';
        if (!r.payment_method) return 'Payment method required';
        return null;
    };

    const handleSaveAll = async () => {
        const nonEmpty = rows.filter(r => r.customer_id || parseFloat(r.amount) > 0);
        if (nonEmpty.length === 0) {
            toast.error('Nothing to save');
            return;
        }

        // Pre-validate
        for (const r of nonEmpty) {
            const err = validateRow(r);
            if (err) {
                updateRow(r.key, { error: err });
                toast.error(`Receipt ${r.receipt_number}: ${err}`);
                return;
            }
        }

        setSavingAll(true);
        let successCount = 0;
        const errors: string[] = [];

        for (const r of nonEmpty) {
            updateRow(r.key, { saving: true, error: undefined });
            try {
                const payload = {
                    receipt_number: r.receipt_number,
                    customer_id: r.customer_id,
                    customer_name: r.customer_name,
                    sales_person_id: r.sales_person_id || null,
                    route_id: r.route_id || null,
                    date: r.date,
                    payment_method: r.payment_method,
                    payment_reference: r.payment_reference || null,
                    amount: parseFloat(r.amount),
                    notes: r.notes || null,
                    status: 'Confirmed',
                    confirmation_status: 'registered',
                };
                const { error } = await supabase.rpc('post_sales_receipt', { receipt_payload: payload });
                if (error) throw error;
                updateRow(r.key, { saving: false, saved: true });
                successCount++;
            } catch (e: any) {
                updateRow(r.key, { saving: false, error: e.message || 'Save failed' });
                errors.push(`${r.receipt_number}: ${e.message}`);
            }
        }

        setSavingAll(false);
        queryClient.invalidateQueries({ queryKey: ['sales_receipts'] });
        queryClient.invalidateQueries({ queryKey: ['sales_collections_v2'] });

        if (successCount > 0) {
            toast.success(`${successCount} receipt${successCount === 1 ? '' : 's'} registered`);
        }
        if (errors.length > 0) {
            toast.error(`${errors.length} failed — check rows for details`);
        }

        // Replace saved rows with fresh empty ones, keep error rows for review
        setRows(prev => {
            const remaining = prev.filter(r => !r.saved);
            return remaining.length > 0 ? remaining : [emptyRow(0), emptyRow(1), emptyRow(2)];
        });
    };

    const totals = useMemo(() => {
        const sum = rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
        return { count: rows.filter(r => r.customer_id).length, sum };
    }, [rows]);

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="Cash Receipt Registration"
                subtitle="Sales back office — log receipts brought in by sales persons"
                breadcrumbs={[{ label: 'Sales', href: '/sales/cash-receipts' }, { label: 'Cash Receipt Registration' }]}
                actions={
                    <button
                        onClick={handleSaveAll}
                        disabled={savingAll}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, var(--primary-600), var(--primary-500))', fontSize: 11, fontWeight: 600, color: 'white', cursor: savingAll ? 'not-allowed' : 'pointer', opacity: savingAll ? 0.6 : 1 }}
                    >
                        {savingAll ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
                        {savingAll ? 'Saving...' : 'Save All Receipts'}
                    </button>
                }
            />

            <div className="animate-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
                <StatCard title="Rows" value={rows.length} icon={<ClipboardList size={20} />} color="blue" />
                <StatCard title="Filled Rows" value={totals.count} icon={<FileText size={20} />} color="teal" />
                <StatCard title="Batch Total" value={formatCurrency(totals.sum)} icon={<Banknote size={20} />} color="green" />
            </div>

            <div className="crr-card">
                <div className="crr-toolbar">
                    <div className="crr-toolbar-info">
                        Enter each receipt brought in by the sales person. Hand the physical cash to Accounts after saving.
                    </div>
                    <button type="button" onClick={addRow} className="crr-add-btn">
                        <Plus size={14} /> Add Row
                    </button>
                </div>

                <div className="crr-table-wrap">
                    <table className="crr-table">
                        <thead>
                            <tr>
                                <th style={{ width: 36 }}>#</th>
                                <th style={{ minWidth: 200 }}>Customer Name *</th>
                                <th style={{ width: 140 }}>Amount ({CURRENCY_SYMBOL}) *</th>
                                <th style={{ width: 150 }}>Receipt No. *</th>
                                <th style={{ minWidth: 160 }}>Route</th>
                                <th style={{ minWidth: 180 }}>Sales Person</th>
                                <th style={{ width: 130 }}>Method</th>
                                <th style={{ width: 140 }}>Reference</th>
                                <th style={{ width: 130 }}>Date</th>
                                <th style={{ width: 48 }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r, idx) => (
                                <tr key={r.key} className={`${r.saved ? 'saved' : ''} ${r.error ? 'errored' : ''}`}>
                                    <td className="crr-idx">{idx + 1}</td>
                                    <td>
                                        <select
                                            value={r.customer_id}
                                            onChange={e => handleCustomerChange(r.key, e.target.value)}
                                            disabled={r.saving || r.saved}
                                        >
                                            <option value="">-- select customer --</option>
                                            {customers.map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={r.amount}
                                            onChange={e => updateRow(r.key, { amount: e.target.value })}
                                            placeholder="0.00"
                                            disabled={r.saving || r.saved}
                                        />
                                    </td>
                                    <td>
                                        <input
                                            type="text"
                                            value={r.receipt_number}
                                            onChange={e => updateRow(r.key, { receipt_number: e.target.value })}
                                            disabled={r.saving || r.saved}
                                        />
                                    </td>
                                    <td>
                                        <select
                                            value={r.route_id}
                                            onChange={e => updateRow(r.key, { route_id: e.target.value })}
                                            disabled={r.saving || r.saved}
                                        >
                                            <option value="">-- route --</option>
                                            {vans.map(v => (
                                                <option key={v.id} value={v.id}>
                                                    {v.van_number ?? v.route_name ?? 'Van'} {v.driver_name ? `· ${v.driver_name}` : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </td>
                                    <td>
                                        <select
                                            value={r.sales_person_id}
                                            onChange={e => updateRow(r.key, { sales_person_id: e.target.value })}
                                            disabled={r.saving || r.saved}
                                        >
                                            <option value="">-- sales person --</option>
                                            {salesPersons.map(s => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td>
                                        <select
                                            value={r.payment_method}
                                            onChange={e => updateRow(r.key, { payment_method: e.target.value })}
                                            disabled={r.saving || r.saved}
                                        >
                                            <option value="Cash">Cash</option>
                                            <option value="Mobile Money">Mobile Money</option>
                                            <option value="Bank Transfer">Bank Transfer</option>
                                            <option value="Cheque">Cheque</option>
                                        </select>
                                    </td>
                                    <td>
                                        <input
                                            type="text"
                                            value={r.payment_reference}
                                            onChange={e => updateRow(r.key, { payment_reference: e.target.value })}
                                            placeholder="optional"
                                            disabled={r.saving || r.saved}
                                        />
                                    </td>
                                    <td>
                                        <input
                                            type="date"
                                            value={r.date}
                                            onChange={e => updateRow(r.key, { date: e.target.value })}
                                            disabled={r.saving || r.saved}
                                        />
                                    </td>
                                    <td className="crr-row-action">
                                        {r.saving ? (
                                            <Loader2 size={14} className="spin" style={{ color: 'var(--primary-500)' }} />
                                        ) : r.saved ? (
                                            <span className="crr-saved-pill">Saved</span>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => removeRow(r.key)}
                                                title="Remove row"
                                                className="crr-del-btn"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colSpan={2} style={{ textAlign: 'right', fontWeight: 600, color: 'var(--slate-600)' }}>Batch Total</td>
                                <td style={{ fontWeight: 700, color: 'var(--primary-700)' }}>
                                    {formatCurrency(totals.sum)}
                                </td>
                                <td colSpan={7}></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                {rows.some(r => r.error) && (
                    <div className="crr-error-list">
                        {rows.filter(r => r.error).map(r => (
                            <div key={r.key} className="crr-error-item">
                                <CreditCard size={12} /> {r.receipt_number}: {r.error}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <style>{`
                .crr-card {
                    background: var(--card-bg);
                    border: 1.5px solid var(--slate-100);
                    border-radius: 12px;
                    overflow: hidden;
                }
                .crr-toolbar {
                    padding: 14px 18px;
                    border-bottom: 1.5px solid var(--slate-100);
                    background: var(--slate-50);
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                }
                .crr-toolbar-info {
                    font-size: 11px;
                    color: var(--slate-500);
                }
                .crr-add-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 7px 12px;
                    border-radius: 6px;
                    border: 1.5px solid var(--primary-300);
                    background: var(--card-bg);
                    color: var(--primary-700);
                    font-size: 11px;
                    font-weight: 600;
                    cursor: pointer;
                }
                .crr-add-btn:hover { background: rgba(59,130,246,0.06); }

                .crr-table-wrap { overflow-x: auto; }
                .crr-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 11px;
                }
                .crr-table th {
                    text-align: left;
                    padding: 10px 8px;
                    font-weight: 600;
                    color: var(--slate-600);
                    background: var(--slate-50);
                    border-bottom: 1.5px solid var(--slate-100);
                    white-space: nowrap;
                }
                .crr-table td {
                    padding: 6px 6px;
                    border-bottom: 1px solid var(--slate-50);
                    vertical-align: middle;
                }
                .crr-table tr.saved td { background: rgba(16,185,129,0.05); }
                .crr-table tr.errored td { background: rgba(239,68,68,0.04); }
                .crr-idx {
                    text-align: center;
                    font-weight: 600;
                    color: var(--slate-400);
                }
                .crr-table input,
                .crr-table select {
                    width: 100%;
                    padding: 7px 8px;
                    border: 1.5px solid var(--slate-200);
                    border-radius: 6px;
                    font-size: 11px;
                    background: var(--card-bg);
                    color: var(--foreground);
                    outline: none;
                }
                .crr-table input:focus,
                .crr-table select:focus {
                    border-color: var(--primary-400);
                    box-shadow: 0 0 0 2px rgba(59,130,246,0.1);
                }
                .crr-table input:disabled,
                .crr-table select:disabled {
                    background: var(--slate-50);
                    color: var(--slate-500);
                    cursor: not-allowed;
                }
                .crr-row-action {
                    text-align: center;
                }
                .crr-del-btn {
                    padding: 5px;
                    border: 1px solid var(--slate-200);
                    border-radius: 5px;
                    background: var(--card-bg);
                    color: var(--danger);
                    cursor: pointer;
                    display: inline-flex;
                }
                .crr-del-btn:hover { background: var(--danger-50); }
                .crr-saved-pill {
                    display: inline-block;
                    padding: 3px 8px;
                    border-radius: 4px;
                    background: var(--success-light);
                    color: #047857;
                    font-size: 10px;
                    font-weight: 600;
                }
                .crr-table tfoot td {
                    padding: 12px 8px;
                    border-top: 1.5px solid var(--slate-200);
                    background: var(--slate-50);
                    font-size: 11px;
                }
                .crr-error-list {
                    padding: 12px 18px;
                    background: rgba(239,68,68,0.04);
                    border-top: 1.5px solid rgba(239,68,68,0.15);
                }
                .crr-error-item {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 11px;
                    color: var(--danger);
                    padding: 2px 0;
                }
                @keyframes spin { to { transform: rotate(360deg); } }
                .spin { animation: spin 0.8s linear infinite; }
            `}</style>
        </div>
    );
}
