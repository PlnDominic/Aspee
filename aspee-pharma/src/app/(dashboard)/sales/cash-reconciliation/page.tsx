'use client';

import React, { useMemo, useState } from 'react';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';
import { Banknote, CheckCircle, AlertTriangle, Download, Filter, Users, Truck, Calendar } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/currency';
import { useFetch } from '@/lib/hooks';
import { exportToCsv } from '@/lib/csvExport';

interface ReconRow {
    id: string;
    receipt_number: string;
    date: string;
    customer_name: string | null;
    sales_rep_id: string | null;
    sales_rep_name: string | null;
    route_id: string | null;
    route_name: string | null;
    payment_method: string;
    amount_registered: number;
    amount_confirmed: number;
    variance: number;
    confirmation_status: string;
    variance_reason: string | null;
}

type GroupBy = 'none' | 'sales_person' | 'route' | 'date';

function todayMinus(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
}

export default function CashReconciliationPage() {
    const [fromDate, setFromDate] = useState<string>(todayMinus(30));
    const [toDate, setToDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [salesPersonId, setSalesPersonId] = useState<string>('');
    const [routeId, setRouteId] = useState<string>('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [groupBy, setGroupBy] = useState<GroupBy>('sales_person');

    const { data: salesPersons = [] } = useFetch<any[]>(['recon_sales_persons'], async () => {
        const { data, error } = await supabase
            .from('sales_reps')
            .select('id, name')
            .eq('status', 'Active')
            .order('name');
        return { data, error };
    });

    const { data: vans = [] } = useFetch<any[]>(['recon_vans'], async () => {
        const { data, error } = await supabase
            .from('vans')
            .select('id, van_number, driver_name, route_name')
            .order('van_number');
        return { data, error };
    });

    const { data: rows = [], isLoading: loading } = useFetch<ReconRow[]>(
        ['recon', fromDate, toDate, salesPersonId, routeId, statusFilter],
        async () => {
            let q = supabase
                .from('v_sales_receipt_reconciliation')
                .select('id, receipt_number, date, customer_name, sales_rep_id, sales_rep_name, route_id, route_name, payment_method, amount_registered, amount_confirmed, variance, confirmation_status, variance_reason')
                .gte('date', fromDate)
                .lte('date', toDate)
                .order('date', { ascending: false });

            if (salesPersonId) q = q.eq('sales_rep_id', salesPersonId);
            if (routeId) q = q.eq('route_id', routeId);
            if (statusFilter !== 'all') q = q.eq('confirmation_status', statusFilter);

            const { data, error } = await q;
            if (error) return { data: null, error };
            return {
                data: (data as any[]).map(r => ({
                    ...r,
                    amount_registered: Number(r.amount_registered || 0),
                    amount_confirmed: Number(r.amount_confirmed || 0),
                    variance: Number(r.variance || 0),
                })),
                error: null,
            };
        },
    );

    const stats = useMemo(() => {
        const totalReg = rows.reduce((s, r) => s + r.amount_registered, 0);
        const totalConf = rows.reduce((s, r) => s + r.amount_confirmed, 0);
        const totalVar = totalReg - totalConf;
        return {
            count: rows.length,
            totalReg,
            totalConf,
            totalVar,
            varianceRows: rows.filter(r => r.confirmation_status === 'variance').length,
            pendingRows: rows.filter(r => r.confirmation_status === 'registered').length,
        };
    }, [rows]);

    const grouped = useMemo(() => {
        if (groupBy === 'none') return null;
        const map = new Map<string, { label: string; rows: ReconRow[] }>();
        rows.forEach(r => {
            let key: string;
            let label: string;
            if (groupBy === 'sales_person') {
                key = r.sales_rep_id ?? 'unassigned';
                label = r.sales_rep_name ?? '— Unassigned —';
            } else if (groupBy === 'route') {
                key = r.route_id ?? 'unassigned';
                label = r.route_name ?? '— No Route —';
            } else {
                key = r.date;
                label = new Date(r.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            }
            if (!map.has(key)) map.set(key, { label, rows: [] });
            map.get(key)!.rows.push(r);
        });
        return Array.from(map.entries()).map(([key, val]) => {
            const reg = val.rows.reduce((s, r) => s + r.amount_registered, 0);
            const conf = val.rows.reduce((s, r) => s + r.amount_confirmed, 0);
            return { key, label: val.label, rows: val.rows, totalReg: reg, totalConf: conf, totalVar: reg - conf };
        }).sort((a, b) => b.totalReg - a.totalReg);
    }, [rows, groupBy]);

    const handleExport = () => {
        try {
            exportToCsv(`cash-reconciliation-${fromDate}-to-${toDate}.csv`, rows, [
                { header: 'Receipt No.', accessor: r => r.receipt_number },
                { header: 'Date', accessor: r => r.date },
                { header: 'Customer', accessor: r => r.customer_name ?? '' },
                { header: 'Sales Person', accessor: r => r.sales_rep_name ?? '' },
                { header: 'Route', accessor: r => r.route_name ?? '' },
                { header: 'Method', accessor: r => r.payment_method },
                { header: 'Registered (GHS)', accessor: r => r.amount_registered.toFixed(2) },
                { header: 'Confirmed (GHS)', accessor: r => r.amount_confirmed.toFixed(2) },
                { header: 'Variance (GHS)', accessor: r => (r.amount_registered - r.amount_confirmed).toFixed(2) },
                { header: 'Status', accessor: r => r.confirmation_status },
                { header: 'Variance Reason', accessor: r => r.variance_reason ?? '' },
            ]);
        } catch (e: any) {
            alert(e.message);
        }
    };

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="Cash Reconciliation Report"
                subtitle="Match cash registered by Sales against cash confirmed by Accounts"
                breadcrumbs={[{ label: 'Sales', href: '/sales/cash-reconciliation' }, { label: 'Cash Reconciliation' }]}
                actions={
                    <button onClick={handleExport} disabled={rows.length === 0} className="rec-export-btn">
                        <Download size={14} /> Export CSV
                    </button>
                }
            />

            <div className="rec-filter-card">
                <div className="rec-filter-row">
                    <div className="rec-filter-field">
                        <label><Calendar size={11} /> From</label>
                        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
                    </div>
                    <div className="rec-filter-field">
                        <label><Calendar size={11} /> To</label>
                        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
                    </div>
                    <div className="rec-filter-field">
                        <label><Users size={11} /> Sales Person</label>
                        <select value={salesPersonId} onChange={e => setSalesPersonId(e.target.value)}>
                            <option value="">All</option>
                            {salesPersons.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    <div className="rec-filter-field">
                        <label><Truck size={11} /> Route</label>
                        <select value={routeId} onChange={e => setRouteId(e.target.value)}>
                            <option value="">All</option>
                            {vans.map((v: any) => (
                                <option key={v.id} value={v.id}>
                                    {v.van_number ?? v.route_name ?? 'Van'} {v.driver_name ? `· ${v.driver_name}` : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="rec-filter-field">
                        <label><Filter size={11} /> Status</label>
                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                            <option value="all">All</option>
                            <option value="registered">Pending Confirmation</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="variance">With Variance</option>
                        </select>
                    </div>
                    <div className="rec-filter-field">
                        <label>Group By</label>
                        <select value={groupBy} onChange={e => setGroupBy(e.target.value as GroupBy)}>
                            <option value="sales_person">Sales Person</option>
                            <option value="route">Route</option>
                            <option value="date">Date</option>
                            <option value="none">None (flat)</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="animate-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                <StatCard title="Registered" value={formatCurrency(stats.totalReg)} icon={<Banknote size={20} />} color="blue" />
                <StatCard title="Confirmed" value={formatCurrency(stats.totalConf)} icon={<CheckCircle size={20} />} color="green" />
                <StatCard
                    title={stats.totalVar >= 0 ? 'Shortfall' : 'Surplus'}
                    value={formatCurrency(Math.abs(stats.totalVar))}
                    icon={<AlertTriangle size={20} />}
                    color="amber"
                />
                <StatCard title="Receipts" value={stats.count} icon={<Banknote size={20} />} color="teal" />
            </div>

            {loading ? (
                <div className="rec-empty">Loading reconciliation data...</div>
            ) : rows.length === 0 ? (
                <div className="rec-empty">No receipts found for these filters.</div>
            ) : grouped ? (
                <div className="rec-groups">
                    {grouped.map(g => (
                        <div key={g.key} className="rec-group">
                            <div className="rec-group-header">
                                <div className="rec-group-title">{g.label}</div>
                                <div className="rec-group-totals">
                                    <span>Registered: <strong>{formatCurrency(g.totalReg)}</strong></span>
                                    <span>Confirmed: <strong>{formatCurrency(g.totalConf)}</strong></span>
                                    <span style={{ color: Math.abs(g.totalVar) >= 0.01 ? 'var(--warning)' : 'var(--slate-500)' }}>
                                        Variance: <strong>{formatCurrency(g.totalVar)}</strong>
                                    </span>
                                </div>
                            </div>
                            <ReconTable rows={g.rows} />
                        </div>
                    ))}
                </div>
            ) : (
                <div className="rec-table-card">
                    <ReconTable rows={rows} />
                </div>
            )}

            <style>{`
                .rec-export-btn {
                    display: inline-flex; align-items: center; gap: 6px;
                    padding: 8px 14px; border-radius: 8px;
                    border: 1.5px solid var(--slate-200); background: var(--card-bg);
                    color: var(--slate-700); font-size: 11px; font-weight: 600;
                    cursor: pointer;
                }
                .rec-export-btn:hover { background: var(--slate-50); }
                .rec-export-btn:disabled { opacity: 0.5; cursor: not-allowed; }

                .rec-filter-card {
                    background: var(--card-bg);
                    border: 1.5px solid var(--slate-200);
                    border-radius: 12px;
                    padding: 16px;
                    margin-bottom: 20px;
                }
                .rec-filter-row {
                    display: grid;
                    grid-template-columns: repeat(6, 1fr);
                    gap: 12px;
                }
                .rec-filter-field { display: flex; flex-direction: column; gap: 4px; }
                .rec-filter-field label {
                    display: inline-flex; align-items: center; gap: 4px;
                    font-size: 10px; font-weight: 600;
                    text-transform: uppercase; letter-spacing: 0.05em;
                    color: var(--slate-500);
                }
                .rec-filter-field input, .rec-filter-field select {
                    padding: 7px 9px;
                    border: 1.5px solid var(--slate-200);
                    border-radius: 7px;
                    font-size: 11px;
                    background: var(--card-bg);
                    color: var(--foreground);
                    outline: none;
                }

                .rec-empty {
                    background: var(--card-bg);
                    border: 1.5px solid var(--slate-200);
                    border-radius: 12px;
                    padding: 60px;
                    text-align: center;
                    color: var(--slate-400);
                    font-size: 13px;
                }

                .rec-groups { display: flex; flex-direction: column; gap: 16px; }
                .rec-group {
                    background: var(--card-bg);
                    border: 1.5px solid var(--slate-200);
                    border-radius: 12px;
                    overflow: hidden;
                }
                .rec-group-header {
                    padding: 12px 18px;
                    background: var(--slate-50);
                    border-bottom: 1.5px solid var(--slate-100);
                    display: flex; align-items: center; justify-content: space-between;
                    flex-wrap: wrap; gap: 12px;
                }
                .rec-group-title { font-size: 12px; font-weight: 700; color: var(--slate-700); }
                .rec-group-totals {
                    display: flex; gap: 18px; font-size: 11px; color: var(--slate-600);
                }

                .rec-table-card {
                    background: var(--card-bg);
                    border: 1.5px solid var(--slate-200);
                    border-radius: 12px;
                    overflow: hidden;
                }
                .rec-table {
                    width: 100%; border-collapse: collapse; font-size: 11px;
                }
                .rec-table th {
                    padding: 10px 14px;
                    background: var(--slate-50);
                    font-size: 10px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: var(--slate-500);
                    text-align: left;
                    border-bottom: 1.5px solid var(--slate-100);
                }
                .rec-table td {
                    padding: 10px 14px;
                    border-bottom: 1px solid var(--slate-100);
                }
                .rec-table tr:last-child td { border-bottom: none; }
                .rec-mono {
                    font-family: var(--font-mono, monospace);
                    font-weight: 600;
                    color: var(--primary-600);
                }
                .rec-variance-pos { font-weight: 700; color: var(--danger); }
                .rec-variance-neg { font-weight: 700; color: var(--warning); }
                .rec-variance-zero { color: var(--slate-400); }
            `}</style>
        </div>
    );
}

function ReconTable({ rows }: { rows: ReconRow[] }) {
    return (
        <table className="rec-table">
            <thead>
                <tr>
                    <th>Receipt</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Sales Person</th>
                    <th>Route</th>
                    <th>Method</th>
                    <th style={{ textAlign: 'right' }}>Registered</th>
                    <th style={{ textAlign: 'right' }}>Confirmed</th>
                    <th style={{ textAlign: 'right' }}>Variance</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                </tr>
            </thead>
            <tbody>
                {rows.map(r => {
                    const v = r.amount_registered - r.amount_confirmed;
                    const hasVar = Math.abs(v) >= 0.01;
                    return (
                        <tr key={r.id}>
                            <td><span className="rec-mono">{r.receipt_number}</span></td>
                            <td>{new Date(r.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}</td>
                            <td>{r.customer_name || '—'}</td>
                            <td>{r.sales_rep_name || '—'}</td>
                            <td>{r.route_name || '—'}</td>
                            <td>{r.payment_method}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(r.amount_registered)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(r.amount_confirmed)}</td>
                            <td style={{ textAlign: 'right' }} className={!hasVar ? 'rec-variance-zero' : v > 0 ? 'rec-variance-pos' : 'rec-variance-neg'}>
                                {hasVar ? formatCurrency(v) : '—'}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                                <StatusBadge
                                    status={r.confirmation_status === 'confirmed' ? 'Confirmed' : r.confirmation_status === 'variance' ? 'Variance' : 'Pending'}
                                    variant={r.confirmation_status === 'confirmed' ? 'success' : r.confirmation_status === 'variance' ? 'warning' : 'default'}
                                />
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}
