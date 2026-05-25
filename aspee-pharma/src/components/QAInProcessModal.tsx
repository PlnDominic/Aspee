'use client';

import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { FileCheck, Save } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface QAInProcessModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    record?: any;
}

export default function QAInProcessModal({ isOpen, onClose, onSave, record }: QAInProcessModalProps) {
    const [loading, setLoading] = useState(false);
    const [fetchingOrders, setFetchingOrders] = useState(false);
    const [productionOrders, setProductionOrders] = useState<any[]>([]);

    const [productionOrderId, setProductionOrderId] = useState('');
    const [batchNumber, setBatchNumber] = useState('');
    const [productName, setProductName] = useState('');
    const [stage, setStage] = useState('');
    const [parametersChecked, setParametersChecked] = useState('');
    const [results, setResults] = useState('');
    const [status, setStatus] = useState('Pending');
    const [inspector, setInspector] = useState('');
    const [inspectionDate, setInspectionDate] = useState(new Date().toISOString().split('T')[0]);
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (isOpen) fetchProductionOrders();
    }, [isOpen]);

    const fetchProductionOrders = async () => {
        setFetchingOrders(true);
        try {
            const { data, error } = await supabase
                .from('production_orders')
                .select(`
                    id, 
                    order_number, 
                    batch_number,
                    product:products(name)
                `)
                .order('created_at', { ascending: false });
            if (error) throw error;
            setProductionOrders(data || []);
        } catch (error: any) {
            toast.error('Failed to fetch job orders: ' + error.message);
        } finally {
            setFetchingOrders(false);
        }
    };

    useEffect(() => {
        if (record) {
            setProductionOrderId(record.production_order_id || '');
            setBatchNumber(record.batch_number || '');
            setProductName(record.product_name || '');
            setStage(record.stage || '');
            setParametersChecked(record.parameters_checked || '');
            setResults(record.results || '');
            setStatus(record.status || 'Pending');
            setInspector(record.inspector || '');
            setInspectionDate(record.inspection_date ? new Date(record.inspection_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
            setNotes(record.notes || record.remarks || '');
        } else {
            setProductionOrderId('');
            setBatchNumber('');
            setProductName('');
            setStage('');
            setParametersChecked('');
            setResults('');
            setStatus('Pending');
            setInspector('');
            setInspectionDate(new Date().toISOString().split('T')[0]);
            setNotes('');
        }
    }, [record, isOpen]);

    const handleOrderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const orderId = e.target.value;
        setProductionOrderId(orderId);
        const match = productionOrders.find(o => o.id === orderId);
        if (match) {
            setBatchNumber(match.batch_number || match.order_number);
            setProductName(match.product?.name || '');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const payload = {
            production_order_id: productionOrderId || null,
            batch_number: batchNumber,
            product_name: productName,
            stage,
            parameters_checked: parametersChecked,
            results,
            status,
            inspector,
            inspection_date: inspectionDate,
            notes,
        };

        try {
            if (record?.id) {
                const { error } = await supabase
                    .from('qa_in_process')
                    .update(payload)
                    .eq('id', record.id);
                if (error) throw error;
                toast.success('IPC record updated successfully');
            } else {
                const { error } = await supabase
                    .from('qa_in_process')
                    .insert([payload]);
                if (error) throw error;
                toast.success('IPC record created successfully');
            }
            onSave();
        } catch (error: any) {
            toast.error(error.message || 'Failed to save record');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={record ? 'In Process Control Record' : 'New IPC Record'}
            subtitle={record ? `Batch: ${record.batch_number}` : 'Record a new in-process quality check'}
            width={600}
        >
            <form onSubmit={handleSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    {/* Job Order Selection */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', gridColumn: 'span 2' }}>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>Link to Job Order (Optional)</label>
                        <select
                            value={productionOrderId}
                            onChange={handleOrderChange}
                            disabled={!!record}
                            style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11px', outline: 'none', background: 'var(--card-bg)' }}
                        >
                            <option value="">Select a Job Order to auto-fill...</option>
                            {productionOrders.map(o => (
                                <option key={o.id} value={o.id}>{o.order_number} - {o.product?.name} (Batch: {o.batch_number})</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>Batch Number *</label>
                        <input
                            type="text"
                            value={batchNumber}
                            onChange={(e) => setBatchNumber(e.target.value)}
                            required
                            style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11px', outline: 'none' }}
                        />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>Product Name *</label>
                        <input
                            type="text"
                            value={productName}
                            onChange={(e) => setProductName(e.target.value)}
                            required
                            style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11px', outline: 'none' }}
                        />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>Production Stage *</label>
                        <input
                            type="text"
                            value={stage}
                            onChange={(e) => setStage(e.target.value)}
                            required
                            placeholder="e.g. Mixing, Granulation, Coating"
                            style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11px', outline: 'none' }}
                        />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>Status</label>
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11px', outline: 'none', background: 'var(--card-bg)' }}
                        >
                            <option value="Pending">Pending</option>
                            <option value="Passed">Passed</option>
                            <option value="Failed">Failed</option>
                            <option value="Needs Review">Needs Review</option>
                        </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', gridColumn: 'span 2' }}>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>Parameters Checked *</label>
                        <textarea
                            value={parametersChecked}
                            onChange={(e) => setParametersChecked(e.target.value)}
                            required
                            rows={2}
                            placeholder="e.g. pH, Viscosity, Appearance"
                            style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11px', outline: 'none', resize: 'vertical' }}
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', gridColumn: 'span 2' }}>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>Results *</label>
                        <textarea
                            value={results}
                            onChange={(e) => setResults(e.target.value)}
                            required
                            rows={2}
                            placeholder="Detailed test results..."
                            style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11px', outline: 'none', resize: 'vertical' }}
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>Inspector *</label>
                        <input
                            type="text"
                            value={inspector}
                            onChange={(e) => setInspector(e.target.value)}
                            required
                            style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11px', outline: 'none' }}
                        />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>Inspection Date *</label>
                        <input
                            type="date"
                            value={inspectionDate}
                            onChange={(e) => setInspectionDate(e.target.value)}
                            required
                            style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11px', outline: 'none' }}
                        />
                    </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '16px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>Notes</label>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={2}
                        style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11px', outline: 'none', resize: 'vertical' }}
                    />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{ padding: '8px 20px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11px', fontWeight: 600, color: '#64748b', background: 'var(--card-bg)', cursor: 'pointer' }}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        style={{ padding: '8px 20px', border: 'none', borderRadius: '8px', fontSize: '11px', fontWeight: 600, color: 'white', background: '#4f46e5', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', opacity: loading ? 0.7 : 1 }}
                    >
                        <Save size={14} />
                        {loading ? 'Saving...' : record ? 'Update Record' : 'Save Record'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
