'use client';

import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import {
    FileText,
    User,
    Calendar,
    AlertCircle,
    CheckCircle,
    XCircle,
    Clock,
    ClipboardList,
    History,
    Activity
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import StatusBadge from './StatusBadge';
import MaterialDefectHistoryModal from './MaterialDefectHistoryModal';

interface QAReportViewModalProps {
    isOpen: boolean;
    onClose: () => void;
    report: any;
    onSuccess?: () => void;
    showActions?: boolean;
}

export default function QAReportViewModal({ isOpen, onClose, report, onSuccess, showActions = true }: QAReportViewModalProps) {
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState<any[]>([]);
    const [fetchingItems, setFetchingItems] = useState(false);
    
    const [historyModalOpen, setHistoryModalOpen] = useState(false);
    const [historyProductId, setHistoryProductId] = useState<string | null>(null);
    const [historyProductName, setHistoryProductName] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && report) {
            fetchItems();
        }
    }, [isOpen, report]);

    const fetchItems = async () => {
        setFetchingItems(true);
        try {
            const { data, error } = await supabase
                .from('qa_internal_report_items')
                .select('*, product:products(name, sku, unit)')
                .eq('report_id', report.id);

            if (error) throw error;
            setItems(data || []);
        } catch (error: any) {
            toast.error('Failed to fetch items: ' + error.message);
        } finally {
            setFetchingItems(false);
        }
    };

    const updateStatus = async (newStatus: string) => {
        setLoading(true);
        try {
            const { error } = await supabase
                .from('qa_internal_reports')
                .update({ 
                    status: newStatus,
                    updated_at: new Date().toISOString()
                })
                .eq('id', report.id);

            if (error) throw error;
            toast.success(`Status updated to ${newStatus}`);
            onSuccess?.();
            onClose();
        } catch (error: any) {
            toast.error('Failed to update status: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    if (!report) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Review ${report.type}`}
            subtitle={`Process report from ${report.requester?.name || 'Unknown'}`}
            width={800}
        >
            <div className="view-container">
                <div className="header-info">
                    <div className="info-group">
                        <div className="info-item">
                            <label><FileText size={12} /> Report Number</label>
                            <span className="value">{report.report_number}</span>
                        </div>
                        <div className="info-item">
                            <label><AlertCircle size={12} /> Priority</label>
                            <StatusBadge status={report.priority} variant={report.priority === 'Urgent' ? 'danger' : 'default'} />
                        </div>
                        <div className="info-item">
                            <label><User size={12} /> From Department</label>
                            <span className="value">Stores</span>
                        </div>
                    </div>
                    <div className="info-group">
                        <div className="info-item">
                            <label><Calendar size={12} /> Submitted On</label>
                            <span className="value">{new Date(report.created_at).toLocaleString()}</span>
                        </div>
                        <div className="info-item">
                            <label><Clock size={12} /> Current Status</label>
                            <StatusBadge status={report.status} variant={report.status === 'Action Taken' ? 'success' : 'warning'} />
                        </div>
                        <div className="info-item">
                            <label><ClipboardList size={12} /> Category</label>
                            <span className="value">{report.category}</span>
                        </div>
                    </div>
                </div>

                <div className="items-section">
                    <h4 className="section-title">Reported Materials & Details</h4>
                    <div className="items-table-wrapper">
                        {fetchingItems ? (
                            <div className="loading-state">Loading items...</div>
                        ) : items.length > 0 ? (
                            <table className="view-table">
                                <thead>
                                    <tr>
                                        <th>Material</th>
                                        <th>Batch #</th>
                                        <th>Defect Type</th>
                                        <th>Qty</th>
                                        <th>Expiry</th>
                                        <th>Remarks</th>
                                    </tr>
                                </thead>
                                <tbody>
                                        {items.map((item, idx) => (
                                            <tr key={idx}>
                                                <td>
                                                    <div className="material-cell">
                                                        <div>
                                                            <div className="name">{item.product?.name}</div>
                                                            <div className="sku">{item.product?.sku}</div>
                                                        </div>
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setHistoryProductId(item.product_id);
                                                                setHistoryProductName(item.product?.name);
                                                                setHistoryModalOpen(true);
                                                            }}
                                                            className="history-btn"
                                                        >
                                                            <Activity size={12} /> History
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="mono">{item.batch_number || '-'}</td>
                                                <td>
                                                    <StatusBadge 
                                                        status={item.defect_type || 'Standard'} 
                                                        variant={
                                                            item.defect_type === 'Expired Material' || item.defect_type === 'Spillage' ? 'danger' :
                                                            item.defect_type === 'Leakage' || item.defect_type === 'Breakage' ? 'warning' : 'default'
                                                        }
                                                    />
                                                </td>
                                                <td>{item.quantity} {item.product?.unit}</td>
                                                <td>{item.expiry_date ? new Date(item.expiry_date).toLocaleDateString() : '-'}</td>
                                                <td className="remarks">{item.remarks}</td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="no-items">No items found in this report.</div>
                        )}
                    </div>
                </div>

                {report.notes && (
                    <div className="notes-section">
                        <label>Requester Notes & History</label>
                        <div className="notes-box">{report.notes}</div>
                    </div>
                )}

                <div className="actions">
                    <button onClick={onClose} className="btn-secondary">Close</button>
                    {showActions && report.status === 'Pending' && (
                        <button 
                            onClick={() => updateStatus('In-Review')} 
                            disabled={loading}
                            className="btn-primary warning"
                        >
                            Mark as In-Review
                        </button>
                    )}
                    {showActions && (report.status === 'Pending' || report.status === 'In-Review') && (
                        <button 
                            onClick={() => updateStatus('Action Taken')} 
                            disabled={loading}
                            className="btn-primary success"
                        >
                            Mark Action Taken
                        </button>
                    )}
                </div>
            </div>

            <MaterialDefectHistoryModal 
                isOpen={historyModalOpen}
                onClose={() => setHistoryModalOpen(false)}
                productId={historyProductId}
                productName={historyProductName}
            />

            <style>{`
                .view-container { padding: 5px 0; }
                .header-info { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; background: var(--slate-50); padding: 20px; border-radius: 12px; margin-bottom: 24px; }
                .info-group { display: flex; flexDirection: column; gap: 15px; }
                .info-item { display: flex; flexDirection: column; gap: 4px; }
                .info-item label { font-size: 10px; font-weight: 700; color: var(--slate-500); text-transform: uppercase; display: flex; alignItems: center; gap: 6px; }
                .info-item .value { font-size: 14px; font-weight: 600; color: var(--slate-900); }
                .section-title { font-size: 13px; font-weight: 700; color: var(--slate-800); margin-bottom: 15px; display: flex; alignItems: center; gap: 8px; }
                .items-table-wrapper { border: 1px solid var(--slate-200); border-radius: 10px; overflow: visible; }
                .view-table { width: 100%; border-collapse: collapse; overflow: visible; }
                .view-table th { background: #f8fafc; padding: 12px; text-align: left; font-size: 11px; font-weight: 700; color: var(--slate-500); }
                .view-table td { padding: 12px; border-top: 1px solid #f1f5f9; font-size: 13px; }
                .material-cell { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
                .history-btn { display: flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 6px; border: 1px solid var(--slate-200); background: white; color: var(--primary-600); font-size: 10px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
                .history-btn:hover { background: var(--primary-50); border-color: var(--primary-200); }
                .view-table .name { font-weight: 600; }
                .view-table .sku { font-size: 11px; color: var(--slate-500); }
                .view-table .mono { font-family: var(--font-mono); color: var(--primary-600); }
                .view-table .remarks { font-size: 12px; color: var(--slate-600); }
                .notes-section { margin-top: 24px; }
                .notes-section label { font-size: 11px; font-weight: 700; color: var(--slate-500); text-transform: uppercase; margin-bottom: 10px; display: block; }
                .notes-box { padding: 15px; background: white; border: 1.5px dashed var(--slate-200); border-radius: 10px; font-size: 13px; line-height: 1.6; color: var(--slate-700); }
                .actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 30px; paddingTop: 20px; border-top: 1px solid var(--slate-100); }
                .btn-secondary { padding: 10px 20px; border-radius: 8px; border: 1.5px solid var(--slate-200); background: white; color: var(--slate-600); font-weight: 600; cursor: pointer; }
                .btn-primary { padding: 10px 24px; border-radius: 8px; font-weight: 600; color: white; border: none; cursor: pointer; }
                .btn-primary.warning { background: var(--warning-500); }
                .btn-primary.success { background: var(--success-500); }
                .loading-state, .no-items { padding: 40px; text-align: center; color: var(--slate-400); font-style: italic; }
            `}</style>
        </Modal>
    );
}
