'use client';

import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { History, Calendar, AlertCircle, FileText, Package } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import StatusBadge from './StatusBadge';

interface DefectHistoryItem {
    id: string;
    created_at: string;
    batch_number: string;
    defect_type: string;
    quantity: number;
    remarks: string;
    report: {
        report_number: string;
        status: string;
        requester: { name: string } | null;
    };
}

interface MaterialDefectHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    productId: string | null;
    productName: string | null;
}

export default function MaterialDefectHistoryModal({ isOpen, onClose, productId, productName }: MaterialDefectHistoryModalProps) {
    const [history, setHistory] = useState<DefectHistoryItem[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && productId) {
            fetchDefectHistory();
        }
    }, [isOpen, productId]);

    const fetchDefectHistory = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('qa_internal_report_items')
                .select(`
                    id,
                    created_at,
                    batch_number,
                    defect_type,
                    quantity,
                    remarks,
                    report:qa_internal_reports(
                        report_number,
                        status,
                        requester:system_users!requested_by(name)
                    )
                `)
                .eq('product_id', productId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setHistory((data as any[]) || []);
        } catch (error: any) {
            console.error('Defect history fetch error:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Defect History: ${productName}`}
            subtitle="Previous reports, leakages, breakages, and expirations"
            width={850}
        >
            <div className="history-container">
                {loading ? (
                    <div className="loading-state">Fetching history...</div>
                ) : history.length > 0 ? (
                    <div className="history-table-wrapper">
                        <table className="history-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Report #</th>
                                    <th>Batch #</th>
                                    <th>Defect Type</th>
                                    <th>Qty</th>
                                    <th>Issue/Remarks</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map((item) => (
                                    <tr key={item.id}>
                                        <td className="date">
                                            <Calendar size={12} className="icon" />
                                            {new Date(item.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="report-num">{item.report?.report_number}</td>
                                        <td className="batch">{item.batch_number || '-'}</td>
                                        <td>
                                            <StatusBadge 
                                                status={item.defect_type || 'Standard'} 
                                                variant={
                                                    item.defect_type === 'Expired Material' || item.defect_type === 'Spillage' ? 'danger' :
                                                    item.defect_type === 'Leakage' || item.defect_type === 'Breakage' ? 'warning' : 'default'
                                                } 
                                            />
                                        </td>
                                        <td>{item.quantity.toLocaleString()}</td>
                                        <td className="remarks">{item.remarks}</td>
                                        <td>
                                            <StatusBadge status={item.report?.status} variant={item.report?.status === 'Action Taken' ? 'success' : 'warning'} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="empty-state">
                        <History size={48} className="icon" />
                        <p>No previous defects or reports found for this material.</p>
                    </div>
                )}
            </div>

            <style>{`
                .history-container { min-height: 300px; padding-top: 10px; }
                .loading-state { display: flex; align-items: center; justify-content: center; height: 200px; color: var(--slate-500); font-style: italic; }
                .history-table-wrapper { border: 1px solid var(--slate-200); border-radius: 12px; overflow: hidden; background: white; }
                .history-table { width: 100%; border-collapse: collapse; }
                .history-table th { background: #f8fafc; padding: 12px; text-align: left; font-size: 11px; font-weight: 700; color: var(--slate-500); text-transform: uppercase; }
                .history-table td { padding: 12px; border-top: 1px solid #f1f5f9; font-size: 13px; color: var(--slate-700); }
                .history-table .date { display: flex; align-items: center; gap: 8px; font-weight: 500; }
                .history-table .date .icon { color: var(--slate-400); }
                .history-table .report-num { fontWeight: 600; color: var(--primary-600); }
                .history-table .batch { font-family: var(--font-mono); font-size: 12px; }
                .history-table .remarks { font-size: 12px; color: var(--slate-600); max-width: 200px; }
                .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 300px; color: var(--slate-400); gap: 16px; }
                .empty-state .icon { stroke-width: 1.5; opacity: 0.5; }
                .empty-state p { font-style: italic; font-size: 14px; }
            `}</style>
        </Modal>
    );
}
