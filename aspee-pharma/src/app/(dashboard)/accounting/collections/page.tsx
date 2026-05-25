'use client';

import React, { useState, useCallback } from 'react';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';
import { Banknote, CheckCircle, AlertTriangle, Save, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/currency';
import { useFetch } from '@/lib/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { autoPostJournal } from '@/lib/autoPostJournal';

interface CollectionRow {
    id: string;
    receipt_number: string;
    amount: number;
    amount_collected: number | null;
    status: string;
    payment_method: string;
    // joined
    salesperson_name?: string;
    invoice_id?: string;
}

export default function CollectionsPage() {
    // rowEdits: map of receipt id → edited collected amount string
    const [rowEdits, setRowEdits] = useState<Record<string, string>>({});
    const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
    const queryClient = useQueryClient();

    const { data: rawList, isLoading: loading } = useFetch<CollectionRow[]>(
        ['sales_collections_v2'],
        async () => {
            const { data: receipts, error: receiptsError } = await supabase
                .from('sales_receipts')
                .select('id, receipt_number, amount, amount_collected, status, payment_method, invoice_id')
                .order('created_at', { ascending: false });

            if (receiptsError) {
                return { data: null, error: receiptsError };
            }

            const invoiceIds = Array.from(
                new Set((receipts || []).map((row: any) => row.invoice_id).filter(Boolean)),
            );

            const invoiceSalespersonMap = new Map<string, string | null>();
            if (invoiceIds.length > 0) {
                // Get invoice → van (route_id) to derive salesperson from van's driver_name
                const { data: invoices, error: invoicesError } = await supabase
                    .from('sales_invoices')
                    .select('id, route_id')
                    .in('id', invoiceIds);

                if (invoicesError) {
                    return { data: null, error: invoicesError };
                }

                const vanIds = Array.from(
                    new Set((invoices || []).map((inv: any) => inv.route_id).filter(Boolean)),
                );

                const vanNameMap = new Map<string, string>();
                if (vanIds.length > 0) {
                    const { data: vans, error: vansError } = await supabase
                        .from('vans')
                        .select('id, driver_name')
                        .in('id', vanIds);

                    if (vansError) {
                        return { data: null, error: vansError };
                    }

                    (vans || []).forEach((van: any) => {
                        if (van.driver_name) vanNameMap.set(van.id, van.driver_name);
                    });
                }

                (invoices || []).forEach((invoice: any) => {
                    invoiceSalespersonMap.set(
                        invoice.id,
                        invoice.route_id ? vanNameMap.get(invoice.route_id) ?? null : null,
                    );
                });
            }

            const mapped = (receipts || []).map((r: any) => ({
                ...r,
                salesperson_name: r.invoice_id ? invoiceSalespersonMap.get(r.invoice_id) ?? null : null,
            }));
            return { data: mapped, error: null };
        },
    );

    const collections: CollectionRow[] = rawList ?? [];

    const handleSave = useCallback(async (row: CollectionRow) => {
        const rawVal = rowEdits[row.id];
        if (rawVal === undefined) return;
        const collected = parseFloat(rawVal) || 0;

        setSavingIds(prev => new Set(prev).add(row.id));
        try {
            const newStatus = collected >= row.amount ? 'Cleared' : 'Confirmed';
            const { error } = await supabase
                .from('sales_receipts')
                .update({
                    amount_collected: collected,
                    collected_at: new Date().toISOString(),
                    status: newStatus,
                })
                .eq('id', row.id);

            if (error) throw error;

            // Auto-post GL: DR Cash/Bank, CR Accounts Receivable
            if (collected > 0) {
                await autoPostJournal({
                    event: 'RECEIPT_RECEIVED',
                    amount: collected,
                    date: new Date().toISOString().split('T')[0],
                    description: `Collection on Receipt ${row.receipt_number}${row.salesperson_name ? ` — ${row.salesperson_name}` : ''}`,
                    refNumber: row.receipt_number,
                    paymentMethod: row.payment_method,
                });
            }

            toast.success('Collection saved');
            // Clear the edit for this row
            setRowEdits(prev => {
                const next = { ...prev };
                delete next[row.id];
                return next;
            });
            queryClient.invalidateQueries({ queryKey: ['sales_collections_v2'] });
        } catch (err: any) {
            toast.error('Failed to save: ' + err.message);
        } finally {
            setSavingIds(prev => {
                const next = new Set(prev);
                next.delete(row.id);
                return next;
            });
        }
    }, [rowEdits, queryClient]);

    const stats = {
        totalReceiptAmount: collections.reduce((s, r) => s + Number(r.amount || 0), 0),
        totalCollected: collections.reduce((s, r) => s + Number(r.amount_collected || 0), 0),
        pendingBalance: collections.reduce((s, r) => s + Math.max(0, Number(r.amount || 0) - Number(r.amount_collected || 0)), 0),
        cleared: collections.filter(r => (Number(r.amount || 0) - Number(r.amount_collected || 0)) <= 0).length,
    };

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="Sales Collections"
                subtitle="Record cash / cheque collected from salespersons against issued receipts"
                breadcrumbs={[{ label: 'Accounting', href: '/accounting/journal' }, { label: 'Collections' }]}
            />

            <div className="animate-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                <StatCard title="Total Receipted" value={formatCurrency(stats.totalReceiptAmount)} icon={<Banknote size={20} />} color="blue" />
                <StatCard title="Total Collected" value={formatCurrency(stats.totalCollected)} icon={<CheckCircle size={20} />} color="green" />
                <StatCard title="Pending Balance" value={formatCurrency(stats.pendingBalance)} icon={<AlertTriangle size={20} />} color="amber" />
                <StatCard title="Cleared" value={stats.cleared} icon={<CheckCircle size={20} />} color="teal" />
            </div>

            <div className="coll-table-wrap">
                {loading ? (
                    <div className="coll-empty"><Loader2 size={22} className="coll-spin" /> Loading...</div>
                ) : collections.length === 0 ? (
                    <div className="coll-empty">No receipts found.</div>
                ) : (
                    <table className="coll-table">
                        <thead>
                            <tr>
                                <th>Receipt Number</th>
                                <th>Name of Sales Person</th>
                                <th style={{ textAlign: 'right' }}>Receipt Amount</th>
                                <th style={{ textAlign: 'right' }}>Cash / Cheque Collected</th>
                                <th style={{ textAlign: 'right' }}>Balance</th>
                                <th style={{ textAlign: 'center' }}>Status</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {collections.map(row => {
                                const isEditing = rowEdits[row.id] !== undefined;
                                const displayCollected = isEditing
                                    ? rowEdits[row.id]
                                    : String(row.amount_collected ?? '');
                                const collectedNum = parseFloat(displayCollected) || 0;
                                const balance = Number(row.amount || 0) - collectedNum;
                                const isSaving = savingIds.has(row.id);
                                const isCleared = balance <= 0;

                                return (
                                    <tr key={row.id} className={isCleared ? 'coll-row cleared' : 'coll-row'}>
                                        {/* Receipt Number */}
                                        <td>
                                            <span className="coll-mono">{row.receipt_number}</span>
                                        </td>

                                        {/* Sales Person */}
                                        <td>
                                            <span className="coll-name">
                                                {row.salesperson_name || <span className="coll-unknown">—</span>}
                                            </span>
                                        </td>

                                        {/* Receipt Amount (pre-filled) */}
                                        <td style={{ textAlign: 'right' }}>
                                            <span className="coll-amount">{formatCurrency(row.amount || 0)}</span>
                                        </td>

                                        {/* Cash/Cheque Collected (editable) */}
                                        <td style={{ textAlign: 'right' }}>
                                            <input
                                                type="number"
                                                className={`coll-input ${isEditing ? 'active' : ''}`}
                                                value={displayCollected}
                                                min={0}
                                                step="0.01"
                                                placeholder="0.00"
                                                onChange={e =>
                                                    setRowEdits(prev => ({ ...prev, [row.id]: e.target.value }))
                                                }
                                                disabled={isSaving}
                                            />
                                        </td>

                                        {/* Balance */}
                                        <td style={{ textAlign: 'right' }}>
                                            <span className={`coll-balance ${balance > 0 ? 'due' : 'clear'}`}>
                                                {formatCurrency(Math.max(0, balance))}
                                            </span>
                                        </td>

                                        {/* Status */}
                                        <td style={{ textAlign: 'center' }}>
                                            <StatusBadge
                                                status={isCleared ? 'Cleared' : 'Pending'}
                                                variant={isCleared ? 'success' : 'warning'}
                                            />
                                        </td>

                                        {/* Save button */}
                                        <td>
                                            {isEditing && (
                                                <button
                                                    onClick={() => handleSave(row)}
                                                    disabled={isSaving}
                                                    className="coll-save-btn"
                                                >
                                                    {isSaving
                                                        ? <Loader2 size={13} className="coll-spin" />
                                                        : <Save size={13} />}
                                                    {isSaving ? 'Saving' : 'Save'}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            <style>{`
                .coll-table-wrap {
                    background: var(--card-bg);
                    border: 1.5px solid var(--slate-200);
                    border-radius: 12px;
                    overflow: hidden;
                }
                .coll-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 12px;
                }
                .coll-table thead tr {
                    background: var(--slate-50);
                    border-bottom: 2px solid var(--slate-200);
                }
                .coll-table th {
                    padding: 12px 16px;
                    font-size: 10px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.06em;
                    color: var(--slate-500);
                    white-space: nowrap;
                }
                .coll-table td {
                    padding: 11px 16px;
                    border-bottom: 1px solid var(--slate-100);
                    vertical-align: middle;
                }
                .coll-row:last-child td { border-bottom: none; }
                .coll-row:hover td { background: rgba(59,130,246,0.02); }
                .coll-row.cleared td { background: rgba(16,185,129,0.025); }

                .coll-mono {
                    font-family: var(--font-mono, monospace);
                    font-size: 11px;
                    font-weight: 600;
                    color: var(--primary-600);
                }
                .coll-name {
                    font-weight: 500;
                    color: var(--slate-700);
                }
                .coll-unknown {
                    color: var(--slate-400);
                }
                .coll-amount {
                    font-weight: 600;
                    color: var(--slate-700);
                }
                .coll-balance.due {
                    font-weight: 700;
                    color: var(--danger-600, #dc2626);
                }
                .coll-balance.clear {
                    font-weight: 600;
                    color: var(--slate-400);
                }

                .coll-input {
                    width: 130px;
                    padding: 7px 10px;
                    border: 1.5px solid var(--slate-200);
                    border-radius: 7px;
                    font-size: 12px;
                    font-weight: 600;
                    text-align: right;
                    outline: none;
                    background: var(--card-bg);
                    color: var(--foreground);
                    transition: border-color 0.15s, box-shadow 0.15s;
                }
                .coll-input:focus, .coll-input.active {
                    border-color: var(--primary-400);
                    box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
                }
                .coll-input:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                .coll-save-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    padding: 6px 12px;
                    border-radius: 7px;
                    border: none;
                    background: var(--primary-600);
                    color: white;
                    font-size: 11px;
                    font-weight: 600;
                    cursor: pointer;
                    white-space: nowrap;
                    transition: opacity 0.15s;
                }
                .coll-save-btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }
                .coll-save-btn:not(:disabled):hover {
                    opacity: 0.88;
                }

                .coll-spin {
                    animation: spin 0.7s linear infinite;
                }
                @keyframes spin { to { transform: rotate(360deg); } }

                .coll-empty {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    padding: 60px 20px;
                    color: var(--slate-400);
                    font-size: 13px;
                }
            `}</style>
        </div>
    );
}
