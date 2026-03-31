'use client';

import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import {
    ClipboardList,
    CheckCircle,
    XCircle,
    Clock,
    User,
    Calendar,
    AlertCircle,
    FileText,
    History,
    Package,
    ArrowRight
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import StatusBadge from './StatusBadge';

interface PurchaseRequestViewModalProps {
    isOpen: boolean;
    onClose: () => void;
    request: any;
    onApprove?: (id: string) => void;
    onReject?: (id: string) => void;
    isPurchasingView?: boolean;
}

const LiveHistoryCheck = ({ productId }: { productId: string }) => {
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [show, setShow] = useState(false);

    const fetchLiveHistory = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('grn_items')
                .select(`
                    unit_price,
                    grn:grns(received_at, grn_number)
                `)
                .eq('product_id', productId)
                .order('created_at', { ascending: false })
                .limit(3);

            if (error) throw error;
            setHistory(data || []);
            setShow(true);
        } catch (error: any) {
            toast.error('Failed to fetch live history');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ marginTop: 8 }}>
            {!show ? (
                <button 
                    onClick={fetchLiveHistory}
                    disabled={loading}
                    style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, border: '1px solid var(--primary-200)', background: 'var(--primary-50)', color: 'var(--primary-700)', cursor: 'pointer' }}
                >
                    {loading ? 'Checking...' : 'Check Live History'}
                </button>
            ) : (
                <div style={{ background: '#f8fafc', padding: 6, borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 10 }}>
                    <div style={{ fontWeight: 700, marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Live GRN History</span>
                        <button onClick={() => setShow(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--slate-400)', fontSize: 14 }}>×</button>
                    </div>
                    {history.length > 0 ? history.map((h: any, i: number) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: i < history.length - 1 ? '1px solid #f1f5f9' : 'none', padding: '2px 0' }}>
                            <span>{h.grn?.received_at ? new Date(h.grn.received_at).toLocaleDateString() : 'N/A'}</span>
                            <span style={{ fontWeight: 600, color: 'var(--primary-600)' }}>{h.unit_price?.toLocaleString()}</span>
                        </div>
                    )) : <div style={{ color: 'var(--slate-400)' }}>No GRN history found</div>}
                </div>
            )}
        </div>
    );
};

