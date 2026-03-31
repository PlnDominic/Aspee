'use client';

import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { Factory, Save, Package, ListChecks } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import StatusBadge from './StatusBadge';

interface ProductionCompletionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    productionOrder: any;
}

export default function ProductionCompletionModal({ isOpen, onClose, onSuccess, productionOrder }: ProductionCompletionModalProps) {
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [yieldQty, setYieldQty] = useState<number>(0);
    const [items, setItems] = useState<any[]>([]);
    
    useEffect(() => {
        if (isOpen && productionOrder) {
            setYieldQty(productionOrder.quantity || 0);
            fetchOrderItems();
        }
    }, [isOpen, productionOrder]);

    const fetchOrderItems = async () => {
        setFetching(true);
        try {
            const { data, error } = await supabase
                .from('production_order_items')
                .select(`
                    *,
                    product:products(id, name, sku, unit, material_type)
                `)
                .eq('order_id', productionOrder.id);

            if (error) throw error;
            
            const fetchedItems = (data || []).map(item => ({
                ...item,
                // Default consumed quantity is the originally required quantity
                actual_consumed: item.quantity_required * (productionOrder.quantity || 1)
            }));
            
            setItems(fetchedItems);
        } catch (error: any) {
            toast.error('Failed to load job order materials: ' + error.message);
        } finally {
            setFetching(false);
        }
    };

    const updateConsumedQty = (index: number, qty: number) => {
        const newItems = [...items];
        newItems[index].actual_consumed = qty;
        setItems(newItems);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (yieldQty < 0) {
            toast.error('Yield quantity cannot be negative');
            return;
        }

        if (items.some(i => i.actual_consumed < 0)) {
            toast.error('Consumed quantities cannot be negative');
            return;
        }

        if (!confirm('Are you sure you want to finish this job order? This will update warehouse inventory permanently.')) {
            return;
        }

        setLoading(true);
        try {
            const yieldBatchNo = `BATCH-${productionOrder.order_number}`;

            // 1. Get Stock Locations
            const { data: locations } = await supabase.from('stock_locations').select('id, name');
            
            const mainStore = locations?.find((l: any) => l.name.toLowerCase().includes('main')) || locations?.[0];
            const finishedGoodsStore = locations?.find((l: any) => l.name.toLowerCase().includes('finished')) || mainStore;

            if (!mainStore) throw new Error('No valid stock locations configured');

            // 2. Deduct Materials from Main Store
            // ... (rest of the loop)
            for (const item of items) {
                if (item.actual_consumed > 0) {
                    // Update stock_levels
                    const { data: existingStock } = await supabase
                        .from('stock_levels')
                        .select('qty_on_hand, batch_number')
                        .eq('product_id', item.product_id)
                        .eq('location_id', mainStore.id)
                        .limit(1)
                        .maybeSingle();

                    const currentQty = existingStock?.qty_on_hand || 0;
                    const batchNo = existingStock?.batch_number || 'N/A';

                    // Update or insert deducted stock
                    const { error: stockError } = await supabase
                        .from('stock_levels')
                        .upsert({
                            product_id: item.product_id,
                            location_id: mainStore.id,
                            batch_number: batchNo,
                            qty_on_hand: currentQty - item.actual_consumed,
                            updated_at: new Date().toISOString()
                        }, { onConflict: 'product_id,location_id,batch_number' });

                    if (stockError) throw stockError;

                    // Record movement
                    await supabase.from('stock_movements').insert([{
                        product_id: item.product_id,
                        movement_type: 'OUT',
                        quantity: item.actual_consumed,
                        reference_type: 'Job Order Consumption',
                        reference_id: productionOrder.id,
                        batch_number: batchNo,
                        notes: `Consumed for Job Order ${productionOrder.order_number}`
                    }]);
                }
            }

            // 3. Increment Finished Goods in QA Quarantine
            if (yieldQty > 0 && productionOrder.product_id) {
                // Find or use QA Quarantine location
                const qaQuarantine = locations?.find((l: any) => l.name === 'QA Quarantine') || 
                                     locations?.find((l: any) => l.name.toLowerCase().includes('quarantine')) ||
                                     finishedGoodsStore;

                const { data: existingFgStock } = await supabase
                    .from('stock_levels')
                    .select('qty_on_hand')
                    .eq('product_id', productionOrder.product_id)
                    .eq('location_id', qaQuarantine!.id)
                    .eq('batch_number', yieldBatchNo)
                    .maybeSingle();

                const fgCurrentQty = existingFgStock?.qty_on_hand || 0;

                const { error: fgStockError } = await supabase
                    .from('stock_levels')
                    .upsert({
                        product_id: productionOrder.product_id,
                        location_id: qaQuarantine!.id,
                        batch_number: yieldBatchNo,
                        qty_on_hand: fgCurrentQty + yieldQty,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'product_id,location_id,batch_number' });

                if (fgStockError) throw fgStockError;

                await supabase.from('stock_movements').insert([{
                    product_id: productionOrder.product_id,
                    movement_type: 'IN',
                    quantity: yieldQty,
                    reference_type: 'Job Order Yield',
                    reference_id: productionOrder.id,
                    batch_number: yieldBatchNo,
                    notes: `Yield from Job Order ${productionOrder.order_number} (Quarantined for QA)`
                }]);
            }

            // 4. Update the Production Order status
            const { error: updateError } = await supabase
                .from('production_orders')
                .update({ 
                    status: 'Completed', 
                    quantity: yieldQty,
                    batch_number: yieldBatchNo
                })
                .eq('id', productionOrder.id);
            
            if (updateError) throw updateError;

            // 5. Auto-create a QA Finished Products record for final QA sign-off
            const { error: qaError } = await supabase
                .from('qa_finished_products')
                .insert([{
                    product_name: productionOrder.product?.name || 'Unknown Product',
                    batch_number: yieldBatchNo,
                    overall_status: 'Quarantine',
                    production_order_id: productionOrder.id,
                    analysis_date: new Date().toISOString().split('T')[0],
                }]);

            if (qaError) {
                // Non-fatal — QA record failing shouldn't block completion
                console.error('Failed to create QA record:', qaError.message);
                toast.warning('Job order completed, but QA record could not be created. Please add it manually in QA → Finished Products.');
            } else {
                toast.success('Job order completed! A QA Finished Products record has been created for final inspection.');
            }

            onSuccess?.();
            onClose();

        } catch (error: any) {
            toast.error('Failed to complete job order: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    if (!productionOrder) return null;

    const rawMaterials = items.filter(item => item.product?.material_type !== 'Packaging Material');
    const pkgMaterials = items.filter(item => item.product?.material_type === 'Packaging Material');

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Complete Job Order & Transfer"
            subtitle={`Confirm yield and material consumption for ${productionOrder.order_number}`}
            width={750}
        >
            <form onSubmit={handleSubmit} className="mr-form">
                <div className="section-title full-width" style={{ marginTop: 0, paddingBottom: 10, borderBottom: '1px solid var(--slate-200)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Package size={20} color="var(--primary-600)" />
                        <span>Finished Goods Yield</span>
                    </div>
                </div>

                <div className="form-grid" style={{ marginBottom: 20 }}>
                    <div className="form-field">
                        <label>Target Product</label>
                        <div className="input-wrapper disabled">
                            <span style={{ paddingLeft: 10, fontSize: 13, fontWeight: 500 }}>
                                {productionOrder.product?.name} ({productionOrder.product?.sku})
                            </span>
                        </div>
                    </div>

                    <div className="form-field">
                        <label>Actual Yield Quantity *</label>
                        <div className="input-wrapper">
                            <input 
                                type="number" 
                                value={yieldQty}
                                onChange={(e) => setYieldQty(parseFloat(e.target.value) || 0)}
                                min="0"
                                step="any"
                                required
                                style={{ paddingLeft: 10, fontSize: 14, fontWeight: 600, color: 'var(--primary-700)' }}
                            />
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--slate-500)', marginTop: 4 }}>
                            Target was {productionOrder.quantity}
                        </span>
                    </div>
                </div>

                <div className="section-title full-width" style={{ marginTop: 10, paddingBottom: 10, borderBottom: '1px solid var(--slate-200)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ListChecks size={20} color="var(--slate-600)" />
                        <span>Materials Consumed</span>
                    </div>
                </div>

                <p style={{ fontSize: 13, color: 'var(--slate-600)', marginBottom: 15 }}>
                     Please verify the actual quantities consumed during production. This will be deducted from the main store.
                </p>

                {fetching ? (
                    <div style={{ padding: 20, textAlign: 'center', color: 'var(--slate-500)' }}>Fetching materials...</div>
                ) : (
                    <>
                        {/* Raw Materials */}
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--slate-700)', marginBottom: 8, marginTop: 10 }}>Raw Materials</div>
                        <div className="items-container full-width">
                            {rawMaterials.length > 0 ? (
                                <table className="mr-table">
                                    <thead>
                                        <tr>
                                            <th style={{width: '45%'}}>Material</th>
                                            <th>Unit</th>
                                            <th>Est. Required</th>
                                            <th style={{width: '25%'}}>Actual Consumed</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rawMaterials.map((item) => {
                                            const idx = items.findIndex(i => i.id === item.id);
                                            return (
                                                <tr key={item.id}>
                                                    <td>
                                                        <div className="product-name">{item.product?.name}</div>
                                                        <div className="product-sku">{item.product?.sku}</div>
                                                    </td>
                                                    <td>{item.product?.unit}</td>
                                                    <td>{(item.quantity_required * productionOrder.quantity).toLocaleString()}</td>
                                                    <td>
                                                        <input
                                                            type="number"
                                                            className="qty-input"
                                                            value={item.actual_consumed}
                                                            onChange={(e) => updateConsumedQty(idx, parseFloat(e.target.value) || 0)}
                                                            min="0"
                                                            step="any"
                                                        />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            ) : (
                                <div style={{ fontSize: 12, color: 'var(--slate-500)', fontStyle: 'italic', padding: 8 }}>No raw materials found.</div>
                            )}
                        </div>

                        {/* Packaging Materials */}
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--slate-700)', marginBottom: 8, marginTop: 20 }}>Packaging Materials</div>
                        <div className="items-container full-width">
                            {pkgMaterials.length > 0 ? (
                                <table className="mr-table">
                                    <thead>
                                        <tr>
                                            <th style={{width: '45%'}}>Material</th>
                                            <th>Unit</th>
                                            <th>Est. Required</th>
                                            <th style={{width: '25%'}}>Actual Consumed</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pkgMaterials.map((item) => {
                                            const idx = items.findIndex(i => i.id === item.id);
                                            return (
                                                <tr key={item.id}>
                                                    <td>
                                                        <div className="product-name">{item.product?.name}</div>
                                                        <div className="product-sku">{item.product?.sku}</div>
                                                    </td>
                                                    <td>{item.product?.unit}</td>
                                                    <td>{(item.quantity_required * productionOrder.quantity).toLocaleString()}</td>
                                                    <td>
                                                        <input
                                                            type="number"
                                                            className="qty-input"
                                                            value={item.actual_consumed}
                                                            onChange={(e) => updateConsumedQty(idx, parseFloat(e.target.value) || 0)}
                                                            min="0"
                                                            step="any"
                                                        />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            ) : (
                                <div style={{ fontSize: 12, color: 'var(--slate-500)', fontStyle: 'italic', padding: 8 }}>No packaging materials found.</div>
                            )}
                        </div>
                    </>
                )}

                <div className="modal-actions" style={{ marginTop: 25 }}>
                    <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
                    <button type="submit" disabled={loading || fetching} className="btn-primary" style={{ background: 'var(--primary-600)' }}>
                        <Factory size={16} />
                        {loading ? 'Processing...' : 'Complete & Transfer'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
