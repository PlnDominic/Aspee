'use client';

import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { Save, ShieldCheck, AlertCircle, Calendar, User, ClipboardList, Package } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface QARawMaterialModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    grn: any;
    mode?: 'view' | 'edit';
}

export default function QARawMaterialModal({ isOpen, onClose, onSave, grn, mode = 'edit' }: QARawMaterialModalProps) {
    const [loading, setLoading] = useState(false);
    
    // Item-level inspections state
    const [itemInspections, setItemInspections] = useState<any[]>([]);
    
    // QA fields
    const [qaStatus, setQaStatus] = useState('Pending');
    const [qaInspector, setQaInspector] = useState('');
    const [qaDate, setQaDate] = useState(new Date().toISOString().split('T')[0]);
    const [goodsCondition, setGoodsCondition] = useState('Good');
    const [qaRemarks, setQaRemarks] = useState('');
    
    useEffect(() => {
        if (grn) {
            setQaStatus(grn.qa_status || 'Pending');
            setQaInspector(grn.qa_inspector || '');
            setQaDate(grn.qa_date ? new Date(grn.qa_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
            setGoodsCondition(grn.goods_condition || 'Good');
            setQaRemarks(grn.qa_remarks || '');
            
            // Initialize item inspections from grn.items
            if (grn.items) {
                setItemInspections(grn.items.map((item: any) => ({
                    id: item.id,
                    product_id: item.product_id,
                    product_name: item.product?.name || 'Unknown',
                    received_qty: item.quantity_received,
                    unit: item.unit || 'pcs',
                    qa_status: item.qa_status || 'Pending',
                    item_condition: item.item_condition || 'Good',
                    condition_notes: item.condition_notes || ''
                })));
            }
        }
    }, [grn, isOpen]);

    const updateItemField = (index: number, field: string, value: string) => {
        const newInspections = [...itemInspections];
        newInspections[index] = { ...newInspections[index], [field]: value };
        setItemInspections(newInspections);
    };

    const bulkApprove = () => {
        setItemInspections(prev => prev.map(item => ({ ...item, qa_status: 'Approved', item_condition: 'Good' })));
        setQaStatus('Approved');
        setGoodsCondition('Good');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // 1. Update the main GRN record
            const { error: grnError } = await supabase
                .from('grn')
                .update({
                    qa_status: qaStatus,
                    qa_inspector: qaInspector,
                    qa_date: qaDate,
                    goods_condition: goodsCondition,
                    qa_remarks: qaRemarks,
                })
                .eq('id', grn.id);

            if (grnError) throw grnError;

            // 2. Update individual GRN items
            for (const item of itemInspections) {
                const { error: itemError } = await supabase
                    .from('grn_items')
                    .update({
                        qa_status: item.qa_status,
                        item_condition: item.item_condition,
                        condition_notes: item.condition_notes
                    })
                    .eq('id', item.id);
                
                if (itemError) throw itemError;
            }
            
            toast.success('All inspection records saved successfully');
            onSave();
        } catch (error: any) {
            toast.error(error.message || 'Failed to save inspection');
        } finally {
            setLoading(false);
        }
    };

    if (!grn) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Raw Material Inspection"
            subtitle={`GRN: ${grn.grn_number} | Source: ${grn.purchase_orders?.suppliers?.name || 'Unknown'}`}
            width={750}
        >
            <form onSubmit={handleSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    
                    {/* Header Controls */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>Overall GRN Status *</label>
                        <select
                            value={qaStatus}
                            onChange={(e) => setQaStatus(e.target.value)}
                            required
                            disabled={mode === 'view'}
                            style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11px', outline: 'none', background: 'var(--card-bg)', opacity: mode === 'view' ? 0.7 : 1 }}
                        >
                            <option value="Pending">Pending Inspection</option>
                            <option value="Approved">Approved (Release Batch)</option>
                            <option value="Rejected">Rejected</option>
                            <option value="Quarantine">Hold in Quarantine</option>
                        </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>General Condition *</label>
                        <select
                            value={goodsCondition}
                            onChange={(e) => setGoodsCondition(e.target.value)}
                            required
                            disabled={mode === 'view'}
                            style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11px', outline: 'none', background: 'var(--card-bg)', opacity: mode === 'view' ? 0.7 : 1 }}
                        >
                            <option value="Good">Good</option>
                            <option value="Damaged">Damaged</option>
                            <option value="Partial Damage">Partial</option>
                        </select>
                    </div>

                    {/* Items Inspection Table */}
                    <div style={{ gridColumn: 'span 2', marginTop: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                                <Package size={16} />
                                Individual Item Inspection
                            </div>
                            {mode !== 'view' && (
                            <button 
                                type="button" 
                                onClick={bulkApprove}
                                style={{ fontSize: '10px', color: '#4f46e5', background: '#eef2ff', border: '1px solid #c7d2fe', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                            >
                                Mark All as Approved
                            </button>
                        )}
                        </div>

                        <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                                <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                    <tr>
                                        <th style={{ padding: '10px', textAlign: 'left' }}>Material Name</th>
                                        <th style={{ padding: '10px', textAlign: 'center' }}>Qty</th>
                                        <th style={{ padding: '10px', textAlign: 'left' }}>Status</th>
                                        <th style={{ padding: '10px', textAlign: 'left' }}>Condition</th>
                                        <th style={{ padding: '10px', textAlign: 'left' }}>Notes</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {itemInspections.map((item, idx) => (
                                        <tr key={idx} style={{ borderBottom: idx === itemInspections.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '10px', fontWeight: 500 }}>{item.product_name}</td>
                                            <td style={{ padding: '10px', textAlign: 'center', color: '#64748b' }}>{item.received_qty} {item.unit}</td>
                                            <td style={{ padding: '10px' }}>
                                                <select
                                                    value={item.qa_status}
                                                    onChange={(e) => updateItemField(idx, 'qa_status', e.target.value)}
                                                    disabled={mode === 'view'}
                                                    style={{ width: '100%', padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '10px', outline: 'none', opacity: mode === 'view' ? 0.7 : 1 }}
                                                >
                                                    <option value="Pending">Pending</option>
                                                    <option value="Approved">Passed</option>
                                                    <option value="Rejected">Failed</option>
                                                    <option value="Quarantine">Hold</option>
                                                </select>
                                            </td>
                                            <td style={{ padding: '10px' }}>
                                                <select
                                                    value={item.item_condition}
                                                    onChange={(e) => updateItemField(idx, 'item_condition', e.target.value)}
                                                    disabled={mode === 'view'}
                                                    style={{ width: '100%', padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '10px', outline: 'none', opacity: mode === 'view' ? 0.7 : 1 }}
                                                >
                                                    <option value="Good">Good</option>
                                                    <option value="Damaged">Damaged</option>
                                                    <option value="Partial Damage">Partial</option>
                                                </select>
                                            </td>
                                            <td style={{ padding: '10px' }}>
                                                <input
                                                    type="text"
                                                    value={item.condition_notes}
                                                    onChange={(e) => updateItemField(idx, 'condition_notes', e.target.value)}
                                                    placeholder="e.g. Broken seal"
                                                    disabled={mode === 'view'}
                                                    style={{ width: '100%', padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '10px', outline: 'none', opacity: mode === 'view' ? 0.7 : 1 }}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>QA Inspector *</label>
                        <div style={{ position: 'relative' }}>
                            <User size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            <input
                                type="text"
                                value={qaInspector}
                                onChange={(e) => setQaInspector(e.target.value)}
                                required
                                placeholder="Enter name"
                                disabled={mode === 'view'}
                                style={{ width: '100%', padding: '8px 12px 8px 34px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11px', outline: 'none', opacity: mode === 'view' ? 0.7 : 1 }}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>Inspection Date *</label>
                        <div style={{ position: 'relative' }}>
                            <Calendar size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            <input
                                type="date"
                                value={qaDate}
                                onChange={(e) => setQaDate(e.target.value)}
                                required
                                disabled={mode === 'view'}
                                style={{ width: '100%', padding: '8px 12px 8px 34px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11px', outline: 'none', opacity: mode === 'view' ? 0.7 : 1 }}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', gridColumn: 'span 2' }}>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>Overall QA Remarks</label>
                        <textarea
                            value={qaRemarks}
                            onChange={(e) => setQaRemarks(e.target.value)}
                            rows={3}
                            placeholder="Detail your findings here..."
                            disabled={mode === 'view'}
                            style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11px', outline: 'none', resize: 'vertical', opacity: mode === 'view' ? 0.7 : 1 }}
                        />
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{ padding: '8px 20px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11px', fontWeight: 600, color: '#64748b', background: 'var(--card-bg)', cursor: 'pointer' }}
                    >
                        {mode === 'view' ? 'Close' : 'Cancel'}
                    </button>
                    {mode !== 'view' && (
                        <button
                            type="submit"
                            disabled={loading}
                            style={{ padding: '8px 20px', border: 'none', borderRadius: '8px', fontSize: '11px', fontWeight: 600, color: 'white', background: '#4f46e5', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', opacity: loading ? 0.7 : 1 }}
                        >
                            <Save size={14} />
                            {loading ? 'Saving...' : 'Submit Inspection'}
                        </button>
                    )}
                </div>
            </form>
        </Modal>
    );
}
