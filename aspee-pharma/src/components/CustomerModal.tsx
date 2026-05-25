'use client';

import React, { useState, useEffect, useRef } from 'react';
import Modal from './Modal';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import {
    User, Phone, Mail, MapPin, Activity,
    Building2, IdCard, Upload, X, FileText, CheckCircle2, Tag, Navigation, UserCheck,
    ArrowLeft, Download, Printer, Banknote, Receipt
} from 'lucide-react';
import { formatCurrency } from '@/lib/currency';

interface CustomerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    record?: any;
    readOnly?: boolean;
}

const CUSTOMER_CATEGORIES = [
    'OTC',
    'WHOLESALE PHARMACY',
    'RETAIL PHARMACY',
    'CLINIC',
    'HOSPITAL',
    'MEDICAL STORES',
] as const;

const initialForm = {
    name: '',
    contact_person: '',
    email: '',
    phone: '',
    address: '',
    status: 'Active',
    customer_category: '',
    customer_location: '',
    sales_person: '',
    route: '',
    credit_limit: 0,
};

const BUCKET = 'compliance-documents';

function safeFileName(name: string) {
    return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export default function CustomerModal({ isOpen, onClose, onSuccess, record, readOnly }: CustomerModalProps) {
    const [formData, setFormData] = useState(initialForm);
    const [loading, setLoading] = useState(false);

    // Route & Sales Person options
    const [routes, setRoutes] = useState<string[]>([]);
    const [salesPersons, setSalesPersons] = useState<string[]>([]);

    useEffect(() => {
        supabase.from('vans').select('route_area').then(({ data }) => {
            const areas = [...new Set((data || []).map((v: any) => v.route_area).filter(Boolean))].sort() as string[];
            setRoutes(areas);
        });
        supabase
            .from('system_users')
            .select('name')
            .eq('status', 'Active')
            .in('role', ['Van Sales Rep', 'Sales Manager'])
            .order('name', { ascending: true })
            .then(({ data }) => {
                const names = [...new Set((data || []).map((u: any) => u.name).filter(Boolean))].sort() as string[];
                setSalesPersons(names);
            });
    }, []);

    // Ghana Card state
    const [ghanaCardNumber, setGhanaCardNumber] = useState('');
    const [ghanaCardFile, setGhanaCardFile] = useState<File | null>(null);
    const [ghanaCardPreview, setGhanaCardPreview] = useState<string | null>(null);
    const [existingGhanaCard, setExistingGhanaCard] = useState<any | null>(null);
    const [ghanaCardUrl, setGhanaCardUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const printRef = useRef<HTMLDivElement>(null);

    // Financial transactions state
    const [transactions, setTransactions] = useState<any[]>([]);
    const [txnSummary, setTxnSummary] = useState({ totalInvoices: 0, totalPayments: 0, balance: 0 });
    const [loadingTxns, setLoadingTxns] = useState(false);

    const fetchTransactions = async (customerName: string) => {
        setLoadingTxns(true);
        try {
            const [invoicesRes, receiptsRes] = await Promise.all([
                supabase
                    .from('sales_invoices')
                    .select('id, invoice_number, date, total_amount, status')
                    .ilike('customer_name', customerName)
                    .order('date', { ascending: true }),
                supabase
                    .from('sales_receipts')
                    .select('id, receipt_number, date, amount')
                    .ilike('customer_name', customerName)
                    .order('date', { ascending: true }),
            ]);

            const invoiceTxns = (invoicesRes.data || []).map((inv: any) => ({
                date: inv.date,
                reference: inv.invoice_number,
                type: 'Invoice' as const,
                description: 'Sales Invoice',
                debit: Number(inv.total_amount) || 0,
                credit: 0,
                status: inv.status,
            }));

            const receiptTxns = (receiptsRes.data || []).map((rec: any) => ({
                date: rec.date,
                reference: rec.receipt_number,
                type: 'Payment' as const,
                description: 'Payment Received',
                debit: 0,
                credit: Number(rec.amount) || 0,
            }));

            const allTxns = [...invoiceTxns, ...receiptTxns].sort(
                (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
            );

            let runningBalance = 0;
            const withBalance = allTxns.map(txn => {
                runningBalance += txn.debit - txn.credit;
                return { ...txn, balance: runningBalance };
            });

            const totalInvoices = invoiceTxns.reduce((s, t) => s + t.debit, 0);
            const totalPayments = receiptTxns.reduce((s, t) => s + t.credit, 0);

            setTransactions(withBalance);
            setTxnSummary({ totalInvoices, totalPayments, balance: runningBalance });
        } catch (err) {
            console.error('Failed to fetch transactions:', err);
        } finally {
            setLoadingTxns(false);
        }
    };

    useEffect(() => {
        if (record) {
            setFormData({
                name: record.name || '',
                contact_person: record.contact_person || '',
                email: record.email || '',
                phone: record.phone || '',
                address: record.address || '',
                status: record.status || 'Active',
                customer_category: record.customer_category || '',
                customer_location: record.customer_location || '',
                sales_person: record.sales_person || '',
                route: record.route || '',
                credit_limit: Number(record.credit_limit) || 0,
            });
            // Load existing Ghana Card doc
            if (record.id) {
                supabase
                    .from('entity_documents')
                    .select('*')
                    .eq('entity_type', 'customer')
                    .eq('entity_id', record.id)
                    .eq('document_type', 'GHANA_CARD')
                    .maybeSingle()
                    .then(async ({ data }) => {
                        setExistingGhanaCard(data || null);
                        setGhanaCardNumber(data?.document_number || '');
                        if (data?.file_path) {
                            try {
                                // Use signed URL for private buckets
                                const { data: signedData, error } = await supabase.storage
                                    .from(BUCKET)
                                    .createSignedUrl(data.file_path, 60 * 60); // 1 hour expiry
                                if (signedData?.signedUrl) {
                                    setGhanaCardUrl(signedData.signedUrl);
                                } else {
                                    // Fallback to public URL if signed URL fails
                                    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(data.file_path);
                                    setGhanaCardUrl(publicUrl);
                                }
                            } catch {
                                // Fallback to public URL on error
                                const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(data.file_path);
                                setGhanaCardUrl(publicUrl);
                            }
                        } else {
                            setGhanaCardUrl(null);
                        }
                    });
            }
            // Fetch financial transactions when viewing
            if (readOnly && record.name) {
                fetchTransactions(record.name);
            }
        } else {
            setFormData(initialForm);
            setGhanaCardNumber('');
            setGhanaCardFile(null);
            setGhanaCardPreview(null);
            setExistingGhanaCard(null);
            setGhanaCardUrl(null);
            setTransactions([]);
            setTxnSummary({ totalInvoices: 0, totalPayments: 0, balance: 0 });
        }
    }, [record, isOpen]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setGhanaCardFile(f);
        if (f.type.startsWith('image/')) {
            setGhanaCardPreview(URL.createObjectURL(f));
        } else {
            setGhanaCardPreview(null);
        }
    };

    const clearFile = () => {
        setGhanaCardFile(null);
        setGhanaCardPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const uploadGhanaCard = async (customerId: string) => {
        if (!ghanaCardFile && !ghanaCardNumber) return;

        let filePath = existingGhanaCard?.file_path || null;

        // Upload file if selected
        if (ghanaCardFile) {
            const ext = ghanaCardFile.name.split('.').pop();
            filePath = `customers/${customerId}/ghana_card_${Date.now()}_${safeFileName(ghanaCardFile.name)}`;
            const { error: uploadError } = await supabase.storage
                .from(BUCKET)
                .upload(filePath, ghanaCardFile, { upsert: true });
            if (uploadError) throw new Error('File upload failed: ' + uploadError.message);
        }

        if (!filePath && !ghanaCardNumber) return;

        const docPayload = {
            entity_type: 'customer',
            entity_id: customerId,
            document_type: 'GHANA_CARD',
            document_number: ghanaCardNumber || null,
            file_path: filePath || '',
            file_name: ghanaCardFile?.name || existingGhanaCard?.file_name || null,
            mime_type: ghanaCardFile?.type || existingGhanaCard?.mime_type || null,
            file_size: ghanaCardFile?.size || existingGhanaCard?.file_size || null,
        };

        if (existingGhanaCard?.id) {
            const { error } = await supabase
                .from('entity_documents')
                .update(docPayload)
                .eq('id', existingGhanaCard.id);
            if (error) throw new Error(error.message);
        } else {
            const { error } = await supabase
                .from('entity_documents')
                .insert(docPayload);
            if (error) throw new Error(error.message);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (readOnly) return;
        setLoading(true);
        try {
            let customerId = record?.id;

            if (record?.id) {
                const { error } = await supabase.from('customers').update(formData).eq('id', record.id);
                if (error) throw error;
                toast.success('Customer updated successfully');
            } else {
                const { data, error } = await supabase.from('customers').insert([formData]).select('id').single();
                if (error) throw error;
                customerId = data.id;
                toast.success('Customer added successfully');
            }

            if (customerId) {
                try {
                    await uploadGhanaCard(customerId);
                } catch (uploadError: any) {
                    // Do not fail customer save when optional file upload fails.
                    const msg = uploadError?.message || 'Ghana Card upload failed';
                    toast.warning(`Customer saved, but Ghana Card upload failed: ${msg}`);
                }
            }

            onSuccess();
            onClose();
        } catch (error: any) {
            toast.error('Error saving customer: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadPDF = async () => {
        const printContent = printRef.current;
        if (!printContent) return;

        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.left = '-9999px';
        container.style.top = '0';

        const styleEl = document.createElement('style');
        styleEl.textContent = customerDocStyles;
        container.appendChild(styleEl);
        
        const clonedContent = printContent.cloneNode(true) as HTMLElement;
        container.appendChild(clonedContent);
        document.body.appendChild(container);

        try {
            const html2pdf = (await import('html2pdf.js')).default;
            await html2pdf()
                .set({
                    margin: 0,
                    filename: `Customer_${formData.name.replace(/\s+/g, '_')}.pdf`,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { scale: 2, useCORS: true, letterRendering: true },
                    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                })
                .from(clonedContent)
                .save();
            toast.success('PDF downloaded successfully!');
        } catch (error) {
            console.error('PDF download failed:', error);
            toast.error('Failed to download PDF.');
        } finally {
            document.body.removeChild(container);
        }
    };

    const openPrintWindow = () => {
        const printContent = printRef.current;
        if (!printContent) return;

        const printWindow = window.open('', '_blank', 'width=900,height=700');
        if (!printWindow) {
            toast.error('Please allow pop-ups to print.');
            return;
        }

        const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Customer Profile - ${formData.name}</title>
    <style>
        ${customerDocStyles}
        @media print {
            body { background: white; }
            .a4-page { margin: 0; padding: 15mm 20mm; min-height: 297mm; box-shadow: none; }
        }
    </style>
</head>
<body>${printContent.outerHTML}</body>
</html>`;

        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.onload = () => {
            printWindow.focus();
            printWindow.print();
        };
    };

    const isEditing = !!record;

    if (readOnly && record) {
        return (
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                title="Customer Details"
                width={1200}
                noPadding
            >
                <div className="a4-document-container">
                    <div className="a4-actions no-print">
                        <button onClick={onClose} className="btn-back">
                            <ArrowLeft size={16} /> Back
                        </button>
                        <div className="a4-action-group">
                            <button onClick={handleDownloadPDF} className="btn-download">
                                <Download size={16} /> Download PDF
                            </button>
                            <button onClick={openPrintWindow} className="btn-print">
                                <Printer size={16} /> Print Profile
                            </button>
                        </div>
                    </div>

                    <div className="a4-preview-scroller">
                        <div className="a4-page" ref={printRef}>
                            {/* Company Header */}
                            <div className="doc-header">
                                <div className="company-info">
                                    <h1 className="company-name">ASPEE PHARMACEUTICALS LTD</h1>
                                    <p className="company-tagline">Quality Healthcare for All</p>
                                    <div className="contact-details">
                                        <p><MapPin size={12} /> Ejisu - Asamang</p>
                                        <p><Phone size={12} /> 0244791052</p>
                                        <p><Mail size={12} /> aspeepharmaceuticalsgh@gmail.com</p>
                                    </div>
                                </div>
                                <div className="doc-type">
                                    <h2>CUSTOMER PROFILE</h2>
                                    <div className="grn-meta">
                                        <div className="meta-row">
                                            <span className="label">Customer ID:</span>
                                            <span className="value">{record.id?.slice(0, 8).toUpperCase()}</span>
                                        </div>
                                        <div className="meta-row">
                                            <span className="label">Category:</span>
                                            <span className="value">{formData.customer_category}</span>
                                        </div>
                                        <div className="meta-row">
                                            <span className="label">Status:</span>
                                            <span className={`status-badge ${formData.status.toLowerCase()}`}>{formData.status}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="doc-addresses">
                                <div className="address-block">
                                    <h3>BASIC INFORMATION</h3>
                                    <div className="address-content">
                                        <strong>{formData.name}</strong>
                                        <p><span style={{ color: '#64748b' }}>Contact Person:</span> {formData.contact_person || 'N/A'}</p>
                                        <p><span style={{ color: '#64748b' }}>Sales Person:</span> {formData.sales_person || 'N/A'}</p>
                                        <p><span style={{ color: '#64748b' }}>Route:</span> {formData.route || 'N/A'}</p>
                                        <p><span style={{ color: '#64748b' }}>Credit Limit:</span> GHS {formData.credit_limit.toLocaleString()}</p>
                                    </div>
                                </div>
                                <div className="address-block">
                                    <h3>CONTACT DETAILS</h3>
                                    <div className="address-content">
                                        <p><span style={{ color: '#64748b' }}>Phone:</span> {formData.phone || 'N/A'}</p>
                                        <p><span style={{ color: '#64748b' }}>Email:</span> {formData.email || 'N/A'}</p>
                                        <p><span style={{ color: '#64748b' }}>Location:</span> {formData.customer_location || 'N/A'}</p>
                                        <p><span style={{ color: '#64748b' }}>Address:</span></p>
                                        <p>{formData.address || 'N/A'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Ghana Card Section */}
                            <div className="qa-section" style={{ border: '2px solid #e2e8f0' }}>
                                <h3 className="qa-section-title">IDENTITY VERIFICATION (GHANA CARD)</h3>
                                <div className="qa-grid" style={{ gridTemplateColumns: '1fr' }}>
                                    <div className="qa-field" style={{ marginBottom: 15 }}>
                                        <span className="qa-label">Ghana Card Number:</span>
                                        <span className="qa-value" style={{ fontFamily: 'monospace', fontSize: 13, letterSpacing: 1 }}>{ghanaCardNumber || 'NOT PROVIDED'}</span>
                                    </div>
                                    
                                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                                        <span className="qa-label" style={{ alignSelf: 'flex-start' }}>Uploaded Ghana Card Image:</span>
                                        {ghanaCardUrl ? (
                                            <div style={{ 
                                                width: '100%', 
                                                maxWidth: '500px', 
                                                height: '300px', 
                                                border: '1px solid #cbd5e1', 
                                                borderRadius: 8,
                                                overflow: 'hidden',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                background: '#f8fafc'
                                            }}>
                                                <img 
                                                    src={ghanaCardUrl} 
                                                    alt="Ghana Card" 
                                                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} 
                                                />
                                            </div>
                                        ) : (
                                            <div style={{ 
                                                width: '100%', 
                                                height: '100px', 
                                                border: '1.5px dashed #cbd5e1', 
                                                borderRadius: 8,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: '#64748b',
                                                fontSize: 11,
                                                background: '#f8fafc'
                                            }}>
                                                No Ghana Card image uploaded
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* ── Financial Transactions ── */}
                            <div className="txn-section">
                                <h3 className="txn-section-title">
                                    FINANCIAL TRANSACTIONS
                                    <span className="txn-count">{transactions.length} record{transactions.length !== 1 ? 's' : ''}</span>
                                </h3>

                                {/* Summary Cards */}
                                <div className="txn-summary-row">
                                    <div className="txn-summary-card txn-card-invoice">
                                        <span className="txn-card-label">Total Invoiced</span>
                                        <span className="txn-card-value">{formatCurrency(txnSummary.totalInvoices)}</span>
                                    </div>
                                    <div className="txn-summary-card txn-card-payment">
                                        <span className="txn-card-label">Total Paid</span>
                                        <span className="txn-card-value">{formatCurrency(txnSummary.totalPayments)}</span>
                                    </div>
                                    <div className={`txn-summary-card ${txnSummary.balance > 0 ? 'txn-card-owing' : 'txn-card-clear'}`}>
                                        <span className="txn-card-label">Outstanding Balance</span>
                                        <span className="txn-card-value">{formatCurrency(txnSummary.balance)}</span>
                                    </div>
                                </div>

                                {/* Ledger Table */}
                                {loadingTxns ? (
                                    <div className="txn-loading">Loading transactions...</div>
                                ) : transactions.length === 0 ? (
                                    <div className="txn-empty">No invoices or payments recorded for this customer yet.</div>
                                ) : (
                                    <table className="txn-table">
                                        <thead>
                                            <tr>
                                                <th style={{ width: 30 }}>#</th>
                                                <th>Date</th>
                                                <th>Reference</th>
                                                <th>Type</th>
                                                <th style={{ textAlign: 'right' }}>Debit (Invoice)</th>
                                                <th style={{ textAlign: 'right' }}>Credit (Payment)</th>
                                                <th style={{ textAlign: 'right' }}>Balance</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {transactions.map((txn, idx) => (
                                                <tr key={idx} className={txn.type === 'Payment' ? 'txn-row-payment' : ''}>
                                                    <td>{idx + 1}</td>
                                                    <td>{txn.date ? new Date(txn.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                                                    <td className="txn-ref">{txn.reference}</td>
                                                    <td>
                                                        <span className={`txn-type-badge ${txn.type === 'Invoice' ? 'txn-type-inv' : 'txn-type-pay'}`}>
                                                            {txn.type}
                                                        </span>
                                                    </td>
                                                    <td style={{ textAlign: 'right', fontWeight: txn.debit > 0 ? 700 : 400 }}>
                                                        {txn.debit > 0 ? formatCurrency(txn.debit) : '—'}
                                                    </td>
                                                    <td style={{ textAlign: 'right', fontWeight: txn.credit > 0 ? 700 : 400, color: txn.credit > 0 ? '#059669' : undefined }}>
                                                        {txn.credit > 0 ? formatCurrency(txn.credit) : '—'}
                                                    </td>
                                                    <td style={{ textAlign: 'right', fontWeight: 700, color: txn.balance > 0 ? '#dc2626' : '#059669' }}>
                                                        {formatCurrency(txn.balance)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="txn-total-row">
                                                <td colSpan={4} style={{ fontWeight: 700 }}>Totals</td>
                                                <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrency(txnSummary.totalInvoices)}</td>
                                                <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669' }}>{formatCurrency(txnSummary.totalPayments)}</td>
                                                <td style={{ textAlign: 'right', fontWeight: 800, color: txnSummary.balance > 0 ? '#dc2626' : '#059669' }}>
                                                    {formatCurrency(txnSummary.balance)}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                )}
                            </div>

                            <div className="doc-footer">
                                <div className="notes-box">
                                    <h4>Verification Notes</h4>
                                    <ul>
                                        <li>Customer identity verified against Ghana Card.</li>
                                        <li>Contact details and physical address confirmed.</li>
                                        <li>Credit limit approved based on assessment.</li>
                                    </ul>
                                </div>
                                <div className="signatures">
                                    <div className="sig-block">
                                        <div className="sig-line"></div>
                                        <p>Sales Manager</p>
                                    </div>
                                    <div className="sig-block">
                                        <div className="sig-line"></div>
                                        <p>Managing Director</p>
                                    </div>
                                </div>
                            </div>

                            <div className="page-footer">
                                <p>This is an official customer record of Aspee Pharmaceuticals Ltd.</p>
                                <p>Generated on {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <style>{`
                    .a4-document-container {
                        background: var(--slate-100);
                        min-height: 80vh;
                        display: flex;
                        flex-direction: column;
                        overflow: hidden;
                    }
                    .a4-actions {
                        width: 100%;
                        padding: 16px 24px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        background: var(--card-bg);
                        border-bottom: 1px solid var(--slate-200);
                        z-index: 10;
                    }
                    .a4-action-group {
                        display: flex;
                        gap: 12px;
                    }
                    .btn-back, .btn-print, .btn-download {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        padding: 10px 18px;
                        border-radius: 8px;
                        font-weight: 600;
                        font-size: 11px;
                        cursor: pointer;
                        transition: all 0.2s;
                    }
                    .btn-back {
                        background: var(--slate-50);
                        border: 1px solid var(--slate-200);
                        color: var(--slate-600);
                    }
                    .btn-download {
                        background: var(--card-bg);
                        border: 1px solid var(--primary-200);
                        color: var(--primary-600);
                    }
                    .btn-print {
                        background: var(--primary-600);
                        border: none;
                        color: white;
                        box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
                    }
                    .a4-preview-scroller {
                        flex: 1;
                        overflow-y: auto;
                        padding: 40px 20px;
                        display: flex;
                        justify-content: center;
                    }
                    .a4-page {
                        width: 210mm;
                        min-height: 297mm;
                        background: white;
                        padding: 15mm 20mm;
                        box-shadow: 0 10px 40px rgba(0,0,0,0.1);
                        color: #1a1a1a;
                        font-family: 'Inter', sans-serif;
                        display: flex;
                        flex-direction: column;
                    }
                    .doc-header {
                        display: flex;
                        justify-content: space-between;
                        border-bottom: 2px solid #1a1a1a;
                        padding-bottom: 20px;
                        margin-bottom: 30px;
                    }
                    .company-name { font-size: 12px; font-weight: 800; margin: 0; color: #0f172a; }
                    .company-tagline { font-size: 11px; color: #64748b; font-style: italic; margin: 2px 0 10px 0; }
                    .contact-details p { display: flex; align-items: center; gap: 6px; font-size: 11px; margin: 3px 0; color: #334155; }
                    .doc-type h2 { text-align: right; color: #0f172a; font-size: 12px; font-weight: 800; margin: 0 0 12px 0; letter-spacing: 0.05em; }
                    .grn-meta { display: flex; flex-direction: column; gap: 4px; }
                    .meta-row { display: flex; justify-content: flex-end; gap: 10px; font-size: 11px; }
                    .meta-row .label { color: #64748b; font-weight: 500; }
                    .meta-row .value { color: #0f172a; font-weight: 700; }
                    .status-badge { padding: 1px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
                    .status-badge.active { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
                    .status-badge.inactive { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
                    .doc-addresses { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 30px; }
                    .address-block h3 { font-size: 11px; font-weight: 800; color: #94a3b8; border-bottom: 1px solid #eee; padding-bottom: 6px; margin-bottom: 12px; letter-spacing: 0.05em; }
                    .address-content { font-size: 11px; line-height: 1.6; }
                    .address-content strong { display: block; font-size: 12px; margin-bottom: 6px; color: #0f172a; }
                    .qa-section { margin-bottom: 30px; padding: 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; }
                    .qa-section-title { font-size: 11px; font-weight: 800; color: #334155; letter-spacing: 0.05em; margin-bottom: 14px; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0; }
                    .qa-grid { display: grid; gap: 12px; }
                    .qa-field { display: flex; align-items: center; gap: 8px; font-size: 11px; }
                    .qa-label { font-weight: 600; color: #64748b; }
                    .qa-value { font-weight: 700; color: #0f172a; }
                    .doc-footer { display: grid; grid-template-columns: 1.5fr 1fr; gap: 60px; margin-top: auto; padding-top: 30px; }
                    .notes-box h4 { font-size: 11px; font-weight: 800; margin: 0 0 10px 0; color: #1e293b; text-transform: uppercase; }
                    .notes-box ul { padding-left: 14px; margin: 0; }
                    .notes-box li { font-size: 11px; color: #475569; margin-bottom: 4px; line-height: 1.4; }
                    .signatures { display: flex; flex-direction: column; gap: 30px; }
                    .sig-block { text-align: center; }
                    .sig-line { border-bottom: 1px solid #1a1a1a; margin-bottom: 6px; }
                    .sig-block p { font-size: 11px; font-weight: 700; color: #334155; text-transform: uppercase; }
                    .page-footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #eee; text-align: center; font-size: 10px; color: #94a3b8; }

                    /* ── Financial Transactions ── */
                    .txn-section {
                        margin-bottom: 24px;
                        padding: 16px 18px;
                        background: #fafbfc;
                        border: 1.5px solid #e2e8f0;
                        border-radius: 8px;
                    }
                    .txn-section-title {
                        font-size: 11px;
                        font-weight: 800;
                        color: #334155;
                        letter-spacing: 0.05em;
                        margin-bottom: 14px;
                        padding-bottom: 8px;
                        border-bottom: 1px solid #e2e8f0;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                    }
                    .txn-count {
                        font-size: 10px;
                        font-weight: 600;
                        color: #64748b;
                        background: #e2e8f0;
                        padding: 2px 8px;
                        border-radius: 10px;
                        letter-spacing: 0;
                        text-transform: none;
                    }
                    .txn-summary-row {
                        display: grid;
                        grid-template-columns: repeat(3, 1fr);
                        gap: 10px;
                        margin-bottom: 14px;
                    }
                    .txn-summary-card {
                        padding: 10px 14px;
                        border-radius: 8px;
                        display: flex;
                        flex-direction: column;
                        gap: 2px;
                    }
                    .txn-card-label {
                        font-size: 9px;
                        font-weight: 600;
                        text-transform: uppercase;
                        letter-spacing: 0.04em;
                    }
                    .txn-card-value {
                        font-size: 13px;
                        font-weight: 800;
                        font-family: 'SF Mono', 'Menlo', monospace;
                    }
                    .txn-card-invoice {
                        background: #eff6ff;
                        border: 1px solid #bfdbfe;
                    }
                    .txn-card-invoice .txn-card-label { color: #3b82f6; }
                    .txn-card-invoice .txn-card-value { color: #1e40af; }
                    .txn-card-payment {
                        background: #f0fdf4;
                        border: 1px solid #bbf7d0;
                    }
                    .txn-card-payment .txn-card-label { color: #059669; }
                    .txn-card-payment .txn-card-value { color: #166534; }
                    .txn-card-owing {
                        background: #fef2f2;
                        border: 1px solid #fecaca;
                    }
                    .txn-card-owing .txn-card-label { color: #dc2626; }
                    .txn-card-owing .txn-card-value { color: #991b1b; }
                    .txn-card-clear {
                        background: #f0fdf4;
                        border: 1px solid #bbf7d0;
                    }
                    .txn-card-clear .txn-card-label { color: #059669; }
                    .txn-card-clear .txn-card-value { color: #166534; }

                    .txn-table {
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 10px;
                    }
                    .txn-table th {
                        background: #f1f5f9;
                        padding: 7px 8px;
                        text-align: left;
                        font-size: 9px;
                        font-weight: 700;
                        color: #475569;
                        text-transform: uppercase;
                        letter-spacing: 0.03em;
                        border-top: 1.5px solid #334155;
                        border-bottom: 1.5px solid #334155;
                    }
                    .txn-table td {
                        padding: 7px 8px;
                        border-bottom: 1px solid #e2e8f0;
                        font-size: 10px;
                        color: #334155;
                    }
                    .txn-table tbody tr:hover {
                        background: #f8fafc;
                    }
                    .txn-ref {
                        font-family: 'SF Mono', 'Menlo', monospace;
                        font-weight: 600;
                        color: #1e40af;
                        font-size: 10px;
                    }
                    .txn-type-badge {
                        display: inline-block;
                        padding: 1px 6px;
                        border-radius: 4px;
                        font-size: 9px;
                        font-weight: 700;
                    }
                    .txn-type-inv {
                        background: #dbeafe;
                        color: #1e40af;
                    }
                    .txn-type-pay {
                        background: #dcfce7;
                        color: #166534;
                    }
                    .txn-total-row td {
                        padding: 8px;
                        background: #f1f5f9;
                        border-top: 2px solid #334155;
                        font-size: 10px;
                    }
                    .txn-loading, .txn-empty {
                        text-align: center;
                        padding: 24px 16px;
                        font-size: 11px;
                        color: #94a3b8;
                        font-style: italic;
                    }
                `}</style>
            </Modal>
        );
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={readOnly ? 'View Customer' : isEditing ? 'Edit Customer' : 'Add New Customer'}
            subtitle={readOnly ? 'Viewing customer details' : isEditing ? 'Update customer details below' : 'Fill in the details to register a new customer'}
            width={680}
        >
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

                {/* ── Section: Customer Information ── */}
                <div style={sectionStyle}>
                    <div style={sectionHeaderStyle}>
                        <Building2 size={13} />
                        <span>Customer Information</span>
                    </div>

                    <div style={fieldStyle}>
                        <label style={labelStyle}>Customer Name <span style={{ color: 'var(--danger)' }}>*</span></label>
                        <div style={inputWrapStyle}>
                            <Building2 size={14} style={iconStyle} />
                            <input required type="text" value={formData.name}
                                disabled={readOnly}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g. Korle-Bu Teaching Hospital Pharmacy"
                                style={{ ...inputStyle, paddingLeft: 36 }} />
                        </div>
                    </div>

                    <div style={rowStyle}>
                        <div style={fieldStyle}>
                            <label style={labelStyle}>Contact Person</label>
                            <div style={inputWrapStyle}>
                                <User size={14} style={iconStyle} />
                                <input type="text" value={formData.contact_person}
                                    disabled={readOnly}
                                    onChange={e => setFormData({ ...formData, contact_person: e.target.value })}
                                    placeholder="e.g. Kwame Asante"
                                    style={{ ...inputStyle, paddingLeft: 36 }} />
                            </div>
                        </div>
                        <div style={fieldStyle}>
                            <label style={labelStyle}>Status</label>
                            <div style={inputWrapStyle}>
                                <Activity size={14} style={iconStyle} />
                                <select value={formData.status}
                                    disabled={readOnly}
                                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                                    style={{ ...inputStyle, paddingLeft: 36 }}>
                                    <option value="Active">Active</option>
                                    <option value="Inactive">Inactive</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Section: Sales Classification ── */}
                <div style={sectionStyle}>
                    <div style={sectionHeaderStyle}>
                        <Tag size={13} />
                        <span>Sales Classification</span>
                    </div>

                    <div style={rowStyle}>
                        <div style={fieldStyle}>
                            <label style={labelStyle}>Customer Category <span style={{ color: 'var(--danger)' }}>*</span></label>
                            <div style={inputWrapStyle}>
                                <Tag size={14} style={iconStyle} />
                                <select required value={formData.customer_category}
                                    disabled={readOnly}
                                    onChange={e => setFormData({ ...formData, customer_category: e.target.value })}
                                    style={{ ...inputStyle, paddingLeft: 36 }}>
                                    <option value="">Select category…</option>
                                    {CUSTOMER_CATEGORIES.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div style={fieldStyle}>
                            <label style={labelStyle}>Assigned Sales Person</label>
                            <div style={inputWrapStyle}>
                                <UserCheck size={14} style={iconStyle} />
                                <select value={formData.sales_person}
                                    disabled={readOnly}
                                    onChange={e => setFormData({ ...formData, sales_person: e.target.value })}
                                    style={{ ...inputStyle, paddingLeft: 36 }}>
                                    <option value="">Select sales person…</option>
                                    {salesPersons.map(p => (
                                        <option key={p} value={p}>{p}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div style={{ ...rowStyle, marginTop: 12 }}>
                        <div style={fieldStyle}>
                            <label style={labelStyle}>Route</label>
                            <div style={inputWrapStyle}>
                                <Navigation size={14} style={iconStyle} />
                                <select value={formData.route}
                                    disabled={readOnly}
                                    onChange={e => setFormData({ ...formData, route: e.target.value })}
                                    style={{ ...inputStyle, paddingLeft: 36 }}>
                                    <option value="">Select route…</option>
                                    {routes.map(r => (
                                        <option key={r} value={r}>{r}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div style={fieldStyle}>
                            <label style={labelStyle}>Credit Limit</label>
                            <div style={inputWrapStyle}>
                                <Tag size={14} style={iconStyle} />
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    disabled={readOnly}
                                    value={formData.credit_limit}
                                    onChange={e => setFormData({ ...formData, credit_limit: parseFloat(e.target.value) || 0 })}
                                    placeholder="e.g. 5000.00"
                                    style={{ ...inputStyle, paddingLeft: 36 }}
                                />
                            </div>
                        </div>
                    </div>

                    <div style={{ ...rowStyle, marginTop: 12 }}>
                        <div style={fieldStyle}>
                            <label style={labelStyle}>Customer Location</label>
                            <div style={inputWrapStyle}>
                                <MapPin size={14} style={iconStyle} />
                                <input type="text" value={formData.customer_location}
                                    disabled={readOnly}
                                    onChange={e => setFormData({ ...formData, customer_location: e.target.value })}
                                    placeholder="e.g. Accra Central, Tema"
                                    style={{ ...inputStyle, paddingLeft: 36 }} />
                            </div>
                        </div>
                        <div style={fieldStyle} />
                    </div>
                </div>

                {/* ── Section: Contact Details ── */}
                <div style={sectionStyle}>
                    <div style={sectionHeaderStyle}>
                        <Phone size={13} />
                        <span>Contact Details</span>
                    </div>

                    <div style={rowStyle}>
                        <div style={fieldStyle}>
                            <label style={labelStyle}>Phone Number</label>
                            <div style={inputWrapStyle}>
                                <Phone size={14} style={iconStyle} />
                                <input type="tel" value={formData.phone}
                                    disabled={readOnly}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                    placeholder="+233 XX XXX XXXX"
                                    style={{ ...inputStyle, paddingLeft: 36 }} />
                            </div>
                        </div>
                        <div style={fieldStyle}>
                            <label style={labelStyle}>Email Address</label>
                            <div style={inputWrapStyle}>
                                <Mail size={14} style={iconStyle} />
                                <input type="email" value={formData.email}
                                    disabled={readOnly}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="contact@example.com"
                                    style={{ ...inputStyle, paddingLeft: 36 }} />
                            </div>
                        </div>
                    </div>

                    <div style={{ ...fieldStyle, marginTop: 12 }}>
                        <label style={labelStyle}>Address</label>
                        <div style={{ ...inputWrapStyle, alignItems: 'flex-start' }}>
                            <MapPin size={14} style={{ ...iconStyle, top: 11 }} />
                            <textarea rows={2} value={formData.address}
                                disabled={readOnly}
                                onChange={e => setFormData({ ...formData, address: e.target.value })}
                                placeholder="Full physical address..."
                                style={{ ...inputStyle, paddingLeft: 36, paddingTop: 10, resize: 'vertical', minHeight: 64, fontFamily: 'inherit' }} />
                        </div>
                    </div>
                </div>

                {/* ── Section: Ghana Card ── */}
                <div style={{ ...sectionStyle, borderBottom: 'none', paddingBottom: 0 }}>
                    <div style={sectionHeaderStyle}>
                        <IdCard size={13} />
                        <span>Ghana Card</span>
                        {existingGhanaCard && (
                            <span style={{
                                marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4,
                                fontSize: 10, fontWeight: 600, color: '#065f46',
                                background: '#d1fae5', padding: '2px 8px', borderRadius: 10,
                            }}>
                                <CheckCircle2 size={10} /> On file
                            </span>
                        )}
                    </div>

                    <div style={rowStyle}>
                        <div style={fieldStyle}>
                            <label style={labelStyle}>Ghana Card Number</label>
                            <div style={inputWrapStyle}>
                                <IdCard size={14} style={iconStyle} />
                                <input type="text" value={ghanaCardNumber}
                                    disabled={readOnly}
                                    onChange={e => setGhanaCardNumber(e.target.value)}
                                    placeholder="GHA-XXXXXXXXX-X"
                                    style={{ ...inputStyle, paddingLeft: 36, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }} />
                            </div>
                        </div>
                        <div style={fieldStyle}>
                            <label style={labelStyle}>Upload Ghana Card</label>
                            <input ref={fileInputRef} type="file"
                                accept="image/*,application/pdf"
                                onChange={handleFileChange}
                                style={{ display: 'none' }} />

                            {ghanaCardFile ? (
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    padding: '9px 12px', borderRadius: 10,
                                    border: '1.5px solid #bbf7d0', background: '#f0fdf4',
                                }}>
                                    {ghanaCardPreview ? (
                                        <img src={ghanaCardPreview} alt="preview"
                                            style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 6, border: '1px solid #bbf7d0' }} />
                                    ) : (
                                        <div style={{ width: 36, height: 36, borderRadius: 6, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <FileText size={16} style={{ color: '#16a34a' }} />
                                        </div>
                                    )}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{ fontSize: 11, fontWeight: 600, color: '#15803d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ghanaCardFile.name}</p>
                                        <p style={{ fontSize: 10, color: '#4ade80' }}>{(ghanaCardFile.size / 1024).toFixed(1)} KB</p>
                                    </div>
                                    {!readOnly && (
                                        <button type="button" onClick={clearFile}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#16a34a', padding: 2, display: 'flex' }}>
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>
                            ) : existingGhanaCard?.file_path ? (
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    padding: '9px 12px', borderRadius: 10,
                                    border: '1.5px solid var(--slate-200)', background: 'var(--slate-50)',
                                }}>
                                    <div style={{ width: 36, height: 36, borderRadius: 6, background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <FileText size={16} style={{ color: '#2563eb' }} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--slate-700)' }}>{existingGhanaCard.file_name || 'Ghana Card'}</p>
                                        <p style={{ fontSize: 10, color: 'var(--slate-400)' }}>{readOnly ? 'Uploaded file' : 'Already uploaded — select a new file to replace'}</p>
                                    </div>
                                    {!readOnly && (
                                        <button type="button" onClick={() => fileInputRef.current?.click()}
                                            style={{ fontSize: 10, fontWeight: 600, color: 'var(--primary-600)', background: 'none', border: 'none', cursor: 'pointer' }}>
                                            Replace
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <button type="button" 
                                    disabled={readOnly}
                                    onClick={() => fileInputRef.current?.click()}
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                        width: '100%', padding: '9px 12px', borderRadius: 10,
                                        border: '1.5px dashed var(--slate-300)', background: 'var(--slate-50)',
                                        color: 'var(--slate-500)', fontSize: 11, fontWeight: 600,
                                        cursor: readOnly ? 'default' : 'pointer', transition: 'all 0.2s',
                                    }}
                                    onMouseEnter={e => { if (!readOnly) { e.currentTarget.style.borderColor = 'var(--primary-400)'; e.currentTarget.style.color = 'var(--primary-600)'; e.currentTarget.style.background = 'var(--primary-50)'; } }}
                                    onMouseLeave={e => { if (!readOnly) { e.currentTarget.style.borderColor = 'var(--slate-300)'; e.currentTarget.style.color = 'var(--slate-500)'; e.currentTarget.style.background = 'var(--slate-50)'; } }}
                                >
                                    <Upload size={14} /> {readOnly ? 'No Ghana Card uploaded' : 'Click to upload image or PDF'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Actions ── */}
                <div style={{
                    display: 'flex', gap: 10, justifyContent: 'flex-end',
                    marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--slate-100)',
                }}>
                    <button type="button" onClick={onClose}
                        style={{
                            padding: '9px 20px', borderRadius: 10, border: '1.5px solid var(--slate-200)',
                            background: 'var(--card-bg)', color: 'var(--slate-600)',
                            fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                        }}>
                        {readOnly ? 'Close' : 'Cancel'}
                    </button>
                    {!readOnly && (
                        <button type="submit" disabled={loading}
                            style={{
                                padding: '9px 24px', borderRadius: 10, border: 'none',
                                background: 'linear-gradient(135deg, var(--primary-600), var(--primary-500))',
                                color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'inherit',
                                boxShadow: '0 2px 8px rgba(6,182,212,0.25)',
                                opacity: loading ? 0.7 : 1,
                            }}>
                            {loading ? (
                                <>
                                    <span style={{
                                        width: 14, height: 14, borderRadius: '50%',
                                        border: '2px solid rgba(255,255,255,0.3)',
                                        borderTopColor: 'white', animation: 'custSpin 0.6s linear infinite',
                                        display: 'inline-block',
                                    }} />
                                    Saving…
                                </>
                            ) : isEditing ? 'Update Customer' : 'Add Customer'}
                        </button>
                    )}
                </div>
            </form>

            <style>{`
                @keyframes custSpin { to { transform: rotate(360deg); } }
                select { appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 10px center; padding-right: 32px; cursor: pointer; }
            `}</style>
        </Modal>
    );
}

// ── Shared style objects ────────────────────────────────
const customerDocStyles = `
    @page { size: A4; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
        font-family: 'Inter', -apple-system, sans-serif;
        color: #1a1a1a;
        background: white;
    }
    .a4-page {
        width: 210mm;
        min-height: 297mm;
        padding: 15mm 20mm;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        background: white;
    }
    .doc-header {
        display: flex;
        justify-content: space-between;
        border-bottom: 2px solid #1a1a1a;
        padding-bottom: 20px;
        margin-bottom: 30px;
    }
    .company-name { font-size: 12px; font-weight: 800; margin: 0; color: #0f172a; }
    .company-tagline { font-size: 11px; color: #64748b; font-style: italic; margin: 2px 0 10px 0; }
    .contact-details p { display: flex; align-items: center; gap: 6px; font-size: 11px; margin: 3px 0; color: #334155; }
    .doc-type h2 { text-align: right; color: #0f172a; font-size: 12px; font-weight: 800; margin: 0 0 12px 0; letter-spacing: 0.05em; }
    .grn-meta { display: flex; flex-direction: column; gap: 4px; }
    .meta-row { display: flex; justify-content: flex-end; gap: 10px; font-size: 11px; }
    .meta-row .label { color: #64748b; font-weight: 500; }
    .meta-row .value { color: #0f172a; font-weight: 700; }
    .status-badge { padding: 1px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
    .status-badge.active { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
    .status-badge.inactive { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
    .doc-addresses { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 30px; }
    .address-block h3 { font-size: 11px; font-weight: 800; color: #94a3b8; border-bottom: 1px solid #eee; padding-bottom: 6px; margin-bottom: 12px; letter-spacing: 0.05em; }
    .address-content { font-size: 11px; line-height: 1.6; }
    .address-content strong { display: block; font-size: 12px; margin-bottom: 6px; color: #0f172a; }
    .qa-section { margin-bottom: 30px; padding: 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; }
    .qa-section-title { font-size: 11px; font-weight: 800; color: #334155; letter-spacing: 0.05em; margin-bottom: 14px; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0; }
    .qa-grid { display: grid; gap: 12px; }
    .qa-field { display: flex; align-items: center; gap: 8px; font-size: 11px; }
    .qa-label { font-weight: 600; color: #64748b; }
    .qa-value { font-weight: 700; color: #0f172a; }
    .doc-footer { display: grid; grid-template-columns: 1.5fr 1fr; gap: 60px; margin-top: auto; padding-top: 30px; }
    .notes-box h4 { font-size: 11px; font-weight: 800; margin: 0 0 10px 0; color: #1e293b; text-transform: uppercase; }
    .notes-box ul { padding-left: 14px; margin: 0; }
    .notes-box li { font-size: 11px; color: #475569; margin-bottom: 4px; line-height: 1.4; }
    .signatures { display: flex; flex-direction: column; gap: 30px; }
    .sig-block { text-align: center; }
    .sig-line { border-bottom: 1px solid #1a1a1a; margin-bottom: 6px; }
    .sig-block p { font-size: 11px; font-weight: 700; color: #334155; text-transform: uppercase; }
    .page-footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #eee; text-align: center; font-size: 10px; color: #94a3b8; }
`;

const sectionStyle: React.CSSProperties = {
    borderBottom: '1px solid var(--slate-100)',
    paddingBottom: 18,
    marginBottom: 18,
};

const sectionHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    color: 'var(--primary-600)',
    marginBottom: 14,
};

const rowStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
};

const fieldStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
};

const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--slate-600)',
    marginBottom: 6,
};

const inputWrapStyle: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
};

const iconStyle: React.CSSProperties = {
    position: 'absolute',
    left: 11,
    color: 'var(--slate-400)',
    pointerEvents: 'none',
    flexShrink: 0,
};

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '9px 12px',
    borderRadius: 10,
    border: '1.5px solid var(--slate-200)',
    fontSize: 12,
    color: 'var(--slate-800)',
    background: 'var(--card-bg)',
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
};
