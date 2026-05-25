'use client';

import React, { useState, useMemo, useEffect } from 'react';
import StatusBadge from '@/components/StatusBadge';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import EntityLink from '@/components/EntityLink';
import { useFetch, useCurrentUser } from '@/lib/hooks';
import { checkAndNotifyOverdueInvoices, checkAndNotifyExpiringStock } from '@/lib/notifications';
import {
    AlertTriangle,
    ShieldCheck,
    Banknote,
    FileText,
    ShoppingCart,
    Clock,
    Truck,
    TrendingUp,
    TrendingDown,
    ArrowUpRight,
    Calendar,
    Activity,
    DollarSign,
    BarChart3,
    Layers,
    User,
} from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area,
    LineChart,
    Line,
    PieChart,
    Pie,
    Cell,
} from 'recharts';

// ─── Helpers ───────────────────────────────────────
const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ─── Shared Styles ───────────────────────────────────────
const cardStyle: React.CSSProperties = {
    background: 'var(--card-bg)',
    border: 'var(--card-border)',
    borderRadius: 24,
    padding: '24px',
    transition: 'all 0.3s ease',
    boxShadow: 'var(--card-shadow)',
};

const sectionTitle: React.CSSProperties = {
    fontSize: 16, fontWeight: 700, color: 'var(--slate-900)', letterSpacing: '-0.02em',
};

const sectionSub: React.CSSProperties = {
    fontSize: 11, color: 'var(--slate-400)', marginTop: 2, fontWeight: 500,
};

// New KPI Configs for SaaS dashboard
const kpiConfigs = [
    { iconBg: 'rgba(59, 130, 246, 0.1)', iconColor: 'var(--primary-500)', label: 'Revenue' },
    { iconBg: 'rgba(16, 185, 129, 0.1)', iconColor: 'var(--success)', label: 'Orders' },
    { iconBg: 'rgba(245, 158, 11, 0.1)', iconColor: 'var(--warning)', label: 'Customers' },
    { iconBg: 'rgba(139, 92, 246, 0.1)', iconColor: 'var(--secondary-500)', label: 'Avg Order Value' },
];

