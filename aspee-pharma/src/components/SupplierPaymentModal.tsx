'use client';

import React, { useState, useEffect, useRef } from 'react';
import Modal from './Modal';
import {
    CreditCard,
    Hash,
    Calendar,
    Banknote,
    Save,
    Printer,
    Download,
    Mail,
    Phone,
    MapPin,
    ArrowLeft,
    ClipboardList,
    Building2,
    FileText
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/formatCurrency';

interface PurchaseOrder {
    id: string;
    po_number: string;
    supplier_id: string;
    total_amount: number;
    currency?: string;
    status: string;
    payment_status: string;
    suppliers?: { id: string; name: string; email?: string; phone?: string; address?: string; contact_person?: string };
}

interface SupplierPaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    initialData?: any;
    mode?: 'create' | 'edit' | 'view';
}

export default function SupplierPaymentModal({ isOpen, onClose, onSave, initialData, mode = 'create' }: SupplierPaymentModalProps) {
    const printRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
    const [previousPayments, setPreviousPayments] = useState<number>(0);

    const [paymentNumber, setPaymentNumber] = useState('');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [paymentMethod, setPaymentMethod] = useState<string>('');
    const [paymentReference, setPaymentReference] = useState('');
    const [amount, setAmount] = useState<number>(0);
    const [notes, setNotes] = useState('');

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (isOpen) {
            fetchPurchaseOrders();
            if (mode === 'create') {
                resetForm();
                generatePaymentNumber();
            } else if (initialData) {
                populateForm(initialData);
            }
        }
    }, [isOpen, mode, initialData]);

    const fetchPurchaseOrders = async () => {
        setFetching(true);
        try {
            const { data, error } = await supabase
                .from('purchase_orders')
                .select('*, suppliers(id, name, email, phone, address, contact_person)')
                .in('payment_status', ['Unpaid', 'Partial'])
                .order('created_at', { ascending: false });

            if (error) throw error;
            setPurchaseOrders(data || []);
        } catch (error: any) {
            toast.error('Failed to fetch purchase orders: ' + error.message);
        } finally {
            setFetching(false);
        }
    };

    const fetchPreviousPayments = async (poId: string) => {
        try {
            const { data, error } = await supabase
                .from('supplier_payments')
                .select('amount')
                .eq('po_id', poId)
                .in('status', ['Approved', 'Completed']);

            if (error) throw error;
            const total = data?.reduce((sum: number, p: any) => sum + Number(p.amount), 0) || 0;
            setPreviousPayments(total);
        } catch {
            setPreviousPayments(0);
        }
    };

    const resetForm = () => {
        setPaymentNumber('');
        setPaymentDate(new Date().toISOString().split('T')[0]);
        setPaymentMethod('');
        setPaymentReference('');
        setAmount(0);
        setNotes('');
        setSelectedPO(null);
        setPreviousPayments(0);
    };

    const populateForm = async (payment: any) => {
        setPaymentNumber(payment.payment_number || '');
        setPaymentDate(payment.payment_date || new Date().toISOString().split('T')[0]);
        setPaymentMethod(payment.payment_method || '');
        setPaymentReference(payment.payment_reference || '');
        setAmount(Number(payment.amount) || 0);
        setNotes(payment.notes || '');

        if (payment.po_id) {
            const { data: poData } = await supabase
                .from('purchase_orders')
                .select('*, suppliers(id, name, email, phone, address, contact_person)')
                .eq('id', payment.po_id)
                .single();

            if (poData) {
                setSelectedPO(poData);
                await fetchPreviousPayments(poData.id);
            }
        }
    };

    const generatePaymentNumber = () => {
        const date = new Date();
        const year = date.getFullYear().toString().slice(-2);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const random = Math.floor(10000 + Math.random() * 90000);
        setPaymentNumber(`PAY-${year}${month}${day}-${random}`);
    };

    const handlePOSelect = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const poId = e.target.value;
        if (!poId) {
            setSelectedPO(null);
            setPreviousPayments(0);
            setAmount(0);
            return;
        }

        const po = purchaseOrders.find(p => p.id === poId);
        setSelectedPO(po || null);

        if (po) {
            await fetchPreviousPayments(po.id);
            const remaining = Number(po.total_amount) - previousPayments;
            setAmount(remaining > 0 ? remaining : 0);
        }
    };

    const getBalanceDue = () => {
        if (!selectedPO) return 0;
        return Math.max(0, Number(selectedPO.total_amount) - previousPayments);
    };

    const getMethodPlaceholder = () => {
        switch (paymentMethod) {
            case 'Bank Transfer': return 'Transaction/Reference ID';
            case 'Cheque': return 'Cheque number';
            case 'Cash': return 'Receipt number (optional)';
            default: return 'Reference number';
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedPO) {
            toast.error('Please select a Purchase Order');
            return;
        }
        if (!paymentMethod) {
            toast.error('Please select a payment method');
            return;
        }
        if (amount <= 0) {
            toast.error('Please enter a valid payment amount');
            return;
        }
        if (paymentMethod !== 'Cash' && !paymentReference.trim()) {
            toast.error('Please enter a payment reference');
            return;
        }

        const balanceDue = getBalanceDue();
        if (amount > balanceDue && balanceDue > 0) {
            toast.error(`Payment amount exceeds balance due (${formatCurrency(balanceDue, selectedPO?.currency)})`);
            return;
        }

        setLoading(true);
        try {
            await onSave({
                id: initialData?.id,
                payment_number: paymentNumber,
                po_id: selectedPO.id,
                supplier_id: selectedPO.supplier_id,
                payment_date: paymentDate,
                payment_method: paymentMethod,
                payment_reference: paymentReference || null,
                amount: amount,
                status: 'Completed',
                notes: notes || null,
            });
            onClose();
        } catch (error: any) {
            console.error('Error saving payment:', error);
        } finally {
            setLoading(false);
        }
    };

    const isViewOnly = mode === 'view';

    const payDocStyles = `
        @page { size: A4; margin: 0; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', 'Inter', -apple-system, sans-serif;
            color: #1a1a1a;
            background: var(--card-bg);
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        .a4-page {
            width: 210mm;
            min-height: 297mm;
            padding: 15mm 20mm;
            margin: 0 auto;
            display: flex;
            flex-direction: column;
            background: var(--card-bg);
        }
        .doc-header {
            display: flex;
            justify-content: space-between;
            border-bottom: 2px solid #1a1a1a;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .company-name { font-size: 11px; font-weight: 800; margin: 0; letter-spacing: -0.02em; color: #0f172a; }
        .company-tagline { font-size: 11px; color: #64748b; font-style: italic; margin: 2px 0 10px 0; }
        .contact-details p { display: flex; align-items: center; gap: 6px; font-size: 11px; margin: 3px 0; color: #334155; }
        .contact-details svg { width: 12px; height: 12px; flex-shrink: 0; }
        .doc-type h2 { text-align: right; font-size: 11px; font-weight: 800; margin: 0 0 12px 0; letter-spacing: 0.05em; color: #0f172a; }
        .pay-meta { display: flex; flex-direction: column; gap: 4px; }
        .meta-row { display: flex; justify-content: flex-end; gap: 10px; font-size: 11px; }
        .meta-row .label { color: #64748b; font-weight: 500; }
        .meta-row .value { color: #0f172a; font-weight: 700; }
        .status-badge { padding: 1px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
        .status-badge.completed { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
        .status-badge.pending { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
        .doc-addresses { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; margin-bottom: 40px; }
        .address-block h3 { font-size: 11px; font-weight: 800; color: #94a3b8; border-bottom: 1px solid #eee; padding-bottom: 6px; margin-bottom: 12px; letter-spacing: 0.05em; }
        .address-content { font-size: 11px; line-height: 1.5; }
        .address-content strong { display: block; font-size: 11px; margin-bottom: 4px; color: #0f172a; }
        .address-content p { margin: 1px 0; color: #334155; }
        .payment-details-table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
        .payment-details-table th { background: #f8fafc; padding: 12px 10px; text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #334155; border-top: 1.5px solid #1a1a1a; border-bottom: 1.5px solid #1a1a1a; }
        .payment-details-table td { padding: 12px 10px; border-bottom: 1px solid #eee; font-size: 11px; vertical-align: top; }
        .payment-details-table tbody tr:last-child td { border-bottom: 1.5px solid #1a1a1a; }
        .text-right { text-align: right; }
        .amount-large { font-size: 11px; font-weight: 800; color: #0f172a; }
        .summary-row td { padding: 8px 10px; }
        .summary-label { text-align: right; font-weight: 700; font-size: 11px; color: #475569; }
        .summary-value { text-align: right; font-weight: 700; font-size: 11px; }
        .grand-total-row td { padding: 12px 10px !important; background: #f8fafc; border-top: 2px solid #1a1a1a !important; border-bottom: 2px solid #1a1a1a !important; }
        .grand-total-row .summary-label { color: #0f172a; font-size: 11px; }
        .grand-total-row .summary-value { font-size: 11px; color: #0f172a; }
        .no-border { border: none !important; background: transparent !important; }
        .doc-footer { display: grid; grid-template-columns: 1.5fr 1fr; gap: 60px; margin-top: auto; padding-top: 40px; }
        .notes-box h4 { font-size: 11px; font-weight: 800; margin: 0 0 10px 0; color: #1e293b; text-transform: uppercase; }
        .notes-box p, .notes-box ul { font-size: 11px; color: #475569; line-height: 1.5; }
        .notes-box ul { padding-left: 14px; margin: 0; }
        .notes-box li { margin-bottom: 4px; line-height: 1.4; }
        .signatures { display: flex; flex-direction: column; gap: 40px; }
        .sig-block { text-align: center; }
        .sig-line { border-bottom: 1px solid #1a1a1a; margin-bottom: 6px; }
        .sig-block p { font-size: 11px; font-weight: 700; color: #334155; text-transform: uppercase; }
        .page-footer { margin-top: 50px; padding-top: 15px; border-top: 1px solid #eee; text-align: center; font-size: 11px; color: #94a3b8; }
    `;

    const getClonedContent = () => {
        const printContent = printRef.current;
        if (!printContent) return null;
        const clonedContent = printContent.cloneNode(true) as HTMLElement;
        const originalSvgs = printContent.querySelectorAll('svg');
        const clonedSvgs = clonedContent.querySelectorAll('svg');
        originalSvgs.forEach((svg, i) => {
            if (clonedSvgs[i]) clonedSvgs[i].setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        });
        return clonedContent;
    };

    const handleDownloadPDF = async () => {
        const clonedContent = getClonedContent();
        if (!clonedContent) return;

        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.left = '-9999px';
        container.style.top = '0';

        const styleEl = document.createElement('style');
        styleEl.textContent = payDocStyles;
        container.appendChild(styleEl);
        container.appendChild(clonedContent);
        document.body.appendChild(container);

        try {
            const html2pdf = (await import('html2pdf.js')).default;
            await html2pdf()
                .set({
                    margin: 0,
                    filename: `${paymentNumber}.pdf`,
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
        const clonedContent = getClonedContent();
        if (!clonedContent) return;

        const printWindow = window.open('', '_blank', 'width=900,height=700');
        if (!printWindow) {
            toast.error('Please allow pop-ups to print.');
            return;
        }

        const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Payment Voucher - ${paymentNumber}</title>
    <style>
        ${payDocStyles}
        @media print {
            body { background: var(--card-bg); }
            .a4-page { margin: 0; padding: 15mm 20mm; min-height: 297mm; }
        }
    </style>
</head>
<body>${clonedContent.outerHTML}</body>
</html>`;

        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.onload = () => {
            printWindow.focus();
            printWindow.print();
        };
    };

    // VIEW MODE
    if (isViewOnly && initialData) {
        return (
            <Modal isOpen={isOpen} onClose={onClose} title="Payment Voucher Detail" width={1000} noPadding>
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
                                <Printer size={16} /> Print Voucher
                            </button>
                        </div>
                    </div>

                    <div className="a4-preview-scroller">
                        <div className="a4-page" ref={printRef}>
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
                                    <h2>PAYMENT VOUCHER</h2>
                                    <div className="pay-meta">
                                        <div className="meta-row">
                                            <span className="label">Payment No:</span>
                                            <span className="value">{paymentNumber}</span>
                                        </div>
                                        <div className="meta-row">
                                            <span className="label">PO Reference:</span>
                                            <span className="value">{selectedPO?.po_number || '-'}</span>
                                        </div>
                                        <div className="meta-row">
                                            <span className="label">Payment Date:</span>
                                            <span className="value">{new Date(paymentDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                        </div>
                                        <div className="meta-row">
                                            <span className="label">Status:</span>
                                            <span className={`status-badge ${(initialData?.status || 'Completed').toLowerCase()}`}>{initialData?.status || 'Completed'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="doc-addresses">
                                <div className="address-block">
                                    <h3>PAID TO (SUPPLIER)</h3>
                                    <div className="address-content">
                                        <strong>{selectedPO?.suppliers?.name || initialData?.suppliers?.name || '-'}</strong>
                                        {selectedPO?.suppliers?.contact_person && <p>Attn: {selectedPO.suppliers.contact_person}</p>}
                                        {selectedPO?.suppliers?.phone && <p>Phone: {selectedPO.suppliers.phone}</p>}
                                        {selectedPO?.suppliers?.email && <p>Email: {selectedPO.suppliers.email}</p>}
                                    </div>
                                </div>
                                <div className="address-block">
                                    <h3>PAID BY</h3>
                                    <div className="address-content">
                                        <strong>ASPEE PHARMACEUTICALS LTD</strong>
                                        <p>Accounts Department</p>
                                        <p>Ejisu - Asamang</p>
                                        <p>Phone: 0244791052</p>
                                    </div>
                                </div>
                            </div>

                            <table className="payment-details-table">
                                <thead>
                                    <tr>
                                        <th>Description</th>
                                        <th style={{ width: '140px' }}>Payment Method</th>
                                        <th style={{ width: '160px' }}>Reference</th>
                                        <th style={{ width: '140px', textAlign: 'right' }}>Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>
                                            Payment for Purchase Order: <strong>{selectedPO?.po_number || '-'}</strong>
                                        </td>
                                        <td>{paymentMethod}</td>
                                        <td>{paymentReference || '-'}</td>
                                        <td className="text-right amount-large">{formatCurrency(amount, selectedPO?.currency || initialData?.purchase_orders?.currency)}</td>
                                    </tr>
                                </tbody>
                                <tfoot>
                                    <tr className="summary-row">
                                        <td colSpan={2} className="no-border"></td>
                                        <td className="summary-label">PO Total</td>
                                        <td className="summary-value">{formatCurrency(Number(selectedPO?.total_amount || 0), selectedPO?.currency || initialData?.purchase_orders?.currency)}</td>
                                    </tr>
                                    <tr className="summary-row">
                                        <td colSpan={2} className="no-border"></td>
                                        <td className="summary-label">Previously Paid</td>
                                        <td className="summary-value">{formatCurrency(previousPayments, selectedPO?.currency || initialData?.purchase_orders?.currency)}</td>
                                    </tr>
                                    <tr className="grand-total-row">
                                        <td colSpan={2} className="no-border"></td>
                                        <td className="summary-label">AMOUNT PAID</td>
                                        <td className="summary-value">{formatCurrency(amount, selectedPO?.currency || initialData?.purchase_orders?.currency)}</td>
                                    </tr>
                                </tfoot>
                            </table>

                            <div className="doc-footer">
                                <div className="notes-box">
                                    <h4>Notes & Remarks</h4>
                                    {notes ? (
                                        <p>{notes}</p>
                                    ) : (
                                        <ul>
                                            <li>Payment processed by Accounts Department.</li>
                                            <li>This voucher serves as proof of payment.</li>
                                        </ul>
                                    )}
                                </div>
                                <div className="signatures">
                                    <div className="sig-block">
                                        <div className="sig-line"></div>
                                        <p>Prepared By</p>
                                    </div>
                                    <div className="sig-block">
                                        <div className="sig-line"></div>
                                        <p>Approved By</p>
                                    </div>
                                </div>
                            </div>

                            <div className="page-footer">
                                <p>This is a computer generated document. No signature required if scanned/emailed.</p>
                                <p>Aspee Pharmaceuticals Ltd — Delivering Precision in Medicine</p>
                            </div>
                        </div>
                    </div>
                </div>

                <style>{`
                    .a4-document-container {
                        background: var(--slate-100);
                        min-height: 100vh;
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
                    .a4-action-group { display: flex; gap: 12px; }
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
                    .btn-download:hover { background: var(--primary-50); }
                    .btn-print {
                        background: var(--primary-600);
                        border: none;
                        color: white;
                        box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
                    }
                    .btn-print:hover {
                        background: var(--primary-700);
                        transform: translateY(-1px);
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
                        background: var(--card-bg);
                        padding: 15mm 20mm;
                        box-shadow: 0 10px 40px rgba(0,0,0,0.15);
                        color: #1a1a1a;
                        font-family: 'Inter', sans-serif;
                        display: flex;
                        flex-direction: column;
                        transform-origin: top center;
                    }
                    .doc-header {
                        display: flex;
                        justify-content: space-between;
                        border-bottom: 2px solid #1a1a1a;
                        padding-bottom: 20px;
                        margin-bottom: 30px;
                    }
                    .company-name { color: var(--slate-900); font-size: 11px; font-weight: 800; margin: 0; letter-spacing: -0.02em; }
                    .company-tagline { font-size: 11px; color: var(--slate-500); font-style: italic; margin: 2px 0 10px 0; }
                    .contact-details p { display: flex; align-items: center; gap: 6px; font-size: 11px; margin: 3px 0; color: var(--slate-700); }
                    .doc-type h2 { text-align: right; color: var(--slate-900); font-size: 11px; font-weight: 800; margin: 0 0 12px 0; letter-spacing: 0.05em; }
                    .pay-meta { display: flex; flex-direction: column; gap: 4px; }
                    .meta-row { display: flex; justify-content: flex-end; gap: 10px; font-size: 11px; }
                    .meta-row .label { color: var(--slate-500); font-weight: 500; }
                    .meta-row .value { color: var(--slate-900); font-weight: 700; }
                    .status-badge { padding: 1px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
                    .status-badge.completed { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
                    .status-badge.pending { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
                    .doc-addresses { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; margin-bottom: 40px; }
                    .address-block h3 { font-size: 11px; font-weight: 800; color: var(--slate-400); border-bottom: 1px solid #eee; padding-bottom: 6px; margin-bottom: 12px; letter-spacing: 0.05em; }
                    .address-content { font-size: 11px; line-height: 1.5; }
                    .address-content strong { display: block; font-size: 11px; margin-bottom: 4px; color: var(--slate-900); }
                    .address-content p { margin: 1px 0; color: var(--slate-700); }
                    .payment-details-table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
                    .payment-details-table th { background: var(--slate-50); padding: 12px 10px; text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--slate-700); border-top: 1.5px solid #1a1a1a; border-bottom: 1.5px solid #1a1a1a; }
                    .payment-details-table td { padding: 12px 10px; border-bottom: 1px solid #eee; font-size: 11px; vertical-align: top; }
                    .payment-details-table tbody tr:last-child td { border-bottom: 1.5px solid #1a1a1a; }
                    .text-right { text-align: right; }
                    .amount-large { font-size: 11px; font-weight: 800; color: var(--slate-900); }
                    .summary-row td { padding: 8px 10px; }
                    .summary-label { text-align: right; font-weight: 700; font-size: 11px; color: var(--slate-600); }
                    .summary-value { text-align: right; font-weight: 700; font-size: 11px; }
                    .grand-total-row td { padding: 12px 10px !important; background: var(--slate-50); border-top: 2px solid #1a1a1a !important; border-bottom: 2px solid #1a1a1a !important; }
                    .grand-total-row .summary-label { color: var(--slate-900); font-size: 11px; }
                    .grand-total-row .summary-value { font-size: 11px; color: var(--slate-900); }
                    .no-border { border: none !important; background: transparent !important; }
                    .doc-footer { display: grid; grid-template-columns: 1.5fr 1fr; gap: 60px; margin-top: auto; padding-top: 40px; }
                    .notes-box h4 { font-size: 11px; font-weight: 800; margin: 0 0 10px 0; color: var(--slate-800); text-transform: uppercase; }
                    .notes-box p { font-size: 11px; color: var(--slate-600); line-height: 1.5; }
                    .notes-box ul { padding-left: 14px; margin: 0; }
                    .notes-box li { font-size: 11px; color: var(--slate-600); margin-bottom: 4px; line-height: 1.4; }
                    .signatures { display: flex; flex-direction: column; gap: 40px; }
                    .sig-block { text-align: center; }
                    .sig-line { border-bottom: 1px solid #1a1a1a; margin-bottom: 6px; }
                    .sig-block p { font-size: 11px; font-weight: 700; color: var(--slate-700); text-transform: uppercase; }
                    .page-footer { margin-top: 50px; padding-top: 15px; border-top: 1px solid #eee; text-align: center; font-size: 11px; color: var(--slate-400); }
                `}</style>
            </Modal>
        );
    }

    // CREATE/EDIT MODE
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={mode === 'edit' ? 'Edit Payment' : 'Record Supplier Payment'}
            subtitle="Process payment for a purchase order"
            width={700}
        >
            <form onSubmit={handleSubmit} className="payment-form">
                <div className="form-section">
                    <h4 className="section-title">
                        <CreditCard size={16} />
                        Payment Details
                    </h4>

                    <div className="form-grid-2">
                        <div className="form-field">
                            <label>Payment Number</label>
                            <div className="input-wrapper">
                                <Hash size={16} className="icon" />
                                <input
                                    value={paymentNumber}
                                    readOnly
                                    placeholder="Auto-generated"
                                />
                            </div>
                        </div>

                        <div className="form-field">
                            <label>Payment Date *</label>
                            <div className="input-wrapper">
                                <Calendar size={16} className="icon" />
                                <input
                                    type="date"
                                    value={paymentDate}
                                    onChange={(e) => setPaymentDate(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="form-field">
                        <label>Purchase Order *</label>
                        <div className="input-wrapper">
                            <ClipboardList size={16} className="icon" />
                            <select
                                value={selectedPO?.id || ''}
                                onChange={handlePOSelect}
                                disabled={fetching || mode === 'edit'}
                            >
                                <option value="">Select Purchase Order...</option>
                                {purchaseOrders.map(po => (
                                    <option key={po.id} value={po.id}>
                                        {po.po_number} - {po.suppliers?.name} ({formatCurrency(Number(po.total_amount), po.currency)})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {selectedPO && (
                        <div className="po-payment-summary">
                            <div className="pay-summary-item">
                                <span className="pay-summary-label">Supplier</span>
                                <span className="pay-summary-value">{selectedPO.suppliers?.name}</span>
                            </div>
                            <div className="pay-summary-item">
                                <span className="pay-summary-label">PO Total</span>
                                <span className="pay-summary-value">{formatCurrency(Number(selectedPO.total_amount), selectedPO.currency)}</span>
                            </div>
                            <div className="pay-summary-item">
                                <span className="pay-summary-label">Previously Paid</span>
                                <span className="pay-summary-value">{formatCurrency(previousPayments, selectedPO.currency)}</span>
                            </div>
                            <div className="pay-summary-item highlight">
                                <span className="pay-summary-label">Balance Due</span>
                                <span className="pay-summary-value">{formatCurrency(getBalanceDue(), selectedPO.currency)}</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="form-section">
                    <h4 className="section-title">
                        <Banknote size={16} />
                        Payment Method
                    </h4>

                    <div className="payment-methods">
                        {['Bank Transfer', 'Cheque', 'Cash'].map((method) => (
                            <label
                                key={method}
                                className={`method-option ${paymentMethod === method ? 'selected' : ''}`}
                            >
                                <input
                                    type="radio"
                                    name="paymentMethod"
                                    value={method}
                                    checked={paymentMethod === method}
                                    onChange={(e) => setPaymentMethod(e.target.value)}
                                />
                                <div className="method-icon">
                                    {method === 'Bank Transfer' && <Building2 size={20} />}
                                    {method === 'Cheque' && <FileText size={20} />}
                                    {method === 'Cash' && <Banknote size={20} />}
                                </div>
                                <span className="method-label">{method}</span>
                            </label>
                        ))}
                    </div>

                    <div className="form-grid-2">
                        <div className="form-field">
                            <label>Amount ({selectedPO?.currency === 'USD' ? '$' : 'GH₵'}) *</label>
                            <div className="input-wrapper">
                                <Banknote size={16} className="icon" />
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={amount || ''}
                                    onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                                    placeholder="0.00"
                                />
                            </div>
                        </div>

                        <div className="form-field">
                            <label>Payment Reference {paymentMethod !== 'Cash' ? '*' : ''}</label>
                            <div className="input-wrapper">
                                <Hash size={16} className="icon" />
                                <input
                                    type="text"
                                    value={paymentReference}
                                    onChange={(e) => setPaymentReference(e.target.value)}
                                    placeholder={getMethodPlaceholder()}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="form-field full-width">
                    <label>Notes</label>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Add any notes about this payment..."
                        rows={3}
                    />
                </div>

                <div className="form-actions">
                    <button type="button" onClick={onClose} className="btn-cancel">
                        Cancel
                    </button>
                    <button type="submit" className="btn-submit" disabled={loading}>
                        {loading ? (
                            'Processing...'
                        ) : (
                            <>
                                <Save size={16} />
                                {mode === 'edit' ? 'Update Payment' : 'Record Payment'}
                            </>
                        )}
                    </button>
                </div>
            </form>

            <style>{`
                .payment-form {
                    display: flex;
                    flex-direction: column;
                    gap: 24px;
                }
                .form-section {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }
                .section-title {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 11px;
                    font-weight: 700;
                    color: var(--slate-700);
                    margin: 0;
                    padding-bottom: 8px;
                    border-bottom: 1px solid var(--slate-100);
                }
                .form-grid-2 {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 16px;
                }
                .form-field {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }
                .form-field.full-width {
                    grid-column: 1 / -1;
                }
                .form-field label {
                    font-size: 11px;
                    font-weight: 600;
                    color: var(--slate-600);
                }
                .input-wrapper {
                    position: relative;
                    display: flex;
                    align-items: center;
                }
                .input-wrapper .icon {
                    position: absolute;
                    left: 12px;
                    color: var(--slate-400);
                    pointer-events: none;
                }
                .input-wrapper input,
                .input-wrapper select,
                .form-field textarea {
                    width: 100%;
                    padding: 10px 12px;
                    padding-left: 38px;
                    border: 1px solid var(--slate-200);
                    border-radius: 8px;
                    font-size: 11px;
                    transition: all 0.2s;
                    background: var(--card-bg);
                }
                .input-wrapper input:focus,
                .input-wrapper select:focus,
                .form-field textarea:focus {
                    outline: none;
                    border-color: var(--primary-500);
                    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
                }
                .input-wrapper input[readonly] {
                    background: var(--slate-50);
                    color: var(--slate-600);
                }
                .form-field textarea {
                    padding-left: 12px;
                    resize: vertical;
                }

                .po-payment-summary {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 12px;
                    padding: 16px;
                    background: linear-gradient(135deg, var(--primary-50), var(--slate-50));
                    border-radius: 10px;
                    border: 1px solid var(--primary-100);
                }
                .pay-summary-item {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                .pay-summary-label {
                    font-size: 11px;
                    color: var(--slate-500);
                    font-weight: 500;
                }
                .pay-summary-value {
                    font-size: 11px;
                    font-weight: 700;
                    color: var(--slate-900);
                }
                .pay-summary-item.highlight .pay-summary-value {
                    color: var(--primary-600);
                    font-size: 11px;
                }

                .payment-methods {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 12px;
                }
                .method-option {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 8px;
                    padding: 16px 12px;
                    border: 2px solid var(--slate-200);
                    border-radius: 12px;
                    cursor: pointer;
                    transition: all 0.2s;
                    background: var(--card-bg);
                }
                .method-option:hover {
                    border-color: var(--primary-300);
                    background: var(--primary-50);
                }
                .method-option.selected {
                    border-color: var(--primary-500);
                    background: var(--primary-50);
                    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
                }
                .method-option input[type="radio"] {
                    display: none;
                }
                .method-icon {
                    width: 40px;
                    height: 40px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 10px;
                    background: var(--slate-100);
                    color: var(--slate-500);
                    transition: all 0.2s;
                }
                .method-option.selected .method-icon {
                    background: var(--primary-100);
                    color: var(--primary-600);
                }
                .method-label {
                    font-size: 11px;
                    font-weight: 600;
                    color: var(--slate-700);
                }
                .method-option.selected .method-label {
                    color: var(--primary-700);
                }

                .form-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                    padding-top: 16px;
                    border-top: 1px solid var(--slate-100);
                }
                .btn-cancel,
                .btn-submit {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px 20px;
                    border-radius: 8px;
                    font-size: 11px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .btn-cancel {
                    background: var(--card-bg);
                    border: 1px solid var(--slate-200);
                    color: var(--slate-600);
                }
                .btn-cancel:hover { background: var(--slate-50); }
                .btn-submit {
                    background: linear-gradient(135deg, var(--primary-600), var(--primary-500));
                    border: none;
                    color: white;
                }
                .btn-submit:hover:not(:disabled) {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
                }
                .btn-submit:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                @media (max-width: 768px) {
                    .form-grid-2 { grid-template-columns: 1fr; }
                    .po-payment-summary { grid-template-columns: repeat(2, 1fr); }
                    .payment-methods { grid-template-columns: 1fr; }
                }
            `}</style>
        </Modal>
    );
}
