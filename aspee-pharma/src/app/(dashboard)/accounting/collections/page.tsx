'use client';

import React, { useState, useCallback, useMemo } from 'react';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';
import { Banknote, CheckCircle, AlertTriangle, Save, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/currency';
import { useFetch } from '@/lib/hooks';
import { useQueryClient } from '@tanstack/react-query';

interface CollectionRow {
    id: string;
    receipt_number: string;
    customer_name: string | null;
    amount: number;
    amount_collected: number | null;
    status: string;
    confirmation_status: string | null;
    variance_reason: string | null;
    payment_method: string;
    date: string;
    registered_at: string | null;
    sales_person_id?: string | null;
    route_id?: string | null;
    sales_person_name?: string | null;
    route_label?: string | null;
}

type StatusFilter = 'all' | 'pending' | 'variance' | 'confirmed';

export default function CollectionsPage() {
    const [rowEdits, setRowEdits] = useState<Record<string, { amount: string; reason: string }>>({});
    const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
    const queryClient = useQueryClient();

    const { data: rawList, isLoading: loading } = useFetch<CollectionRow[]>(
        ['sales_collections_v2'],
        async () => {
            const { data: receipts, error: receiptsError } = await supabase
                .from('sales_receipts')
                .select(`
                    id, receipt_number, customer_name, amount, amount_collected,
                    status, confirmation_status, variance_reason, payment_method, date,
                    registered_at, sales_person_id, route_id, invoice_id
                `)
                .order('registered_at', { ascending: false });

            if (receiptsError) return { data: null, error: receiptsError };

            // Resolve sales person directly from sales_person_id (new path)
            const directSalesIds = Array.from(
                new Set((receipts || []).map((r: any) => r.sales_person_id).filter(Boolean)),
            );

            // Fallback: derive from invoice for legacy rows
            const legacyInvoiceIds = Array.from(
                new Set((receipts || [])
                    .filter((r: any) => !r.sales_person_id && r.invoice_id)
                    .map((r: any) => r.invoice_id)),
            );

            const invoiceSalesMap = new Map<string, { sales_id?: string; route_id?: string }>();
            if (legacyInvoiceIds.length > 0) {
                const { data: invoices } = await supabase
                    .from('sales_invoices')
                    .select('id, salesperson_id, route_id')
                    .in('id', legacyInvoiceIds);
                (invoices || []).forEach((inv: any) => {
                    invoiceSalesMap.set(inv.id, { sales_id: inv.salesperson_id, route_id: inv.route_id });
                });
            }

            const allSalesIds = new Set<string>(directSalesIds as string[]);
            const allRouteIds = new Set<string>(
                (receipts || []).map((r: any) => r.route_id).filter(Boolean),
            );
            invoiceSalesMap.forEach(v => {
                if (v.sales_id) allSalesIds.add(v.sales_id);
                if (v.route_id) allRouteIds.add(v.route_id);
            });

            const salesNameMap = new Map<string, string>();
            if (allSalesIds.size > 0) {
                const { data: users } = await supabase
                    .from('system_users')
                    .select('id, name')
                    .in('id', Array.from(allSalesIds));
                (users || []).forEach((u: any) => salesNameMap.set(u.id, u.name));
            }

            const vanLabelMap = new Map<string, string>();
            if (allRouteIds.size > 0) {
                const { data: vans } = await supabase
                    .from('vans')
                    .select('id, van_number, driver_name, route_name')
                    .in('id', Array.from(allRouteIds));
                (vans || []).forEach((v: any) => {
                    const label = [v.van_number, v.route_name, v.driver_name].filter(Boolean).join(' · ');
                    vanLabelMap.set(v.id, label || 'Van');
                });
            }

            const mapped: CollectionRow[] = (receipts || []).map((r: any) => {
                const fallback = !r.sales_person_id && r.invoice_id ? invoiceSalesMap.get(r.invoice_id) : null;
                const sId = r.sales_person_id || fallback?.sales_id || null;
                const rId = r.route_id || fallback?.route_id || null;
                return {
                    ...r,
                    sales_person_name: sId ? salesNameMap.get(sId) ?? null : null,
                    route_label: rId ? vanLabelMap.get(rId) ?? null : null,
                };
            });

            return { data: mapped, error: null };
        },
    );

    const collections: CollectionRow[] = rawList ?? [];

    const filtered = useMemo(() => {
        if (statusFilter === 'all') return collections;
        return collections.filter(r => {
            const cs = (r.confirmation_status ?? 'registered').toLowerCase();
            if (statusFilter === 'pending') return cs === 'registered';
            if (statusFilter === 'confirmed') return cs === 'confirmed';
            if (statusFilter === 'variance') return cs === 'variance';
            return true;
        });
    }, [collections, statusFilter]);

    const handleSave = useCallback(async (row: CollectionRow) => {
        const edit = rowEdits[row.id];
        if (!edit) return;
        const collected = parseFloat(edit.amount) || 0;

        setSavingIds(prev => new Set(prev).add(row.id));
        try {
            const { error } = await supabase.rpc('confirm_sales_receipt', {
                receipt_uuid: row.id,
                amount_confirmed: collected,
                variance_reason_in: edit.reason || null,
            });
            if (error) throw error;

            toast.success(
                Math.abs(collected - Number(row.amount || 0)) < 0.01
                    ? 'Receipt confirmed'
                    : 'Receipt confirmed with variance'
            );

            setRowEdits(prev => {
                const next = { ...prev };
                delete next[row.id];
                return next;
            });
            queryClient.invalidateQueries({ queryKey: ['sales_collections_v2'] });
            queryClient.invalidateQueries({ queryKey: ['sales_receipts'] });
        } catch (err: any) {
            toast.error('Failed to confirm: ' + err.message);
        } finally {
            setSavingIds(prev => {
                const next = new Set(prev);
                next.delete(row.id);
                return next;
            });
        }
    }, [rowEdits, queryClient]);

    const stats = useMemo(() => {
        const totalReg = collections.reduce((s, r) => s + Number(r.amount || 0), 0);
        const totalConfirmed = collections.reduce((s, r) => s + Number(r.amount_collected || 0), 0);
        const pendingCount = collections.filter(r => (r.confirmation_status ?? 'registered') === 'registered').length;
        const varianceCount = collections.filter(r => r.confirmation_status === 'variance').length;
        return { totalReg, totalConfirmed, pendingCount, varianceCount };
    }, [collections]);

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="Cash Reconciliation"
                subtitle="Confirm cash received from sales persons against registered receipts"
                breadcrumbs={[{ label: 'Accounting', href: '/accounting/journal' }, { label: 'Collections' }]}
            />

            <div className="animate-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                <StatCard title="Total Registered" value={formatCurrency(stats.totalReg)} icon={<Banknote size={20} />} color="blue" />
                <StatCard title="Total Confirmed" value={formatCurrency(stats.totalConfirmed)} icon={<CheckCircle size={20} />} color="green" />
                <StatCard title="Pending Confirmation" value={stats.pendingCount} icon={<AlertTriangle size={20} />} color="amber" />
                <StatCard title="With Variance" value={stats.varianceCount} icon={<AlertTriangle size={20} />} color="amber" />
            </div>

            <div className="coll-filter-bar">
                {(['pending', 'variance', 'confirmed', 'all'] as StatusFilter[]).map(s => (
                    <button
                        key={s}
                        className={`coll-filter-btn ${statusFilter === s ? 'active' : ''}`}
                        onClick={() => setStatusFilter(s)}
                    >
                        {s === 'pending' ? 'Pending' : s === 'variance' ? 'Variance' : s === 'confirmed' ? 'Confirmed' : 'All'}
                        <span className="coll-filter-count">
                            {s === 'all' ? collections.length :
                             s === 'pending' ? stats.pendingCount :
                             s === 'variance' ? stats.varianceCount :
                             collections.filter(r => r.confirmation_status === 'confirmed').length}
                        </span>
                    </button>
                ))}
            </div>

            <div className="coll-table-wrap">
                {loading ? (
                    <div className="coll-empty"><Loader2 size={22} className="coll-spin" /> Loading...</div>
                ) : filtered.length === 0 ? (
                    <div className="coll-empty">No receipts in this view.</div>
                ) : (
                    <table className="coll-table">
                        <thead>
                            <tr>
                                <th>Receipt</th>
                                <th>Customer</th>
                                <th>Sales Person</th>
                                <th>Route</th>
                                <th style={{ textAlign: 'right' }}>Registered</th>
                                <th style={{ textAlign: 'right' }}>Cash Confirmed</th>
                                <th style={{ textAlign: 'right' }}>Variance</th>
                                <th style={{ textAlign: 'center' }}>Status</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(row => {
                                const edit = rowEdits[row.id];
                                const isEditing = edit !== undefined;
                                const displayAmount = isEditing
                                    ? edit.amount
                                    : String(row.amount_collected ?? row.amount ?? '');
                                const displayReason = isEditing
                                    ? edit.reason
                                    : (row.variance_reason ?? '');
                                const collectedNum = parseFloat(displayAmount) || 0;
                                const variance = collectedNum - Number(row.amount || 0);
                                const hasVariance = Math.abs(variance) >= 0.01;
                                const isSaving = savingIds.has(row.id);
                                const cs = (row.confirmation_status ?? 'registered').toLowerCase();

                                return (
                                    <React.Fragment key={row.id}>
                                        <tr className={`coll-row ${cs === 'confirmed' ? 'cleared' : ''} ${cs === 'variance' ? 'variance' : ''}`}>
                                            <td><span className="coll-mono">{row.receipt_number}</span></td>
                                            <td>{row.customer_name || <span className="coll-unknown">—</span>}</td>
                                            <td>{row.sales_person_name || <span className="coll-unknown">—</span>}</td>
                                            <td>{row.route_label || <span className="coll-unknown">—</span>}</td>
                                            <td style={{ textAlign: 'right' }}>
                                                <span className="coll-amount">{formatCurrency(row.amount || 0)}</span>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <input
                                                    type="number"
                                                    className={`coll-input ${isEditing ? 'active' : ''}`}
                                                    value={displayAmount}
                                                    min={0}
                                                    step="0.01"
                                                    placeholder="0.00"
                                                    onChange={e => setRowEdits(prev => ({
                                                        ...prev,
                                                        [row.id]: { amount: e.target.value, reason: prev[row.id]?.reason ?? '' },
                                                    }))}
                                                    disabled={isSaving || cs === 'confirmed'}
                                                />
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <span className={`coll-balance ${hasVariance ? (variance < 0 ? 'due' : 'over') : 'clear'}`}>
                                                    {hasVariance ? (variance > 0 ? '+' : '') + formatCurrency(variance) : '—'}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <StatusBadge
                                                    status={cs === 'confirmed' ? 'Confirmed' : cs === 'variance' ? 'Variance' : 'Pending'}
                                                    variant={cs === 'confirmed' ? 'success' : cs === 'variance' ? 'warning' : 'default'}
                                                />
                                            </td>
                                            <td>
                                                {isEditing && cs !== 'confirmed' && (
                                                    <button
                                                        onClick={() => handleSave(row)}
                                                        disabled={isSaving || (hasVariance && !displayReason.trim())}
                                                        className="coll-save-btn"
                                                        title={hasVariance && !displayReason.trim() ? 'Variance reason required' : ''}
                                                    >
                                                        {isSaving ? <Loader2 size={13} className="coll-spin" /> : <Save size={13} />}
                                                        {isSaving ? 'Saving' : 'Confirm'}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                        {(isEditing && hasVariance) || (cs === 'variance' && row.variance_reason) ? (
                                            <tr className="coll-reason-row">
                                                <td colSpan={9}>
                                                    <div className="coll-reason-wrap">
                                                        <label>Variance Reason *</label>
                                                        <input
                                                            type="text"
                                                            value={displayReason}
                                                            onChange={e => setRowEdits(prev => ({
                                                                ...prev,
                                                                [row.id]: { amount: prev[row.id]?.amount ?? displayAmount, reason: e.target.value },
                                                            }))}
                                                            placeholder="Why does the cash differ from the registered amount?"
                                                            disabled={isSaving || cs === 'confirmed'}
                                                        />
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : null}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            <style>{`
                .coll-filter-bar {
                    display: flex;
                    gap: 8px;
                    margin-bottom: 16px;
                }
                .coll-filter-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    padding: 7px 14px;
                    border: 1.5px solid var(--slate-200);
                    border-radius: 999px;
                    background: var(--card-bg);
                    font-size: 11px;
                    font-weight: 600;
                    color: var(--slate-600);
                    cursor: pointer;
                }
                .coll-filter-btn.active {
                    background: var(--primary-600);
                    color: white;
                    border-color: var(--primary-600);
                }
                .coll-filter-count {
                    background: rgba(255,255,255,0.25);
                    padding: 2px 7px;
                    border-radius: 999px;
                    font-size: 10px;
                }
                .coll-filter-btn:not(.active) .coll-filter-count {
                    background: var(--slate-100);
                    color: var(--slate-600);
                }

                .coll-table-wrap {
                    background: var(--card-bg);
                    border: 1.5px solid var(--slate-200);
                    border-radius: 12px;
                    overflow: hidden;
                }
                .coll-table { width: 100%; border-collapse: collapse; font-size: 11px; }
                .coll-table thead tr {
                    background: var(--slate-50);
                    border-bottom: 2px solid var(--slate-200);
                }
                .coll-table th {
                    padding: 11px 14px;
                    font-size: 10px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.06em;
                    color: var(--slate-500);
                    white-space: nowrap;
                    text-align: left;
                }
                .coll-table td {
                    padding: 10px 14px;
                    border-bottom: 1px solid var(--slate-100);
                    vertical-align: middle;
                }
                .coll-row.cleared td { background: rgba(16,185,129,0.04); }
                .coll-row.variance td { background: rgba(245,158,11,0.05); }
                .coll-row:hover td { background: rgba(59,130,246,0.03); }

                .coll-mono {
                    font-family: var(--font-mono, monospace);
                    font-size: 11px;
                    font-weight: 600;
                    color: var(--primary-600);
                }
                .coll-unknown { color: var(--slate-400); }
                .coll-amount { font-weight: 600; color: var(--slate-700); }
                .coll-balance.due { font-weight: 700; color: var(--danger); }
                .coll-balance.over { font-weight: 700; color: var(--warning); }
                .coll-balance.clear { font-weight: 500; color: var(--slate-400); }

                .coll-input {
                    width: 120px;
                    padding: 6px 9px;
                    border: 1.5px solid var(--slate-200);
                    border-radius: 6px;
                    font-size: 11px;
                    font-weight: 600;
                    text-align: right;
                    outline: none;
                    background: var(--card-bg);
                    color: var(--foreground);
                }
                .coll-input:focus, .coll-input.active {
                    border-color: var(--primary-400);
                    box-shadow: 0 0 0 2px rgba(59,130,246,0.1);
                }
                .coll-input:disabled { opacity: 0.6; cursor: not-allowed; }

                .coll-reason-row td { padding: 0 14px 12px; border-bottom: 1px solid var(--slate-100); background: rgba(245,158,11,0.04); }
                .coll-reason-wrap {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 12px;
                    background: var(--card-bg);
                    border: 1.5px dashed var(--warning);
                    border-radius: 8px;
                }
                .coll-reason-wrap label {
                    font-size: 10px; font-weight: 700; color: var(--warning);
                    text-transform: uppercase; letter-spacing: 0.05em; white-space: nowrap;
                }
                .coll-reason-wrap input {
                    flex: 1; padding: 6px 8px;
                    border: 1.5px solid var(--slate-200);
                    border-radius: 6px;
                    font-size: 11px; outline: none;
                    background: var(--card-bg);
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
                }
                .coll-save-btn:disabled { opacity: 0.5; cursor: not-allowed; }

                .coll-spin { animation: spin 0.7s linear infinite; }
                @keyframes spin { to { transform: rotate(360deg); } }

                .coll-empty {
                    display: flex; align-items: center; justify-content: center;
                    gap: 10px; padding: 60px 20px;
                    color: var(--slate-400); font-size: 13px;
                }
            `}</style>
        </div>
    );
}
