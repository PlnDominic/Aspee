'use client';

import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { ShieldCheck, Save } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface QAFinishedProductsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    record?: any;
}

export default function QAFinishedProductsModal({ isOpen, onClose, onSave, record }: QAFinishedProductsModalProps) {
    const [loading, setLoading] = useState(false);
    const [fetchingOrders, setFetchingOrders] = useState(false);
    const [productionOrders, setProductionOrders] = useState<any[]>([]);
    
    // Form fields
    const [productionOrderId, setProductionOrderId] = useState('');
    const [selectedProductId, setSelectedProductId] = useState('');
    const [productName, setProductName] = useState('');
    const [batchNumber, setBatchNumber] = useState('');
    const [testsPerformed, setTestsPerformed] = useState('');
    const [overallStatus, setOverallStatus] = useState('Pending');
    const [analyst, setAnalyst] = useState('');
    const [analysisDate, setAnalysisDate] = useState(new Date().toISOString().split('T')[0]);
    const [releaseDate, setReleaseDate] = useState('');
    const [remarks, setRemarks] = useState('');
    
    // Ghost field for inventory
    const [yieldQuantity, setYieldQuantity] = useState<number | ''>('');

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
                    product_id,
                    product:products(name, sku, unit)
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
            setProductName(record.product_name || '');
            setBatchNumber(record.batch_number || '');
            setTestsPerformed(record.tests_performed || '');
            setOverallStatus(record.overall_status || 'Pending');
            setAnalyst(record.analyst || '');
            setAnalysisDate(record.analysis_date ? new Date(record.analysis_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
            setReleaseDate(record.release_date ? new Date(record.release_date).toISOString().split('T')[0] : '');
            setRemarks(record.remarks || '');
            
            // Link back to product ID if possible for stock updates
            if (record.production_order_id && productionOrders.length > 0) {
                const matchOrder = productionOrders.find(o => o.id === record.production_order_id);
                if (matchOrder) setSelectedProductId(matchOrder.product_id);
            }
        } else {
            setProductionOrderId('');
            setSelectedProductId('');
            setProductName('');
            setBatchNumber('');
            setTestsPerformed('');
            setOverallStatus('Pending');
            setAnalyst('');
            setAnalysisDate(new Date().toISOString().split('T')[0]);
            setReleaseDate('');
            setRemarks('');
            setYieldQuantity('');
        }
    }, [record, isOpen, (productionOrders.length > 0)]);

    const handleOrderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const orderId = e.target.value;
        setProductionOrderId(orderId);
        const match = productionOrders.find(o => o.id === orderId);
        if (match) {
            setProductName(match.product?.name || '');
            setBatchNumber(match.batch_number || match.order_number);
            setSelectedProductId(match.product_id);
        } else {
            setProductName('');
            setBatchNumber('');
            setSelectedProductId('');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!productName) {
            toast.error("Please select a job order or product");
            return;
        }

        const isNewApproval = overallStatus === 'Passed' && record?.overall_status !== 'Passed';

        if (isNewApproval && !yieldQuantity) {
            toast.error("Yield Quantity is required to approve to stock.");
            return;
        }

        setLoading(true);

        const payload = {
            production_order_id: productionOrderId || null,
            product_name: productName,
            batch_number: batchNumber,
            tests_performed: testsPerformed,
            overall_status: overallStatus,
            analyst,
            analysis_date: analysisDate,
            release_date: releaseDate || null,
            remarks,
        };

        try {
            // 1. Handle the QA record
            let recordId = record?.id;
            if (recordId) {
                const { error } = await supabase
                    .from('qa_finished_products')
                    .update(payload)
                    .eq('id', recordId);
                if (error) throw error;
                toast.success('Analysis record updated successfully');
            } else {
                const { data, error } = await supabase
                    .from('qa_finished_products')
                    .insert([payload])
                    .select()
                    .single();
                if (error) throw error;
                recordId = data.id;
                toast.success('Analysis record created successfully');
            }

            // 2. Insert into inventory ONLY on first Passed status transition
            if (isNewApproval && selectedProductId && yieldQuantity) {
                // Fetch all locations to find source and destination
                const { data: locations } = await supabase.from('stock_locations').select('id, name');
                
                const qaQuarantine = locations?.find((l: any) => l.name === 'QA Quarantine') || 
                                     locations?.find((l: any) => l.name.toLowerCase().includes('quarantine'));
                const mainStore = locations?.find((l: any) => l.name === 'Main Store') || 
                                  locations?.find((l: any) => l.name.toLowerCase().includes('main')) || 
                                  locations?.[0];

                if (!qaQuarantine || !mainStore) {
                    throw new Error('Could not find required stock locations (Quarantine or Main Store)');
                }

                // 2a. Deduct from QA Quarantine
                const { data: qStock } = await supabase
                    .from('stock_levels')
                    .select('qty_on_hand')
                    .eq('product_id', selectedProductId)
                    .eq('location_id', qaQuarantine.id)
                    .match({ batch_number: batchNumber }) // Strict batch matching
                    .maybeSingle();

                if (qStock) {
                    await supabase
                        .from('stock_levels')
                        .update({ 
                            qty_on_hand: Math.max(0, qStock.qty_on_hand - Number(yieldQuantity)),
                            updated_at: new Date().toISOString()
                        })
                        .eq('product_id', selectedProductId)
                        .eq('location_id', qaQuarantine.id)
                        .match({ batch_number: batchNumber });
                }

                // 2b. Increment in Main Store
                const { data: mStock } = await supabase
                    .from('stock_levels')
                    .select('qty_on_hand')
                    .eq('product_id', selectedProductId)
                    .eq('location_id', mainStore.id)
                    .match({ batch_number: batchNumber })
                    .maybeSingle();

                const currentQty = mStock?.qty_on_hand || 0;
                const newQty = currentQty + Number(yieldQuantity);

                const { error: stockError } = await supabase
                    .from('stock_levels')
                    .upsert({
                        product_id: selectedProductId,
                        location_id: mainStore.id,
                        batch_number: batchNumber,
                        qty_on_hand: newQty,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'product_id,location_id,batch_number' });

                if (stockError) throw stockError;

                // 2c. Record movement as a transfer
                await supabase
                    .from('stock_movements')
                    .insert([{
                        product_id: selectedProductId,
                        movement_type: 'TRANSFER',
                        quantity: Number(yieldQuantity),
                        reference_type: 'QA Release',
                        reference_id: recordId,
                        notes: `Released from Quarantine to Main Store: Batch ${batchNumber}`
                    }]);
                    
                toast.success('Batch released to Main Store inventory.');
            }

            onSave();
        } catch (error: any) {
            toast.error(error.message || 'Failed to save record');
        } finally {
            setLoading(false);
        }
    };

    const isNewApproval = overallStatus === 'Passed' && record?.overall_status !== 'Passed';

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={record ? 'Finished Product Analysis' : 'New Analysis Record'}
            subtitle={record ? `Batch: ${record.batch_number}` : 'Record a finished product quality analysis'}
            width={600}
        >
            <form onSubmit={handleSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    {/* Job Order Selection */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', gridColumn: 'span 2' }}>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>Link to Job Order *</label>
                        <select
                            value={productionOrderId}
                            onChange={handleOrderChange}
                            required
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
                        <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>Product Name</label>
                        <input
                            type="text"
                            value={productName}
                            readOnly
                            style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11px', outline: 'none', background: '#f8fafc' }}
                        />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>Batch Number</label>
                        <input
                            type="text"
                            value={batchNumber}
                            readOnly
                            style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11px', outline: 'none', background: '#f8fafc' }}
                        />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>Overall Status</label>
                        <select
                            value={overallStatus}
                            onChange={(e) => setOverallStatus(e.target.value)}
                            style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11px', outline: 'none', background: 'var(--card-bg)' }}
                        >
                            <option value="Pending">Pending</option>
                            <option value="Passed">Passed</option>
                            <option value="Failed">Failed</option>
                            <option value="Quarantine">Quarantine</option>
                        </select>
                    </div>
                    
                    {isNewApproval && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '11px', fontWeight: 600, color: '#16a34a' }}>Yield Quantity (Passed) *</label>
                            <input
                                type="number"
                                min="0.01"
                                step="any"
                                value={yieldQuantity}
                                onChange={(e) => setYieldQuantity(Number(e.target.value) || '')}
                                required
                                placeholder="Qty to add to stock"
                                style={{ padding: '8px 12px', border: '1px solid #bbf7d0', borderRadius: '8px', fontSize: '11px', outline: 'none', background: '#f0fdf4' }}
                            />
                        </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', gridColumn: 'span 2' }}>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>Tests Performed *</label>
                        <textarea
                            value={testsPerformed}
                            onChange={(e) => setTestsPerformed(e.target.value)}
                            required
                            rows={2}
                            placeholder="e.g. Assay, Dissolution, Sterility"
                            style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11px', outline: 'none', resize: 'vertical' }}
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>Analyst *</label>
                        <input
                            type="text"
                            value={analyst}
                            onChange={(e) => setAnalyst(e.target.value)}
                            required
                            style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11px', outline: 'none' }}
                        />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>Analysis Date *</label>
                        <input
                            type="date"
                            value={analysisDate}
                            onChange={(e) => setAnalysisDate(e.target.value)}
                            required
                            style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11px', outline: 'none' }}
                        />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', gridColumn: 'span 2' }}>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>Release Date</label>
                        <input
                            type="date"
                            value={releaseDate}
                            onChange={(e) => setReleaseDate(e.target.value)}
                            style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11px', outline: 'none' }}
                        />
                    </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '16px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>Remarks</label>
                    <textarea
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        rows={2}
                        style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11px', outline: 'none', resize: 'vertical' }}
                    />
                </div>
                
                {record?.overall_status === 'Passed' && (
                    <div style={{ marginTop: '16px', padding: '12px', background: '#f8fafc', borderRadius: '8px', fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ShieldCheck size={16} color="#16a34a" />
                        This batch has already been approved and its yield has been added to inventory stock.
                    </div>
                )}

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
