'use client';

import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import {
    ClipboardList,
    Truck,
    Package,
    AlertCircle,
    CheckCircle,
    XCircle
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import StatusBadge from './StatusBadge';

interface MaterialRequestViewModalProps {
    isOpen: boolean;
    onClose: () => void;
    request: any;
    onIssue?: (request: any) => Promise<void>;
    onReject?: (request: any) => Promise<void>;
}

export default function MaterialRequestViewModal({ isOpen, onClose, request, onIssue, onReject }: MaterialRequestViewModalProps) {
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState<any[]>([]);
    const [fetching, setFetching] = useState(false);

    useEffect(() => {
        if (isOpen && request?.id) {
            fetchItems();
        }
    }, [isOpen, request]);

    const fetchItems = async () => {
        setFetching(true);
        try {
            const { data, error } = await supabase
                .from('material_request_items')
                .select(`
                    *,
                    product:products(id, name, sku, unit, material_type)
                `)
                .eq('request_id', request.id);

            if (error) throw error;
            
            // Add quantity_available check
            const itemsWithStock = await Promise.all((data || []).map(async (item: any) => {
                const { data: stockBatches } = await supabase
                    .from('stock_levels')
                    .select('qty_on_hand')
                    .eq('product_id', item.product_id);
                
                const totalStock = stockBatches?.reduce((sum, b) => sum + (b.qty_on_hand || 0), 0) || 0;
                return { ...item, total_stock: totalStock };
            }));

            setItems(itemsWithStock);
        } catch (error: any) {
            toast.error('Failed to fetch request items: ' + error.message);
        } finally {
            setFetching(false);
        }
    };

    const handleIssue = async () => {
        setLoading(true);
        try {
            if (onIssue) {
                await onIssue(request);
                onClose();
            }
        } catch (error: any) {
        } finally {
            setLoading(false);
        }
    };

    const handleReject = async () => {
        setLoading(true);
        try {
            if (onReject) {
                await onReject(request);
                onClose();
            }
        } catch (error: any) {
        } finally {
            setLoading(false);
        }
    };

    if (!request) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Material Request: ${request.request_number}`}
            subtitle="Review and issue items to production line"
            width={750}
        >
            <div className="view-container">
                <div className="summary-grid">
                    <div className="summary-card">
                        <label>Production Order</label>
                        <div className="value">{request.production_order?.order_number || 'Internal Request'}</div>
                    </div>
                    <div className="summary-card">
                        <label>Status</label>
                        <div className="value"><StatusBadge status={request.status} /></div>
                    </div>
                    <div className="summary-card">
                        <label>Requested BY</label>
                        <div className="value">Production Manager</div>
                    </div>
                    <div className="summary-card">
                        <label>Date Requested</label>
                        <div className="value">{new Date(request.created_at).toLocaleDateString()}</div>
                    </div>
                </div>

                <div className="table-wrapper">
                    <table className="view-table">
                        <thead>
                            <tr>
                                <th>Item</th>
                                <th>Requested</th>
                                <th>Current Stock</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {fetching ? (
                                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '20px' }}>Loading items...</td></tr>
                            ) : items.length > 0 ? (
                                items.map((item, idx) => (
                                    <tr key={idx}>
                                        <td>
                                            <div style={{ fontWeight: 600 }}>{item.product?.name}</div>
                                            <div style={{ fontSize: 10, color: '#64748b' }}>{item.product?.sku} &middot; {item.product?.material_type}</div>
                                        </td>
                                        <td>{item.quantity_requested.toLocaleString()} <span style={{ fontSize: 10, color: 'var(--slate-500)' }}>{item.unit || item.product?.unit}</span></td>
                                        <td>
                                            <div style={{ fontWeight: 600, color: item.total_stock >= item.quantity_requested ? '#10b981' : '#ef4444' }}>
                                                {item.total_stock.toLocaleString()}
                                            </div>
                                        </td>
                                        <td>
                                            {item.total_stock >= item.quantity_requested ? (
                                                <div className="status-tag success">In Stock</div>
                                            ) : (
                                                <div className="status-tag danger">Out of Stock</div>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '20px' }}>No items in this request.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {request.notes && (
                    <div className="notes-section">
                        <label>Request Notes</label>
                        <div className="notes-box">{request.notes}</div>
                    </div>
                )}

                <div className="modal-actions">
                    <button onClick={onClose} className="btn-secondary">Close</button>
                    {request.status === 'Pending' && (
                        <>
                            <button 
                                onClick={handleReject} 
                                disabled={loading || fetching} 
                                className="btn-danger-outline"
                            >
                                <XCircle size={14} />
                                Reject Request
                            </button>
                            <button 
                                onClick={handleIssue} 
                                disabled={loading || fetching} 
                                className="btn-primary"
                            >
                                <Truck size={14} />
                                {loading ? 'Processing...' : 'Issue Materials'}
                            </button>
                        </>
                    )}
                </div>
            </div>

            <style>{`
                .view-container { display: flex; flex-direction: column; gap: 20px; }
                .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
                .summary-card { padding: 12px; background: var(--slate-50); border-radius: 8px; border: 1px solid var(--slate-100); }
                .summary-card label { display: block; font-size: 10px; font-weight: 600; color: var(--slate-500); margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
                .summary-card .value { font-size: 12px; font-weight: 700; color: var(--slate-800); }
                .table-wrapper { border: 1.5px solid var(--slate-100); border-radius: 12px; overflow: hidden; }
                .view-table { width: 100%; border-collapse: collapse; }
                .view-table th, .view-table td { padding: 12px 16px; text-align: left; border-bottom: 1px solid var(--slate-50); font-size: 11px; }
                .view-table th { background: var(--slate-50); font-weight: 700; color: var(--slate-600); }
                .notes-section { margin-top: 4px; }
                .notes-section label { font-size: 11px; font-weight: 600; color: var(--slate-600); display: block; margin-bottom: 6px; }
                .notes-box { padding: 12px; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; font-size: 11px; color: #92400e; line-height: 1.5; }
                .status-tag { display: inline-flex; padding: 2px 8px; border-radius: 99px; font-size: 9px; font-weight: 700; text-transform: uppercase; }
                .status-tag.success { background: #d1fae5; color: #065f46; }
                .status-tag.danger { background: #fee2e2; color: #991b1b; }
                .modal-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 10px; padding-top: 20px; border-top: 1.5px solid var(--slate-100); }
                .btn-secondary { padding: 10px 20px; border-radius: 10px; border: 1.5px solid var(--slate-200); background: #fff; color: var(--slate-600); font-size: 11px; font-weight: 600; cursor: pointer; }
                .btn-danger-outline { display: flex; align-items: center; gap: 8px; padding: 10px 20px; border-radius: 10px; border: 1.5px solid var(--danger); background: transparent; color: var(--danger); font-size: 11px; font-weight: 600; cursor: pointer; }
                .btn-primary { display: flex; align-items: center; gap: 8px; padding: 10px 24px; border-radius: 10px; border: none; background: linear-gradient(135deg, var(--primary-600), var(--primary-500)); color: white; font-size: 11px; font-weight: 600; cursor: pointer; }
            `}</style>
        </Modal>
    );
}