export default function PurchaseRequestViewModal({ 
    isOpen, 
    onClose, 
    request, 
    onApprove, 
    onReject,
    isPurchasingView = false
}: PurchaseRequestViewModalProps) {
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        if (isOpen && request?.id) {
            fetchItems();
        }
    }, [isOpen, request]);

    const fetchItems = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('purchase_request_items')
                .select(`
                    *,
                    product:products(name, sku, unit)
                `)
                .eq('request_id', request.id);

            if (error) throw error;
            setItems(data || []);
        } catch (error: any) {
            toast.error('Failed to fetch items: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async () => {
        if (!confirm('Are you sure you want to approve this purchase request?')) return;
        
        setActionLoading(true);
        try {
            const { error } = await supabase
                .from('purchase_requests')
                .update({ status: 'Approved', updated_at: new Date().toISOString() })
                .eq('id', request.id);

            if (error) throw error;
            
            toast.success('Purchase request approved');
            onApprove?.(request.id);
            onClose();
        } catch (error: any) {
            toast.error('Approval failed: ' + error.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleReject = async () => {
        const reason = prompt('Please enter a reason for rejection (optional):');
        if (reason === null) return; // Cancelled prompt
        
        setActionLoading(true);
        try {
            const { error } = await supabase
                .from('purchase_requests')
                .update({ 
                    status: 'Rejected', 
                    notes: request.notes ? `${request.notes}\n\nRejection Note: ${reason}` : `Rejection Note: ${reason}`,
                    updated_at: new Date().toISOString() 
                })
                .eq('id', request.id);

            if (error) throw error;
            
            toast.success('Purchase request rejected');
            onReject?.(request.id);
            onClose();
        } catch (error: any) {
            toast.error('Rejection failed: ' + error.message);
        } finally {
            setActionLoading(false);
        }
    };

    if (!request) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Request: ${request.request_number}`}
            subtitle="Detailed view of the purchase requisition"
            width={850}
        >
            <div className="view-container">
                <div className="info-header">
                    <div className="info-grid">
                        <div className="info-item">
                            <label><Clock size={12} /> Status</label>
                            <StatusBadge status={request.status} variant={
                                request.status === 'Approved' ? 'success' : 
                                request.status === 'Pending' ? 'warning' : 
                                request.status === 'Rejected' ? 'danger' : 'default'
                            } />
                        </div>
                        <div className="info-item">
                            <label><AlertCircle size={12} /> Priority</label>
                            <StatusBadge status={request.priority} variant={
                                request.priority === 'Urgent' ? 'danger' : 
                                request.priority === 'High' ? 'warning' : 'default'
                            } />
                        </div>
                        <div className="info-item">
                            <label><User size={12} /> Requested By</label>
                            <span className="value">{request.requester?.name || 'Unknown'}</span>
                        </div>
                        <div className="info-item">
                            <label><Calendar size={12} /> Date Submitted</label>
                            <span className="value">{new Date(request.created_at).toLocaleDateString(undefined, { dateStyle: 'long' })}</span>
                        </div>
                    </div>
                </div>

                <div className="section">
                    <h3 className="section-title"><Package size={14} /> Requested Items</h3>
                    <div className="table-wrapper">
                        {loading ? (
                            <div className="loading-state">Loading items...</div>
                        ) : (
                            <table className="items-table">
                                <thead>
                                    <tr>
                                        <th>Material/Component</th>
                                        <th style={{ textAlign: 'right' }}>Qty</th>
                                        <th>Unit</th>
                                        <th>Purchase History</th>
                                        <th>Purpose</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item, idx) => (
                                        <tr key={idx}>
                                            <td>
                                                <div className="name">{item.product?.name}</div>
                                                <div className="sku">{item.product?.sku}</div>
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: 700 }}>{item.quantity.toLocaleString()}</td>
                                            <td>{item.unit || item.product?.unit}</td>
                                            <td>
                                                <div className="history">
                                                    <div>Req. History Price: <b>{item.last_purchase_price ? item.last_purchase_price.toLocaleString() : 'N/A'}</b></div>
                                                    <div style={{ fontSize: 10, color: 'var(--slate-400)' }}>
                                                        {item.last_purchase_date ? `As of: ${new Date(item.last_purchase_date).toLocaleDateString()}` : 'No history at request'}
                                                    </div>
                                                    {isPurchasingView && (
                                                        <LiveHistoryCheck productId={item.product_id} />
                                                    )}
                                                </div>
                                            </td>
                                            <td><span className="purpose">{item.purpose || '-'}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {request.notes && (
                    <div className="section">
                        <h3 className="section-title"><FileText size={14} /> Notes</h3>
                        <div className="notes-box">
                            {request.notes}
                        </div>
                    </div>
                )}

                <div className="view-actions">
                    <button onClick={onClose} className="btn-close">Close</button>
                    {isPurchasingView && request.status === 'Pending' && (
                        <div style={{ display: 'flex', gap: 12 }}>
                            <button 
                                onClick={handleReject} 
                                disabled={actionLoading} 
                                className="btn-reject"
                            >
                                <XCircle size={16} />
                                Reject
                            </button>
                            <button 
                                onClick={handleApprove} 
                                disabled={actionLoading} 
                                className="btn-approve"
                            >
                                <CheckCircle size={16} />
                                Approve Request
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                .view-container { display: flex; flex-direction: column; gap: 24px; }
                .info-header { background: var(--slate-50); padding: 20px; border-radius: 12px; border: 1px solid var(--slate-100); }
                .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 20px; }
                .info-item label { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; color: var(--slate-500); text-transform: uppercase; margin-bottom: 8px; }
                .info-item .value { font-size: 14px; font-weight: 600; color: var(--slate-800); }
                .section-title { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700; color: var(--slate-800); margin-bottom: 12px; }
                .table-wrapper { border: 1px solid var(--slate-200); border-radius: 10px; overflow: hidden; }
                .items-table { width: 100%; border-collapse: collapse; }
                .items-table th { background: #f8fafc; padding: 12px; text-align: left; font-size: 11px; font-weight: 700; color: var(--slate-500); }
                .items-table td { padding: 12px; border-top: 1px solid #f1f5f9; font-size: 13px; }
                .items-table .name { font-weight: 600; color: var(--slate-900); }
                .items-table .sku { font-size: 11px; color: var(--slate-400); }
                .items-table .history { font-size: 12px; line-height: 1.4; }
                .items-table .purpose { font-style: italic; color: var(--slate-600); }
                .loading-state { padding: 40px; text-align: center; color: var(--slate-400); }
                .notes-box { padding: 15px; background: white; border: 1.5px solid var(--slate-100); border-radius: 10px; font-size: 13px; color: var(--slate-700); white-space: pre-wrap; line-height: 1.6; }
                .view-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 10px; border-top: 1px solid var(--slate-100); pt: 20px; }
                .btn-close { padding: 10px 24px; border-radius: 10px; border: 1.5px solid var(--slate-200); background: white; color: var(--slate-600); font-weight: 600; cursor: pointer; }
                .btn-approve { display: flex; align-items: center; gap: 8px; padding: 10px 24px; border-radius: 10px; background: var(--success-600); color: white; border: none; font-weight: 600; cursor: pointer; }
                .btn-reject { display: flex; align-items: center; gap: 8px; padding: 10px 20px; border-radius: 10px; background: white; color: var(--danger); border: 1.5px solid var(--danger); font-weight: 600; cursor: pointer; }
                .btn-approve:disabled, .btn-reject:disabled { opacity: 0.6; cursor: not-allowed; }
            `}</style>
        </Modal>
    );
}