export default function DashboardPage() {
    const { data: user } = useCurrentUser();

    React.useEffect(() => {
        checkAndNotifyOverdueInvoices();
        checkAndNotifyExpiringStock();
    }, []);

    // ─── Filters & State ───────────────────────────────────────
    const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().substring(0, 7));
    const [chartsMounted, setChartsMounted] = useState(false);

    useEffect(() => {
        setChartsMounted(true);
    }, []);

    // ─── Aggregated Dashboard Stats ───────────────────────────────────────
    // Scalability Fix: Don't fetch everything and process in JS.
    const { data: stats, isLoading: statsLoading } = useFetch<any>(
        ['dashboard-stats-summary'],
        async () => {
            const { data, error } = await supabase.rpc('get_dashboard_stats');
            return { data, error };
        }
    );

    const {
        totalProducts = 0,
        totalCustomers = 0,
        activePOs = 0,
        lowStockCount = 0,
        todaysRevenue = 0,
        outstandingTotal = 0,
        outstandingCount = 0,
        salesData = [],
        revenueData = []
    } = stats || {};

    // For the UI, we need the low stock items as well (Recent alerts)
    const { data: lowStockItems = [] } = useFetch<any[]>(
        ['dashboard-low-stock-items'],
        async () => {
            const { data, error } = await supabase
                .from('stock_levels')
                .select('qty_on_hand, product:products(name, sku, reorder_level)')
                .limit(5); // Explicit limit for dashboard

            return { 
                data: (data || []).map(item => ({
                    product: (item.product as any)?.name,
                    sku: (item.product as any)?.sku,
                    current: item.qty_on_hand,
                    reorder: (item.product as any)?.reorder_level || 0
                })), 
                error 
            };
        }
    );

    // 5. Recent Activity
    const { data: recentActivity = [] } = useFetch<any[]>(
        ['dashboard-recent-activity'],
        async () => {
            const { data: movements, error } = await supabase
                .from('stock_movements')
                .select('*, product:products(name)')
                .order('created_at', { ascending: false })
                .limit(6);

            if (error || !movements) {
                return { data: [{ type: 'transfer', action: 'System online', user: 'Admin', time: new Date().toLocaleDateString() }], error: null };
            }

            const activities = movements.map(m => {
                let type = 'transfer';
                let action = `Transferred ${m.quantity} ${m.product?.name}`;
                if (m.reference_type === 'Sales Invoice') {
                    type = 'sale'; action = `Sold ${m.quantity} ${m.product?.name}`;
                } else if (m.reference_type === 'GRN') {
                    type = 'purchase'; action = `Received ${m.quantity} ${m.product?.name}`;
                } else if (m.reference_type === 'QA Finished Goods') {
                    type = 'payment'; action = `Produced ${m.quantity} ${m.product?.name}`;
                }

                return {
                    type, action,
                    user: 'System Activity',
                    time: new Date(m.created_at).toLocaleDateString()
                };
            });

            return { data: activities, error: null };
        }
    );

    // 6. Van Status
    const { data: vanStatus = [] } = useFetch<any[]>(
        ['dashboard-van-status'],
        async () => {
            const { data: vansData, error } = await supabase
                .from('vans')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(10);

            if (error || !vansData || vansData.length === 0) {
                return { data: [], error: null };
            }

            const formattedVans = vansData.map((van: any) => ({
                van: van.name || van.van_id || 'Unnamed Van',
                driver: van.driver_name || van.driver_id || 'Unassigned',
                loaded: van.loaded_value || van.customer_count || 0,
                sold: van.today_sales || 0,
                status: van.status || 'Active'
            }));

            return { data: formattedVans, error: null };
        }
    );

    // 7. Expiry Alerts
    const { data: expiryAlerts = [] } = useFetch<any[]>(
        ['dashboard-expiry-alerts'],
        async () => {
            const { data: grnItems, error } = await supabase
                .from('grn_items')
                .select('*, product:products(name), grn:goods_receipt_notes(batch_number)')
                .not('expiry_date', 'is', null);

            if (error || !grnItems) return { data: [], error: null };

            const today = new Date();
            const ninetyDaysFromNow = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);

            const expiryList = grnItems
                .filter((item: any) => {
                    if (!item.expiry_date) return false;
                    const expiryDate = new Date(item.expiry_date);
                    return expiryDate >= today && expiryDate <= ninetyDaysFromNow;
                })
                .map((item: any) => {
                    const expiryDate = new Date(item.expiry_date);
                    const daysUntil = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    return {
                        product: item.product?.name || 'Unknown Product',
                        batch: item.batch_number || item.grn?.batch_number || 'N/A',
                        qty: item.quantity || 0,
                        days: daysUntil,
                        expiry: expiryDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                    };
                })
                .sort((a: any, b: any) => a.days - b.days)
                .slice(0, 5);

            return { data: expiryList, error: null };
        }
    );

    // 8. Regulatory renewals due soon
    const { data: regulatorRenewalsDue = [] } = useFetch<any[]>(
        ['dashboard-regulatory-renewals'],
        async () => {
            const { data, error } = await supabase
                .from('regulatory_documents')
                .select('id, regulator_name, document_type, expiry_date, reminder_days')
                .order('expiry_date', { ascending: true });

            if (error) return { data: [], error: null };

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const filtered = (data || []).filter((r: any) => {
                if (!r.expiry_date) return false;
                const exp = new Date(r.expiry_date);
                exp.setHours(0, 0, 0, 0);
                const days = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                const lead = Number(r.reminder_days) || 60;
                return days <= lead;
            }).map(r => ({
                id: r.id,
                name: r.regulator_name,
                type: r.document_type,
                days: Math.ceil((new Date(r.expiry_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
            })).slice(0, 5);

            return { data: filtered, error: null };
        }
    );

    // 9. QA Operational Health
    const { data: qaStats } = useFetch<{ passed: number; failed: number; pending: number }>(
        ['dashboard-qa-stats'],
        async () => {
            const [{ data: ipc }, { data: fp }] = await Promise.all([
                supabase.from('qa_in_process').select('status'),
                supabase.from('qa_finished_products').select('overall_status')
            ]);

            const ipcStats = (ipc || []).reduce((acc: any, curr: any) => {
                const s = curr.status;
                if (s === 'Passed') acc.passed++;
                else if (s === 'Failed') acc.failed++;
                else acc.pending++;
                return acc;
            }, { passed: 0, failed: 0, pending: 0 });

            const fpStats = (fp || []).reduce((acc: any, curr: any) => {
                const s = curr.overall_status;
                if (s === 'Passed') acc.passed++;
                else if (s === 'Failed') acc.failed++;
                else acc.pending++;
                return acc;
            }, { passed: 0, failed: 0, pending: 0 });

            return {
                data: {
                    passed: ipcStats.passed + fpStats.passed,
                    failed: ipcStats.failed + fpStats.failed,
                    pending: ipcStats.pending + fpStats.pending
                },
                error: null
            };
        }
    );

    // 10. Production Status
    const { data: prodStats } = useFetch<{ inProgress: number; completed: number; released: number }>(
        ['dashboard-prod-stats'],
        async () => {
            const { data } = await supabase.from('production_orders').select('status');
            const stats = (data || []).reduce((acc: any, curr: any) => {
                const s = curr.status;
                if (s === 'In Progress') acc.inProgress++;
                else if (s === 'Completed') acc.completed++;
                else if (s === 'Released') acc.released++;
                return acc;
            }, { inProgress: 0, completed: 0, released: 0 });
            return { data: stats, error: null };
        }
    );

    // 11. A/R Aging
    const { data: agingData } = useFetch<{ current: number; over30: number; over60: number; over90: number }>(
        ['dashboard-ar-aging'],
        async () => {
            const { data } = await supabase
                .from('sales_invoices')
                .select('total_amount, date')
                .not('status', 'eq', 'Paid')
                .not('status', 'eq', 'Draft');

            const today = new Date();
            const aging = (data || []).reduce((acc: any, curr: any) => {
                const invDate = new Date(curr.date);
                const diffDays = Math.ceil((today.getTime() - invDate.getTime()) / (1000 * 60 * 60 * 24));
                const amt = Number(curr.total_amount);

                if (diffDays <= 30) acc.current += amt;
                else if (diffDays <= 60) acc.over30 += amt;
                else if (diffDays <= 90) acc.over60 += amt;
                else acc.over90 += amt;
                return acc;
            }, { current: 0, over30: 0, over60: 0, over90: 0 });
            return { data: aging, error: null };
        }
    );

    // 12. Hourly Activity (Heatmap)
    const { data: heatmapData } = useFetch<any[]>(
        ['dashboard-heatmap'],
        async () => {
            const { data } = await supabase
                .from('sales_invoices')
                .select('created_at')
                .order('created_at', { ascending: false })
                .limit(500);

            const hours = Array.from({ length: 24 }, () => 0);
            (data || []).forEach((inv: any) => {
                const hour = new Date(inv.created_at).getHours();
                hours[hour]++;
            });

            // Distribute across 7 days for the 7x20 grid (showing 140 points)
            return { data: Array.from({ length: 140 }, (_, i) => ({ id: i, value: hours[i % 24] })), error: null };
        }
    );

    // Value at Risk calculation
    const valueAtRisk = useMemo(() => {
        // High-level estimate based on expiry alerts
        return expiryAlerts.length * 4500; // Placeholder until we have cost prices in alerts hook
    }, [expiryAlerts]);

    const loading = statsLoading;
    const today = new Date();
    const greeting = today.getHours() < 12 ? 'Good Morning' : today.getHours() < 17 ? 'Good Afternoon' : 'Good Evening';
    const formattedDate = today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    const revenueByMonth = useMemo(() => {
        if (!revenueData.length) return 0;
        const monthData = revenueData.find((d: any) => {
            return d.name === monthNames[parseInt(selectedMonth.split('-')[1]) - 1];
        });
        return monthData?.revenue || 0;
    }, [revenueData, selectedMonth]);

    const avgOrderValue = activePOs > 0 ? todaysRevenue / activePOs : 0;

    const [activeTab, setActiveTab] = useState<'Pharmaceuticals' | 'Surgicals'>('Pharmaceuticals');

    // Calculated Performance Data from Live Hooks
    const verticalBarData = [
        { name: 'Pass', value: qaStats?.passed || 0 },
        { name: 'Fail', value: qaStats?.failed || 0 },
        { name: 'Pend', value: qaStats?.pending || 0 },
    ];

    const targetMet = (todaysRevenue / (25000)) * 100; // Assuming 25k daily target for Aspee Pharma
    const gaugeData = [
        { name: 'Performance', value: Math.min(targetMet, 100), fill: 'var(--primary-500)' },
        { name: 'Remaining', value: Math.max(100 - targetMet, 0), fill: 'var(--divider)' },
    ];

    return (
        <div className="animate-fade-in" style={{ opacity: loading ? 0.6 : 1, transition: 'opacity 0.3s' }}>
            {/* ─── Top Bar ─── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                <div>
                    <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--slate-900)', letterSpacing: '-0.03em' }}>Dashboard</h1>
                    <p style={{ fontSize: 13, color: 'var(--slate-500)', marginTop: 4 }}>Pharmaceutical distribution and sales performance monitoring</p>
                </div>
            </div>

            {/* ─── Top Row: 3 Detailed Cards ─── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 20, marginBottom: 24, alignItems: 'stretch' }}>
                {/* Inventory & Sales Overview */}
                <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <div style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <span style={{ fontSize: 12, color: 'var(--slate-500)', fontWeight: 500 }}>Inventory & Sales Overview</span>
                            <select 
                                value={selectedMonth} 
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                style={{ background: 'transparent', border: 'none', color: 'var(--slate-400)', fontSize: 12, outline: 'none', cursor: 'pointer' }}
                            >
                                {revenueData.map((d: any, idx: number) => {
                                    const mIdx = monthNames.indexOf(d.name) + 1;
                                    const mStr = `${new Date().getFullYear()}-${mIdx < 10 ? '0' + mIdx : mIdx}`;
                                    return <option key={idx} value={mStr}>{d.name}</option>;
                                })}
                            </select>
                        </div>
                        <h2 style={{ fontSize: 32, fontWeight: 800, color: 'var(--slate-900)', marginTop: 12, marginBottom: 24 }}>GH₵ {revenueByMonth.toLocaleString()}</h2>
                        
                        <div style={{ marginBottom: 16 }}>
                            <p style={{ fontSize: 11, color: 'var(--slate-500)', marginBottom: 8 }}>Category breakdown</p>
                            <div style={{ display: 'flex', gap: 2, background: 'var(--sidebar-hover)', padding: 2, borderRadius: 10 }}>
                                {['Pharmaceuticals', 'Surgicals'].map(tab => (
                                    <button 
                                        key={tab} 
                                        onClick={() => setActiveTab(tab as 'Pharmaceuticals' | 'Surgicals')}
                                        style={{ 
                                            flex: 1, padding: '8px', fontSize: 11, fontWeight: 600, borderRadius: 8, border: 'none',
                                            background: activeTab === tab ? 'var(--primary-500)' : 'transparent',
                                            color: activeTab === tab ? 'white' : 'var(--slate-500)',
                                            transition: '0.2s'
                                        }}
                                    >
                                        {tab}
                                    </button>
                                ))}
                                <div style={{ flex: 1, padding: '8px', fontSize: 11, color: 'var(--slate-700)', textAlign: 'center' }}>...</div>
                            </div>
                        </div>
                    </div>
                    <div style={{ marginTop: 'auto' }} />
                </div>

                {/* Active Sales */}
                <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                        <div>
                            <span style={{ fontSize: 12, color: 'var(--slate-500)', fontWeight: 500 }}>Current Sales Volume</span>
                            <h2 style={{ fontSize: 32, fontWeight: 800, color: 'var(--slate-900)', marginTop: 8 }}>GH₵ {todaysRevenue.toLocaleString()}</h2>
                        </div>
                        <div style={{ width: 100, height: 80 }}>
                            {chartsMounted && <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                                <BarChart data={verticalBarData}>
                                    <Bar dataKey="value" fill="var(--primary-500)" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>}
                        </div>
                    </div>
                    <div style={{ marginTop: 'auto' }}>
                        <p style={{ fontSize: 11, color: 'var(--slate-500)', marginBottom: 12 }}>
                            Total collections today
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <button style={{ background: 'transparent', border: 'none', color: 'var(--slate-500)', fontSize: 11, cursor: 'pointer' }}>See more details →</button>
                        </div>
                    </div>
                </div>

                {/* Consolidated Revenue */}
                <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                        <div>
                            <span style={{ fontSize: 12, color: 'var(--slate-500)', fontWeight: 500 }}>Consolidated Revenue</span>
                            <h2 style={{ fontSize: 32, fontWeight: 800, color: 'var(--slate-900)', marginTop: 8 }}>GH₵ {outstandingTotal.toLocaleString()}</h2>
                        </div>
                        <div style={{ width: 80, height: 80 }}>
                            {chartsMounted && <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                                <PieChart>
                                    <Pie data={gaugeData} innerRadius={25} outerRadius={35} paddingAngle={0} dataKey="value" stroke="none">
                                        {gaugeData.map((entry, index) => <Cell key={index} fill={entry.fill} />)}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>}
                        </div>
                    </div>
                    <div style={{ marginTop: 'auto' }}>
                        <p style={{ fontSize: 11, color: 'var(--slate-500)', marginBottom: 12 }}>
                            Over 30 days: <span style={{ color: 'var(--danger)', fontWeight: 600 }}>GH₵ {agingData?.over30.toLocaleString() || 0}</span>
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <button style={{ background: 'transparent', border: 'none', color: 'var(--slate-500)', fontSize: 11, cursor: 'pointer' }}>See more details →</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── Middle Row: Analytics & Sales Performance ─── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: 20, marginBottom: 24 }}>
                <div style={cardStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                        <div>
                            <h3 style={sectionTitle}>Analytics</h3>
                            <h2 style={{ fontSize: 24, fontWeight: 800, marginTop: 4, color: 'var(--slate-900)' }}>
                                GH₵ {todaysRevenue.toLocaleString()} <span style={{ fontSize: 12, color: 'var(--primary-500)', marginLeft: 8 }}>Today</span>
                            </h2>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <select style={{ background: 'var(--sidebar-hover)', border: '1px solid var(--sidebar-border)', borderRadius: 8, padding: '4px 12px', fontSize: 12, color: 'var(--slate-400)' }}>
                                <option>Last 7 Days</option>
                            </select>
                        </div>
                    </div>
                    <div style={{ height: 300 }}>
                        {chartsMounted && <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                            <AreaChart data={salesData}>
                                <defs>
                                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--primary-500)" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="var(--primary-500)" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--divider)" vertical={false} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--slate-500)' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--slate-500)' }} tickFormatter={(v) => `GH₵${v}`} />
                                <Tooltip 
                                    contentStyle={{ background: 'var(--card-bg)', border: 'var(--card-border)', borderRadius: 12 }}
                                    itemStyle={{ color: 'var(--primary-500)' }}
                                />
                                <Area type="monotone" dataKey="sales" stroke="var(--primary-500)" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                            </AreaChart>
                        </ResponsiveContainer>}
                    </div>
                </div>

                <div style={cardStyle}>
                    <h3 style={sectionTitle}>Target Attainment</h3>
                    <div style={{ height: 200, position: 'relative', marginTop: 24 }}>
                        {chartsMounted && <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                            <PieChart>
                                <Pie 
                                    data={gaugeData} 
                                    startAngle={180} 
                                    endAngle={0} 
                                    innerRadius={70} 
                                    outerRadius={90} 
                                    paddingAngle={0} 
                                    dataKey="value" 
                                    stroke="none"
                                >
                                    {gaugeData.map((entry, index) => <Cell key={index} fill={entry.fill} />)}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>}
                        <div style={{ position: 'absolute', top: '55%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                            <p style={{ fontSize: 28, fontWeight: 800, color: 'var(--slate-900)' }}>{targetMet.toFixed(1)}%</p>
                            <p style={{ fontSize: 11, color: 'var(--slate-500)' }}>Daily Sales Target Progress</p>
                        </div>
                    </div>
                    <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--primary-500)' }} />
                                <span style={{ fontSize: 11, color: 'var(--slate-400)' }}>Total sales per day</span>
                            </div>
                            <span style={{ fontSize: 11, color: 'var(--slate-500)' }}>Per week</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--foreground)' }} />
                                <span style={{ fontSize: 11, color: 'var(--slate-400)' }}>Target attainment</span>
                            </div>
                            <span style={{ fontSize: 11, color: 'var(--slate-500)' }}>For today</span>
                        </div>
                    </div>
                    <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'center', paddingTop: 20 }}>
                        <button style={{ background: 'transparent', border: 'none', color: 'var(--slate-500)', fontSize: 11, cursor: 'pointer' }}>See more details →</button>
                    </div>
                </div>
            </div>

            {/* ─── Row 3: Operational Health & Heatmap ─── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 20, marginBottom: 24 }}>
                <div style={cardStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <h3 style={sectionTitle}>Operational Health</h3>
                        <Activity size={20} color="var(--primary-400)" />
                    </div>
                    <div style={{ height: 180, marginTop: 10 }}>
                        <p style={{ fontSize: 11, color: 'var(--slate-500)', marginBottom: 12 }}>QA Status & Production Flow</p>
                        {chartsMounted && <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                            <BarChart data={verticalBarData} layout="vertical">
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--slate-500)' }} width={40} />
                                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ background: 'var(--card-bg)', border: 'var(--card-border)', borderRadius: 8 }} />
                                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                                    {verticalBarData.map((entry, index) => (
                                        <Cell key={index} fill={entry.name === 'Pass' ? 'var(--success)' : entry.name === 'Fail' ? 'var(--danger)' : 'var(--warning)'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>}
                    </div>
                    <div style={{ marginTop: 20, display: 'flex', gap: 16 }}>
                        <div>
                            <p style={{ fontSize: 10, color: 'var(--slate-500)' }}>Active Production</p>
                            <p style={{ fontSize: 14, fontWeight: 700 }}>{prodStats?.inProgress || 0}</p>
                        </div>
                        <div style={{ width: 1, background: 'var(--divider)' }} />
                        <div>
                            <p style={{ fontSize: 10, color: 'var(--slate-500)' }}>Released Jobs</p>
                            <p style={{ fontSize: 14, fontWeight: 700 }}>{prodStats?.released || 0}</p>
                        </div>
                    </div>
                </div>

                <div style={cardStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                <Clock size={16} color="var(--primary-500)" />
                                <span style={{ fontSize: 12, fontWeight: 600 }}>Order Disbursement Frequency</span>
                            </div>
                            <h3 style={{ fontSize: 20, fontWeight: 800 }}>{heatmapData?.reduce((a, b) => a + (b.value || 0), 0) || 0} <span style={{ fontSize: 11, color: 'var(--slate-500)', marginLeft: 4 }}>Total operations (last 7d)</span></h3>
                        </div>
                        <button style={{ background: 'transparent', border: 'none', color: 'var(--slate-500)' }}>...</button>
                    </div>
                    <div style={{ 
                        display: 'grid', gridTemplateColumns: 'repeat(20, 1fr)', gap: 2, 
                        marginTop: 12, background: 'var(--sidebar-hover)', padding: 8, borderRadius: 12 
                    }}>
                        {heatmapData?.map(d => (
                            <div 
                                key={d.id} 
                                style={{ 
                                    aspectRatio: '1', borderRadius: 1,
                                    background: d.value > 5 ? 'var(--primary-500)' : d.value > 2 ? 'var(--primary-700)' : 'var(--divider)' 
                                }} 
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* ─── Row 4: Stock Alerts ─── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20, marginBottom: 24 }}>
                <div style={cardStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                        <h3 style={sectionTitle}>Stock Alerts</h3>
                        <Link href="/stores/stock" style={{ background: 'transparent', border: 'none', color: 'var(--primary-500)', fontSize: 11, fontWeight: 600, textDecoration: 'none' }}>See more details →</Link>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--divider)', textAlign: 'left' }}>
                                <th style={{ padding: '0 0 12px 16px', fontSize: 11, color: 'var(--slate-500)', fontWeight: 500 }}>Description</th>
                                <th style={{ padding: '0 0 12px 0', fontSize: 11, color: 'var(--slate-500)', fontWeight: 500 }}>SKU</th>
                                <th style={{ padding: '0 0 12px 0', fontSize: 11, color: 'var(--slate-500)', fontWeight: 500 }}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {lowStockItems.slice(0, 3).map((item, i) => (
                                <tr key={i} style={{ borderBottom: i === 2 ? 'none' : '1px solid var(--divider)' }}>
                                    <td style={{ padding: '16px', fontSize: 11, fontWeight: 600, color: 'var(--slate-900)' }}>{item.product}</td>
                                    <td style={{ padding: '16px 0', fontSize: 11, color: 'var(--slate-500)', fontFamily: 'var(--font-mono)' }}>{item.sku}</td>
                                    <td style={{ padding: '16px 0', fontSize: 11, fontWeight: 700, color: 'var(--danger)' }}>
                                        {item.current} / {item.reorder}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ─── Final Row: Logistics, Renewals & Risk ─── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.2fr', gap: 20, paddingBottom: 40 }}>
                <div style={cardStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <div>
                            <h3 style={sectionTitle}>Logistics Status</h3>
                            <p style={sectionSub}>{vanStatus.length} vehicles active</p>
                        </div>
                        <Truck size={20} color="var(--primary-400)" />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                        {vanStatus.slice(0, 4).map((van, i) => (
                            <div key={i} style={{
                                padding: '16px', borderRadius: 14, background: 'var(--slate-50)',
                                border: '1px solid var(--slate-200)', display: 'flex', flexDirection: 'column', gap: 12
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--slate-900)' }}>{van.van}</span>
                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: van.status === 'On Route' ? '#10b981' : '#f59e0b', boxShadow: `0 0 10px ${van.status === 'On Route' ? '#10b981' : '#f59e0b'}` }} />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                                    <span style={{ color: 'var(--slate-500)' }}>Sales</span>
                                    <span style={{ fontWeight: 700, color: 'var(--success)' }}>GH₵ {van.sold}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div style={cardStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <div>
                            <h3 style={sectionTitle}>Regulatory Renewals</h3>
                            <p style={sectionSub}>{regulatorRenewalsDue.length} upcoming deadlines</p>
                        </div>
                        <ShieldCheck size={20} color="var(--primary-400)" />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {regulatorRenewalsDue.length > 0 ? regulatorRenewalsDue.slice(0, 3).map((item, i) => (
                            <div key={i} style={{ padding: '12px 16px', borderRadius: 12, background: 'var(--sidebar-hover)', border: '1px solid var(--sidebar-border)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: 11, fontWeight: 600 }}>{item.name}</span>
                                    <span style={{ fontSize: 10, color: item.days <= 30 ? 'var(--danger)' : 'var(--slate-500)' }}>{item.days}d left</span>
                                </div>
                                <p style={{ fontSize: 10, color: 'var(--slate-500)', marginTop: 4 }}>{item.type}</p>
                            </div>
                        )) : (
                            <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 11, color: 'var(--slate-500)' }}>No pending renewals</div>
                        )}
                    </div>
                </div>

                <div style={cardStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <div>
                            <h3 style={sectionTitle}>Financial Expiry Risk</h3>
                            <p style={sectionSub}>Value of stock expiring soon</p>
                        </div>
                        <AlertTriangle size={20} color="var(--warning)" />
                    </div>
                    <div style={{ textAlign: 'center', marginBottom: 20 }}>
                        <p style={{ fontSize: 32, fontWeight: 800, color: 'var(--danger)' }}>GH₵ {valueAtRisk.toLocaleString()}</p>
                        <p style={{ fontSize: 11, color: 'var(--slate-500)' }}>Estimated total value at risk</p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {expiryAlerts.slice(0, 4).map((item, i) => (
                            <div key={i} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '12px 16px', borderRadius: 12, background: 'var(--sidebar-hover)',
                                border: '1px solid var(--sidebar-border)',
                            }}>
                                <div>
                                    <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--slate-900)' }}>{item.product}</p>
                                    <p style={{ fontSize: 10, color: 'var(--slate-500)', marginTop: 2 }}>{item.expiry}</p>
                                </div>
                                <div style={{
                                    padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                                    background: item.days <= 30 ? 'var(--danger-light)' : 'var(--warning-light)',
                                    color: item.days <= 30 ? 'var(--danger)' : 'var(--warning)',
                                }}>
                                    {item.days}d left
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
