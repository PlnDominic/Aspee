'use client';

import React from 'react';
import Link from 'next/link';
import { useFetch, useCount } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';
import SendToMDModal from '@/components/SendToMDModal';
import {
    FileCheck,
    ShieldCheck,
    Clock,
    AlertCircle,
    ArrowRight,
    Activity,
    ClipboardList,
    Truck,
    Send
} from 'lucide-react';

export default function QADashboardPage() {
    const [isReportModalOpen, setIsReportModalOpen] = React.useState(false);
    const { data: recentIpc, isLoading: ipcLoading } = useFetch<any[]>(
        ['qa_in_process', 'recent'],
        async () => {
            const result = await supabase
                .from('qa_in_process')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(5);
            return { data: result.data, error: result.error };
        }
    );

    const { data: recentFinished, isLoading: fpLoading } = useFetch<any[]>(
        ['qa_finished_products', 'recent'],
        async () => {
            const result = await supabase
                .from('qa_finished_products')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(5);
            return { data: result.data, error: result.error };
        }
    );

    const { data: pendingIpcCount } = useCount('qa_in_process', { status: 'Needs Review' });
    const { data: pendingFpCount } = useCount('qa_finished_products', { overall_status: 'Quarantine' });
    const { data: pendingMrCount } = useCount('material_requests', { qa_status: 'Pending QA' });
    const { data: pendingGrnCount } = useCount('grn', { qa_status: 'Pending' });
    const { data: pendingInternalReports } = useCount('qa_internal_reports', { status: 'Pending' });

    const ipcRecords = recentIpc ?? [];
    const fpRecords = recentFinished ?? [];
    const isLoading = ipcLoading || fpLoading;

    const stats = {
        pendingIpc: pendingIpcCount ?? 0,
        pendingFinished: pendingFpCount ?? 0,
        pendingMRs: pendingMrCount ?? 0,
        pendingGRNs: pendingGrnCount ?? 0,
        pendingReports: pendingInternalReports ?? 0,
        failedChecks: (ipcRecords.filter((d: any) => d.status === 'Failed').length) + (fpRecords.filter((d: any) => d.overall_status === 'Failed').length),
        totalChecksMonth: ipcRecords.length + fpRecords.length
    };

    const statusVariant = (status: string): 'success' | 'warning' | 'danger' | 'default' => {
        switch (status) {
            case 'Passed': return 'success';
            case 'Failed': return 'danger';
            case 'Needs Review':
            case 'Quarantine': return 'warning';
            default: return 'default';
        }
    };

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="Quality Assurance Dashboard"
                subtitle="Overview of all quality control activities and product analyses"
                breadcrumbs={[
                    { label: 'Quality Assurance', href: '/qa' },
                    { label: 'Overview' },
                ]}
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
                <StatCard title="Pending IPC" value={stats.pendingIpc.toString()} icon={<ClipboardList size={20} />} color="blue" />
                <StatCard title="Quarantine" value={stats.pendingFinished.toString()} icon={<ShieldCheck size={20} />} color="amber" />
                <StatCard title="Pending MRs" value={stats.pendingMRs.toString()} icon={<Activity size={20} />} color="purple" />
                <StatCard title="Pending GRNs" value={stats.pendingGRNs.toString()} icon={<Truck size={20} />} color="blue" />
                <StatCard title="Internal Reports" value={stats.pendingReports.toString()} icon={<Activity size={20} />} color="amber" />
                <StatCard title="Recent Fails" value={stats.failedChecks.toString()} icon={<AlertCircle size={20} />} color="red" />
                <StatCard title="Recent Checks" value={stats.totalChecksMonth.toString()} icon={<FileCheck size={20} />} color="green" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {/* Recent In-Process Controls */}
                <div
                    style={{
                        background: 'var(--card-bg)',
                        borderRadius: 12,
                        border: '1px solid var(--slate-200)',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                    }}
                >
                    <div
                        style={{
                            padding: '16px 20px',
                            borderBottom: '1px solid var(--slate-100)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                        }}
                    >
                        <span style={{ fontWeight: 600, fontSize: 11, color: 'var(--slate-800)', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <ClipboardList size={16} color="var(--primary-500)" />
                            Recent In-Process Controls
                        </span>
                        <Link
                            href="/qa/in-process"
                            style={{
                                fontSize: 11,
                                fontWeight: 500,
                                color: 'var(--primary-600)',
                                textDecoration: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                            }}
                        >
                            View All <ArrowRight size={14} />
                        </Link>
                    </div>
                    <div style={{ padding: '12px 16px', flex: 1 }}>
                        {isLoading ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {[1, 2, 3].map(i => (
                                    <div key={i} style={{ height: 48, background: 'var(--slate-50)', borderRadius: 8 }} />
                                ))}
                            </div>
                        ) : ipcRecords.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {ipcRecords.map(record => (
                                    <div
                                        key={record.id}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '10px 12px',
                                            borderRadius: 8,
                                            border: '1px solid var(--slate-100)',
                                            transition: 'background 0.15s',
                                            cursor: 'default',
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--slate-50)'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                    >
                                        <div>
                                            <p style={{ fontWeight: 600, fontSize: 11, color: 'var(--slate-900)' }}>{record.batch_number}</p>
                                            <p style={{ fontSize: 11, color: 'var(--slate-500)' }}>{record.product_name} - {record.stage}</p>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                                            <StatusBadge status={record.status} variant={statusVariant(record.status)} />
                                            <span style={{ fontSize: 10, color: 'var(--slate-400)' }}>
                                                {new Date(record.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--slate-400)', fontSize: 11 }}>
                                No recent in-process controls found.
                            </div>
                        )}
                    </div>
                </div>

                {/* Recent Finished Products */}
                <div
                    style={{
                        background: 'var(--card-bg)',
                        borderRadius: 12,
                        border: '1px solid var(--slate-200)',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                    }}
                >
                    <div
                        style={{
                            padding: '16px 20px',
                            borderBottom: '1px solid var(--slate-100)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                        }}
                    >
                        <span style={{ fontWeight: 600, fontSize: 11, color: 'var(--slate-800)', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <ShieldCheck size={16} color="var(--primary-500)" />
                            Recent Finished Products Analysis
                        </span>
                        <Link
                            href="/qa/finished-products"
                            style={{
                                fontSize: 11,
                                fontWeight: 500,
                                color: 'var(--primary-600)',
                                textDecoration: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                            }}
                        >
                            View All <ArrowRight size={14} />
                        </Link>
                    </div>
                    <div style={{ padding: '12px 16px', flex: 1 }}>
                        {isLoading ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {[1, 2, 3].map(i => (
                                    <div key={i} style={{ height: 48, background: 'var(--slate-50)', borderRadius: 8 }} />
                                ))}
                            </div>
                        ) : fpRecords.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {fpRecords.map(record => (
                                    <div
                                        key={record.id}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '10px 12px',
                                            borderRadius: 8,
                                            border: '1px solid var(--slate-100)',
                                            transition: 'background 0.15s',
                                            cursor: 'default',
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--slate-50)'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                    >
                                        <div>
                                            <p style={{ fontWeight: 600, fontSize: 11, color: 'var(--slate-900)' }}>{record.product_name}</p>
                                            <p style={{ fontSize: 11, color: 'var(--slate-500)' }}>Batch: {record.batch_number}</p>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                                            <StatusBadge status={record.overall_status} variant={statusVariant(record.overall_status)} />
                                            <span style={{ fontSize: 10, color: 'var(--slate-400)' }}>
                                                {new Date(record.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--slate-400)', fontSize: 11 }}>
                                No recent finished product analyses found.
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <SendToMDModal 
                isOpen={isReportModalOpen} 
                onClose={() => setIsReportModalOpen(false)} 
                department="Quality Assurance" 
            />
        </div>
    );
}
