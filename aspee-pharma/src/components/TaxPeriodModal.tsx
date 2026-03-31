'use client';

import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { Save } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/currency';

interface TaxPeriodModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    record?: any;
}

export default function TaxPeriodModal({ isOpen, onClose, onSuccess, record }: TaxPeriodModalProps) {
    const [loading, setLoading] = useState(false);

    const [period, setPeriod] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [outputTax, setOutputTax] = useState<number>(0);
    const [inputTax, setInputTax] = useState<number>(0);
    const [salesInvoiceCount, setSalesInvoiceCount] = useState<number>(0);
    const [purchaseInvoiceCount, setPurchaseInvoiceCount] = useState<number>(0);
    const [dueDate, setDueDate] = useState('');
    const [filingDate, setFilingDate] = useState('');
    const [status, setStatus] = useState('Open');
    const [notes, setNotes] = useState('');

    const netLiability = (Number(outputTax) || 0) - (Number(inputTax) || 0);

    useEffect(() => {
        if (record) {
            setPeriod(record.period || '');
            setStartDate(record.start_date || '');
            setEndDate(record.end_date || '');
            setOutputTax(Number(record.output_tax) || 0);
            setInputTax(Number(record.input_tax) || 0);
            setSalesInvoiceCount(Number(record.sales_invoice_count) || 0);
            setPurchaseInvoiceCount(Number(record.purchase_invoice_count) || 0);
            setDueDate(record.due_date || '');
            setFilingDate(record.filing_date || '');
            setStatus(record.status || 'Open');
            setNotes(record.notes || '');
        } else {
            setPeriod('');
            setStartDate('');
            setEndDate('');
            setOutputTax(0);
            setInputTax(0);
            setSalesInvoiceCount(0);
            setPurchaseInvoiceCount(0);
            setDueDate('');
            setFilingDate('');
            setStatus('Open');
            setNotes('');
        }
    }, [record, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!period.trim()) {
            toast.error('Period name is required');
            return;
        }
        if (!startDate || !endDate) {
            toast.error('Start date and end date are required');
            return;
        }
        if (!dueDate) {
            toast.error('Due date is required');
            return;
        }

        setLoading(true);

        const payload = {
            period: period.trim(),
            start_date: startDate,
            end_date: endDate,
            output_tax: Number(outputTax) || 0,
            input_tax: Number(inputTax) || 0,
            net_liability: netLiability,
            sales_invoice_count: Number(salesInvoiceCount) || 0,
            purchase_invoice_count: Number(purchaseInvoiceCount) || 0,
            due_date: dueDate,
            filing_date: filingDate || null,
            status,
            notes: notes.trim(),
        };

        try {
            if (record?.id) {
                const { error } = await supabase
                    .from('tax_periods')
                    .update(payload)
                    .eq('id', record.id);
                if (error) throw error;
                toast.success('Tax period updated successfully');
            } else {
                const { error } = await supabase
                    .from('tax_periods')
                    .insert([payload]);
                if (error) throw error;
                toast.success('Tax period created successfully');
            }

            onSuccess();
            onClose();
        } catch (error: any) {
            toast.error('Error saving tax period: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={record ? 'Edit Tax Period' : 'New Tax Period'}
            subtitle={record ? `Editing ${record.period}` : 'Record a new tax period'}
            width={640}
        >
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Row 1: Period & Status */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-700)' }}>Period *</label>
                        <input
                            type="text"
                            value={period}
                            onChange={(e) => setPeriod(e.target.value)}
                            placeholder="e.g. Q1 2026, January 2026"
                            required
                            style={{ padding: '8px 12px', border: '1px solid var(--slate-200)', borderRadius: 8, fontSize: 12, outline: 'none' }}
                        />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-700)' }}>Status</label>
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            style={{ padding: '8px 12px', border: '1px solid var(--slate-200)', borderRadius: 8, fontSize: 12, outline: 'none' }}
                        >
                            <option value="Open">Open</option>
                            <option value="Filed">Filed</option>
                            <option value="Overdue">Overdue</option>
                        </select>
                    </div>
                </div>

                {/* Row 2: Start Date & End Date */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-700)' }}>Start Date *</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            required
                            style={{ padding: '8px 12px', border: '1px solid var(--slate-200)', borderRadius: 8, fontSize: 12, outline: 'none' }}
                        />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-700)' }}>End Date *</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            required
                            style={{ padding: '8px 12px', border: '1px solid var(--slate-200)', borderRadius: 8, fontSize: 12, outline: 'none' }}
                        />
                    </div>
                </div>

                {/* Row 3: Output Tax & Input Tax */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-700)' }}>Output Tax (Sales)</label>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={outputTax}
                            onChange={(e) => setOutputTax(Number(e.target.value))}
                            style={{ padding: '8px 12px', border: '1px solid var(--slate-200)', borderRadius: 8, fontSize: 12, outline: 'none' }}
                        />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-700)' }}>Input Tax (Purchases)</label>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={inputTax}
                            onChange={(e) => setInputTax(Number(e.target.value))}
                            style={{ padding: '8px 12px', border: '1px solid var(--slate-200)', borderRadius: 8, fontSize: 12, outline: 'none' }}
                        />
                    </div>
                </div>

                {/* Row 4: Net Liability (readonly) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-700)' }}>Net Liability (auto)</label>
                        <input
                            type="text"
                            readOnly
                            value={formatCurrency(netLiability)}
                            style={{
                                padding: '8px 12px',
                                border: '1px solid var(--slate-200)',
                                borderRadius: 8,
                                fontSize: 12,
                                outline: 'none',
                                background: 'var(--slate-50)',
                                fontWeight: 700,
                                color: netLiability >= 0 ? 'var(--danger)' : 'var(--success)',
                            }}
                        />
                    </div>
                    <div />
                </div>

                {/* Row 5: Invoice Counts */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-700)' }}>Sales Invoice Count</label>
                        <input
                            type="number"
                            min="0"
                            step="1"
                            value={salesInvoiceCount}
                            onChange={(e) => setSalesInvoiceCount(Number(e.target.value))}
                            style={{ padding: '8px 12px', border: '1px solid var(--slate-200)', borderRadius: 8, fontSize: 12, outline: 'none' }}
                        />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-700)' }}>Purchase Invoice Count</label>
                        <input
                            type="number"
                            min="0"
                            step="1"
                            value={purchaseInvoiceCount}
                            onChange={(e) => setPurchaseInvoiceCount(Number(e.target.value))}
                            style={{ padding: '8px 12px', border: '1px solid var(--slate-200)', borderRadius: 8, fontSize: 12, outline: 'none' }}
                        />
                    </div>
                </div>

                {/* Row 6: Due Date & Filing Date */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-700)' }}>Due Date *</label>
                        <input
                            type="date"
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                            required
                            style={{ padding: '8px 12px', border: '1px solid var(--slate-200)', borderRadius: 8, fontSize: 12, outline: 'none' }}
                        />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-700)' }}>Filing Date</label>
                        <input
                            type="date"
                            value={filingDate}
                            onChange={(e) => setFilingDate(e.target.value)}
                            style={{ padding: '8px 12px', border: '1px solid var(--slate-200)', borderRadius: 8, fontSize: 12, outline: 'none' }}
                        />
                    </div>
                </div>

                {/* Notes */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-700)' }}>Notes</label>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                        placeholder="Optional notes about this tax period..."
                        style={{ padding: '8px 12px', border: '1px solid var(--slate-200)', borderRadius: 8, fontSize: 12, outline: 'none', resize: 'vertical' }}
                    />
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingTop: 16, borderTop: '1px solid var(--slate-200)' }}>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{ padding: '8px 20px', border: '1px solid var(--slate-300)', borderRadius: 6, fontSize: 12, fontWeight: 600, color: 'var(--slate-700)', background: 'var(--card-bg)', cursor: 'pointer' }}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        style={{ padding: '8px 20px', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, color: 'white', background: 'var(--primary-600)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: loading ? 0.7 : 1 }}
                    >
                        <Save size={14} />
                        {loading ? 'Saving...' : record ? 'Update Period' : 'Create Period'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
