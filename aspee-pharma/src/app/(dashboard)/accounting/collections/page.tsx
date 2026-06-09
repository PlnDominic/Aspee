'use client';

import React, { useState, useCallback } from 'react';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';
import { Banknote, CheckCircle, AlertTriangle, Save, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/currency';
import { useFetch } from '@/lib/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { autoPostJournal } from '@/lib/autoPostJournal';

interface ReceiptRow {
    id: string;
    receipt_number: string;
    amount: number;
    amount_collected: number | null;
    status: string;
    payment_method: string;
    invoice_id: string | null;
}

interface RouteGroup {
    vanId: string;
    vanLabel: string; // "VAN-001 — Accra North"
    driverName: string;
    routeArea: string;
    receipts: ReceiptRow[];
    totalAmount: number;
    totalCollected: number;
}

export default function CollectionsPage() {
    const [routeEdits, setRouteEdits] = useState<Record<string, string>>({});
    const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
    const [expandedRoutes, setExpandedRoutes] = useState<Set<string>>(new Set());
    const queryClient = useQueryClient();

    const { data: routeGroups, isLoading: loading } = useFetch<RouteGroup[]>(
        ['sales_collections_by_route'],
        async () => {
            // 1. Fetch all receipts
            const { data: receipts, error: receiptsError } = await supabase
                .from('sales_receipts')
                .select('id, receipt_number, amount, amount_collected, status, payment_method, invoice_id')
                .order('created_at', { ascending: false });

            if (receiptsError) return { data: null, error: receiptsError };

            // 2. Get unique invoice ids
            const invoiceIds = Array.from(
                new Set((receipts || []).map((r: any) => r.invoice_id).filter(Boolean)),
            );

            const invoiceVanMap = new Map<string, string>(); // invoice_id → van_id
            if (invoiceIds.length > 0) {
                const { data: invoices, error: invoicesError } = await supabase
                    .from('sales_invoices')
                    .select('id, route_id')
                    .in('id', invoiceIds);

                if (invoicesError) return { data: null, error: invoicesError };
                (invoices || []).forEach((inv: any) => {
                    if (inv.route_id) invoiceVanMap.set(inv.id, inv.route_id);
                });
            }

            // 3. Get unique van ids
            const vanIds = Array.from(new Set(Array.from(invoiceVanMap.values())));
            const vanMap = new Map<string, { van_id: string; driver_name: string; route_area: string }>();
            if (vanIds.length > 0) {
                const { data: vans, error: vansError } = await supabase
                    .from('vans')
                    .select('id, van_id, driver_name, route_area')
                    .in('id', vanIds);

                if (vansError) return { data: null, error: vansError };
                (vans || []).forEach((v: any) => vanMap.set(v.id, v));
            }

            // 4. Group receipts by van
            const groups = new Map<string, RouteGroup>();

            // Add an "Unknown Route" bucket for receipts without a van
            const unknownKey = '__unknown__';

            for (const r of receipts || []) {
                const vanId = r.invoice_id ? invoiceVanMap.get(r.invoice_id) : null;
                const van = vanId ? vanMap.get(vanId) : null;
                const key = vanId ?? unknownKey;

                if (!groups.has(key)) {
                    groups.set(key, {
                        vanId: key,
                        vanLabel: van ? `${van.van_id} — ${van.route_area}` : 'Unknown Route',
                        driverName: van?.driver_name ?? '—',
                        routeArea: van?.route_area ?? '—',
                        receipts: [],
                        totalAmount: 0,
                        totalCollected: 0,
                    });
                }

                const g = groups.get(key)!;
                g.receipts.push(r);
                g.totalAmount += Number(r.amount || 0);
                g.totalCollected += Number(r.amount_collected || 0);
            }

            return { data: Array.from(groups.values()), error: null };
        },
    );

    const groups: RouteGroup[] = routeGroups ?? [];

    const handleSaveRoute = useCallback(async (group: RouteGroup) => {
        const rawVal = routeEdits[group.vanId];
        if (rawVal === undefined) return;
        const cashIn = parseFloat(rawVal) || 0;
        if (cashIn <= 0) {
            toast.error('Enter an amount greater than zero');
            return;
        }

        setSavingIds(prev => new Set(prev).add(group.vanId));
        try {
            // Distribute cashIn across pending receipts (FIFO)
            let remaining = cashIn;
            const pending = group.receipts.filter(r => r.status !== 'Cleared');

            for (const receipt of pending) {
                if (remaining <= 0) break;
                const alreadyCollected = Number(receipt.amount_collected || 0);
                const outstanding = Number(receipt.amount || 0) - alreadyCollected;
                if (outstanding <= 0) continue;

                const applying = Math.min(remaining, outstanding);
                const newCollected = alreadyCollected + applying;
                const newStatus = newCollected >= Number(receipt.amount || 0) ? 'Cleared' : 'Confirmed';
                remaining -= applying;

                const { error } = await supabase
                    .from('sales_receipts')
                    .update({
                        amount_collected: newCollected,
                        collected_at: new Date().toISOString(),
                        status: newStatus,
                    })
                    .eq('id', receipt.id);

                if (error) throw error;
            }

            // Auto-post GL: DR Cash/Bank, CR Accounts Receivable
            await autoPostJournal({
                event: 'RECEIPT_RECEIVED',
                amount: cashIn,
                date: new Date().toISOString().split('T')[0],
                description: `Route collection — ${group.driverName} (${group.routeArea})`,
                refNumber: group.vanLabel,
                paymentMethod: 'Cash',
            });

            toast.success(`Collection of ${formatCurrency(cashIn)} saved for ${group.driverName}`);
            setRouteEdits(prev => {
                const next = { ...prev };
                delete next[group.vanId];
                return next;
            });
            queryClient.invalidateQueries({ queryKey: ['sales_collections_by_route'] });
        } catch (err: any) {
            toast.error('Failed to save: ' + err.message);
        } finally {
            setSavingIds(prev => {
                const next = new Set(prev);
                next.delete(group.vanId);
                return next;
            });
        }
    }, [routeEdits, queryClient]);

    const toggleExpand = (vanId: string) => {
        setExpandedRoutes(prev => {
            const next = new Set(prev);
            if (next.has(vanId)) next.delete(vanId);
            else next.add(vanId);
            return next;
        });
    };

    const totalReceiptAmount = groups.reduce((s, g) => s + g.totalAmount, 0);
    const totalCollected = groups.reduce((s, g) => s + g.totalCollected, 0);
    const pendingBalance = totalReceiptAmount - totalCollected;
    const clearedRoutes = groups.filter(g => g.totalCollected >= g.totalAmount && g.totalAmount > 0).length;

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="Sales Collections"
                subtitle="Record cash collected from salespersons by route"
                breadcrumbs={[{ label: 'Accounting', href: '/accounting/journal' }, { label: 'Collections' }]}
            />

            <div className="animate-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                <StatCard title="Total Receipted" value={formatCurrency(totalReceiptAmount)} icon={<Banknote size={20} />} color="blue" />
                <StatCard title="Total Collected" value={formatCurrency(totalCollected)} icon={<CheckCircle size={20} />} color="green" />
                <StatCard title="Pending Balance" value={formatCurrency(pendingBalance)} icon={<AlertTriangle size={20} />} color="amber" />
                <StatCard title="Routes Cleared" value={clearedRoutes} icon={<CheckCircle size={20} />} color="teal" />
            </div>

            <div className="coll-table-wrap">
                {loading ? (
                    <div className="coll-empty"><Loader2 size={22} className="coll-spin" /> Loading...</div>
                ) : groups.length === 0 ? (
                    <div className="coll-empty">No receipts found.</div>
                ) : (
                    <table className="coll-table">
                        <thead>
                            <tr>
                                <th style={{ width: 32 }}></th>
                                <th>Route</th>
                                <th>Sales Person</th>
                                <th style={{ textAlign: 'center' }}>Receipts</th>
                                <th style={{ textAlign: 'right' }}>Total Invoiced</th>
                                <th style={{ textAlign: 'right' }}>Already Collected</th>
                                <th style={{ textAlign: 'right' }}>Outstanding</th>
                                <th style={{ textAlign: 'right' }}>Enter Cash Collected</th>
                                <th style={{ textAlign: 'center' }}>Status</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {groups.map(group => {
                                const isEditing = routeEdits[group.vanId] !== undefined;
                                const isSaving = savingIds.has(group.vanId);
                                const isExpanded = expandedRoutes.has(group.vanId);
                                const outstanding = group.totalAmount - group.totalCollected;
                                const isCleared = outstanding <= 0 && group.totalAmount > 0;
                                const pendingCount = group.receipts.filter(r => r.status !== 'Cleared').length;

                                return (
                                    <React.Fragment key={group.vanId}>
                                        {/* Route summary row */}
                                        <tr className={isCleared ? 'coll-row cleared' : 'coll-row route-row'}>
                                            <td>
                                                <button
                                                    className="coll-expand-btn"
                                                    onClick={() => toggleExpand(group.vanId)}
                                                    title={isExpanded ? 'Collapse' : 'Expand receipts'}
                                                >
                                                    {isExpanded
                                                        ? <ChevronDown size={14} />
                                                        : <ChevronRight size={14} />}
                                                </button>
                                            </td>
                                            <td>
                                                <span className="coll-route-label">{group.vanLabel}</span>
                                            </td>
                                            <td>
                                                <span className="coll-name">{group.driverName}</span>
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <span className="coll-badge">{group.receipts.length}</span>
                                                {pendingCount > 0 && (
                                                    <span className="coll-pending-badge">{pendingCount} pending</span>
                                                )}
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <span className="coll-amount">{formatCurrency(group.totalAmount)}</span>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <span className="coll-amount" style={{ color: 'var(--success-600, #16a34a)' }}>
                                                    {formatCurrency(group.totalCollected)}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <span className={`coll-balance ${outstanding > 0 ? 'due' : 'clear'}`}>
                                                    {formatCurrency(Math.max(0, outstanding))}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                {!isCleared && (
                                                    <input
                                                        type="number"
                                                        className={`coll-input ${isEditing ? 'active' : ''}`}
                                                        value={isEditing ? routeEdits[group.vanId] : ''}
                                                        min={0}
                                                        max={outstanding}
                                                        step="0.01"
                                                        placeholder="0.00"
                                                        onChange={e =>
                                                            setRouteEdits(prev => ({ ...prev, [group.vanId]: e.target.value }))
                                                        }
                                                        disabled={isSaving}
                                                    />
                                                )}
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <StatusBadge
                                                    status={isCleared ? 'Cleared' : 'Pending'}
                                                    variant={isCleared ? 'success' : 'warning'}
                                                />
                                            </td>
                                            <td>
                                                {isEditing && !isCleared && (
                                                    <button
                                                        onClick={() => handleSaveRoute(group)}
                                                        disabled={isSaving}
                                                        className="coll-save-btn"
                                                    >
                                                        {isSaving
                                                            ? <Loader2 size={13} className="coll-spin" />
                                                            : <Save size={13} />}
                                                        {isSaving ? 'Saving…' : 'Save'}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>

                                        {/* Expanded receipt detail rows */}
                                        {isExpanded && group.receipts.map(r => {
                                            const rOutstanding = Number(r.amount || 0) - Number(r.amount_collected || 0);
                                            const rCleared = rOutstanding <= 0;
                                            return (
                                                <tr key={r.id} className="coll-row detail-row">
                                                    <td></td>
                                                    <td colSpan={2}>
                                                        <span className="coll-mono">{r.receipt_number}</span>
                                                    </td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        <span className="coll-detail-method">{r.payment_method}</span>
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        <span className="coll-amount">{formatCurrency(r.amount || 0)}</span>
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        <span className="coll-amount" style={{ color: 'var(--success-600, #16a34a)' }}>
                                                            {formatCurrency(r.amount_collected || 0)}
                                                        </span>
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        <span className={`coll-balance ${rOutstanding > 0 ? 'due' : 'clear'}`}>
                                                            {formatCurrency(Math.max(0, rOutstanding))}
                                                        </span>
                                                    </td>
                                                    <td></td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        <StatusBadge
                                                            status={rCleared ? 'Cleared' : r.status}
                                                            variant={rCleared ? 'success' : 'warning'}
                                                        />
                                                    </td>
                                                    <td></td>
                                                </tr>
                                            );
                                        })}
                                    </React.Fragment>
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
                    padding: 12px 14px;
                    font-size: 10px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.06em;
                    color: var(--slate-500);
                    white-space: nowrap;
                }
                .coll-table td {
                    padding: 11px 14px;
                    border-bottom: 1px solid var(--slate-100);
                    vertical-align: middle;
                }
                .coll-row:last-child td { border-bottom: none; }
                .coll-row.route-row:hover td { background: rgba(59,130,246,0.02); }
                .coll-row.cleared td { background: rgba(16,185,129,0.025); }
                .coll-row.detail-row td {
                    background: var(--slate-50);
                    padding-top: 8px;
                    padding-bottom: 8px;
                    border-bottom: 1px solid var(--slate-100);
                }

                .coll-expand-btn {
                    background: none;
                    border: none;
                    cursor: pointer;
                    padding: 2px;
                    color: var(--slate-400);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 4px;
                    transition: color 0.15s, background 0.15s;
                }
                .coll-expand-btn:hover {
                    color: var(--primary-600);
                    background: var(--slate-100);
                }

                .coll-route-label {
                    font-weight: 700;
                    color: var(--primary-600);
                    font-size: 12px;
                }
                .coll-mono {
                    font-family: var(--font-mono, monospace);
                    font-size: 11px;
                    font-weight: 600;
                    color: var(--slate-500);
                }
                .coll-name {
                    font-weight: 500;
                    color: var(--slate-700);
                }
                .coll-badge {
                    display: inline-block;
                    padding: 2px 7px;
                    border-radius: 10px;
                    background: var(--slate-100);
                    color: var(--slate-600);
                    font-size: 11px;
                    font-weight: 600;
                    margin-right: 4px;
                }
                .coll-pending-badge {
                    display: inline-block;
                    padding: 2px 6px;
                    border-radius: 10px;
                    background: rgba(245,158,11,0.12);
                    color: var(--amber-700, #b45309);
                    font-size: 10px;
                    font-weight: 600;
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
                .coll-detail-method {
                    font-size: 10px;
                    font-weight: 600;
                    color: var(--slate-500);
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
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
