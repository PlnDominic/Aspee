'use client';

import React, { useRef } from 'react';
import Modal from './Modal';
import {
    ArrowLeft,
    Printer,
    Download,
    CreditCard,
    Hash,
    Calendar,
    Banknote,
    User,
    FileText,
    CheckCircle,
    MapPin,
    Phone,
    Mail,
    Receipt,
    Building2,
} from 'lucide-react';
import { formatCurrency } from '@/lib/currency';
import { toast } from 'sonner';

interface ReceiptViewModalProps {
    isOpen: boolean;
    onClose: () => void;
    receipt: any | null;
}

const methodColor: Record<string, { bg: string; color: string; border: string }> = {
    Cash: { bg: '#dcfce7', color: '#166534', border: '#bbf7d0' },
    Cheque: { bg: '#dbeafe', color: '#1d4ed8', border: '#bfdbfe' },
    'Mobile Money': { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
    'Bank Transfer': { bg: '#f3e8ff', color: '#7e22ce', border: '#ddd6fe' },
};

export default function ReceiptViewModal({ isOpen, onClose, receipt }: ReceiptViewModalProps) {
    const printRef = useRef<HTMLDivElement>(null);

    if (!receipt) return null;

    const methodStyle = methodColor[receipt.payment_method] ?? {
        bg: '#f1f5f9',
        color: '#475569',
        border: '#cbd5e1',
    };

    const dateStr = receipt.date
        ? new Date(receipt.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
        : '-';
    const createdStr = receipt.created_at
        ? new Date(receipt.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
        : '-';
    const amountStr = formatCurrency(Number(receipt.amount ?? 0));

    const handlePrint = () => {
        const content = printRef.current;
        if (!content) return;
        const win = window.open('', '_blank', 'width=900,height=700');
        if (!win) {
            toast.error('Allow pop-ups to print.');
            return;
        }
        const printStyles = `
            .a4-page { width: 210mm; min-height: 297mm; padding: 15mm 20mm; margin: 0 auto; background: white; font-family: 'Inter', sans-serif; }
            .doc-header { display: flex; justify-content: space-between; border-bottom: 2px solid #1a1a1a; padding-bottom: 20px; margin-bottom: 30px; }
            .company-name { font-size: 12px; font-weight: 800; color: #0f172a; }
            .company-tagline { font-size: 11px; color: #64748b; font-style: italic; }
            .contact-details p { display: flex; align-items: center; gap: 6px; font-size: 10px; color: #334155; }
            .doc-type h2 { text-align: right; font-size: 12px; font-weight: 800; color: #0f172a; letter-spacing: 0.05em; }
            .meta-row { display: flex; justify-content: flex-end; gap: 10px; font-size: 11px; }
            .meta-row .label { color: #64748b; font-weight: 500; }
            .meta-row .value { color: #0f172a; font-weight: 700; }
            .status-badge { padding: 1px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
            .status-badge.confirmed { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
            .doc-addresses { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 30px; }
            .address-block h3 { font-size: 10px; font-weight: 800; color: #94a3b8; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 12px; }
            .address-content { font-size: 12px; line-height: 1.6; }
            .address-content strong { display: block; font-size: 14px; margin-bottom: 6px; color: #0f172a; }
            .amount-panel { display: flex; justify-content: space-between; align-items: center; border: 2px solid #22c55e; border-radius: 12px; padding: 24px 28px; margin-bottom: 24px; background: linear-gradient(135deg, #f0fdf4, #dcfce7); }
            .amount-label { font-size: 11px; font-weight: 700; color: #15803d; margin-bottom: 6px; text-transform: uppercase; }
            .amount-value { font-size: 32px; font-weight: 900; color: #166534; }
            .paid-stamp { width: 100px; height: 100px; border-radius: 50%; border: 4px solid #22c55e; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 4px; color: #22c55e; }
            .paid-stamp span { font-size: 12px; font-weight: 900; letter-spacing: 0.1em; }
            .notes-box { padding: 14px 18px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; margin-bottom: 24px; }
            .notes-box h4 { font-size: 10px; font-weight: 700; color: #92400e; text-transform: uppercase; margin: 0 0 8px 0; }
            .notes-box p { font-size: 12px; color: #78350f; line-height: 1.6; margin: 0; }
            .doc-footer { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: auto; padding-top: 30px; }
            .signatures { display: flex; flex-direction: column; gap: 30px; }
            .sig-block { text-align: center; }
            .sig-line { border-bottom: 1.5px solid #1a1a1a; margin-bottom: 8px; height: 40px; }
            .sig-block p { font-size: 11px; font-weight: 700; color: #334155; text-transform: uppercase; margin: 0; }
            .page-footer { margin-top: 30px; padding-top: 16px; border-top: 2px solid #e2e8f0; text-align: center; font-size: 10px; color: #64748b; }
            .page-footer p:first-child { font-weight: 700; color: #334155; margin-bottom: 4px; }
            @media print { body { background: white; } .a4-page { margin: 0; padding: 15mm 20mm; box-shadow: none; } }
        `;
        win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Receipt - ${receipt.receipt_number}</title><style>${printStyles}</style></head><body>${content.outerHTML}</body></html>`);
        win.document.close();
        win.onload = () => {
            win.focus();
            win.print();
        };
    };

    const handleDownload = async () => {
        const content = printRef.current;
        if (!content) return;

        const printStyles = `
            .a4-page { width: 210mm; min-height: 297mm; padding: 15mm 20mm; margin: 0 auto; background: white; font-family: 'Inter', sans-serif; }
            .doc-header { display: flex; justify-content: space-between; border-bottom: 2px solid #1a1a1a; padding-bottom: 20px; margin-bottom: 30px; }
            .company-name { font-size: 12px; font-weight: 800; color: #0f172a; }
            .company-tagline { font-size: 11px; color: #64748b; font-style: italic; }
            .contact-details p { display: flex; align-items: center; gap: 6px; font-size: 10px; color: #334155; }
            .doc-type h2 { text-align: right; font-size: 12px; font-weight: 800; color: #0f172a; letter-spacing: 0.05em; }
            .meta-row { display: flex; justify-content: flex-end; gap: 10px; font-size: 11px; }
            .meta-row .label { color: #64748b; font-weight: 500; }
            .meta-row .value { color: #0f172a; font-weight: 700; }
            .status-badge { padding: 1px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
            .status-badge.confirmed { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
            .doc-addresses { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 30px; }
            .address-block h3 { font-size: 10px; font-weight: 800; color: #94a3b8; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 12px; }
            .address-content { font-size: 12px; line-height: 1.6; }
            .address-content strong { display: block; font-size: 14px; margin-bottom: 6px; color: #0f172a; }
            .amount-panel { display: flex; justify-content: space-between; align-items: center; border: 2px solid #22c55e; border-radius: 12px; padding: 24px 28px; margin-bottom: 24px; background: linear-gradient(135deg, #f0fdf4, #dcfce7); }
            .amount-label { font-size: 11px; font-weight: 700; color: #15803d; margin-bottom: 6px; text-transform: uppercase; }
            .amount-value { font-size: 32px; font-weight: 900; color: #166534; }
            .paid-stamp { width: 100px; height: 100px; border-radius: 50%; border: 4px solid #22c55e; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 4px; color: #22c55e; }
            .paid-stamp span { font-size: 12px; font-weight: 900; letter-spacing: 0.1em; }
            .notes-box { padding: 14px 18px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; margin-bottom: 24px; }
            .notes-box h4 { font-size: 10px; font-weight: 700; color: #92400e; text-transform: uppercase; margin: 0 0 8px 0; }
            .notes-box p { font-size: 12px; color: #78350f; line-height: 1.6; margin: 0; }
            .doc-footer { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: auto; padding-top: 30px; }
            .signatures { display: flex; flex-direction: column; gap: 30px; }
            .sig-block { text-align: center; }
            .sig-line { border-bottom: 1.5px solid #1a1a1a; margin-bottom: 8px; height: 40px; }
            .sig-block p { font-size: 11px; font-weight: 700; color: #334155; text-transform: uppercase; margin: 0; }
            .page-footer { margin-top: 30px; padding-top: 16px; border-top: 2px solid #e2e8f0; text-align: center; font-size: 10px; color: #64748b; }
            .page-footer p:first-child { font-weight: 700; color: #334155; margin-bottom: 4px; }
        `;

        const container = document.createElement('div');
        container.style.cssText = 'position:fixed;left:-9999px;top:0;';
        const styleEl = document.createElement('style');
        styleEl.textContent = printStyles;
        container.appendChild(styleEl);
        container.appendChild(content.cloneNode(true));
        document.body.appendChild(container);

        try {
            const html2pdf = (await import('html2pdf.js')).default;
            await html2pdf()
                .set({
                    margin: 0,
                    filename: `${receipt.receipt_number}.pdf`,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { scale: 2, useCORS: true },
                    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                })
                .from(container.querySelector('.a4-page') as HTMLElement)
                .save();
            toast.success('PDF downloaded!');
        } catch {
            toast.error('Failed to download PDF.');
        } finally {
            document.body.removeChild(container);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Payment Receipt Detail" width={1200} noPadding>
            <div className="a4-document-container">
                {/* Action Bar */}
                <div className="a4-actions no-print">
                    <button onClick={onClose} className="btn-back">
                        <ArrowLeft size={16} /> Back
                    </button>
                    <div className="a4-action-group">
                        <button onClick={handleDownload} className="btn-download">
                            <Download size={16} /> Download PDF
                        </button>
                        <button onClick={handlePrint} className="btn-print">
                            <Printer size={16} /> Print Receipt
                        </button>
                    </div>
                </div>

                {/* A4 Document Preview */}
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
                                    <p><Mail size={12} /> aspeepharma@gmail.com</p>
                                </div>
                            </div>
                            <div className="doc-type">
                                <h2>PAYMENT RECEIPT</h2>
                                <div className="grn-meta">
                                    <div className="meta-row">
                                        <span className="label">Receipt No:</span>
                                        <span className="value">{receipt.receipt_number}</span>
                                    </div>
                                    <div className="meta-row">
                                        <span className="label">Date:</span>
                                        <span className="value">{dateStr}</span>
                                    </div>
                                    <div className="meta-row">
                                        <span className="label">Status:</span>
                                        <span className={`status-badge ${(receipt.status || 'Confirmed').toLowerCase()}`}>{receipt.status || 'Confirmed'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Summary Cards */}
                        <div className="doc-addresses">
                            <div className="address-block">
                                <h3>AMOUNT & PAYMENT</h3>
                                <div className="address-content">
                                    <strong style={{ fontSize: 20, color: '#059669' }}>{amountStr}</strong>
                                    <p><span style={{ color: '#64748b' }}>Method:</span> {receipt.payment_method || '-'}</p>
                                    <p><span style={{ color: '#64748b' }}>Reference:</span> {receipt.payment_reference || 'N/A'}</p>
                                </div>
                            </div>
                            <div className="address-block">
                                <h3>CUSTOMER & INVOICE</h3>
                                <div className="address-content">
                                    <strong>{receipt.customer_name || 'N/A'}</strong>
                                    <p><span style={{ color: '#64748b' }}>Sales Person:</span> {receipt.salesperson_name || 'N/A'}</p>
                                    <p><span style={{ color: '#64748b' }}>Invoice Ref:</span> {receipt.invoice_number || 'N/A'}</p>
                                    <p><span style={{ color: '#64748b' }}>Currency:</span> {receipt.currency || 'GHS'}</p>
                                </div>
                            </div>
                        </div>

                        {/* Amount Panel - Highlighted */}
                        <div className="amount-panel">
                            <div>
                                <div className="amount-label">Amount Received</div>
                                <div className="amount-value">{amountStr}</div>
                            </div>
                            <div className="paid-stamp">
                                <CheckCircle size={28} />
                                <span>PAID</span>
                            </div>
                        </div>

                        {/* Notes */}
                        {receipt.notes && (
                            <div className="notes-box">
                                <h4>Notes & Remarks</h4>
                                <p>{receipt.notes}</p>
                            </div>
                        )}

                        {/* Signatures */}
                        <div className="doc-footer">
                            <div className="notes-box" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                <h4 style={{ color: '#334155' }}>Payment Details</h4>
                                <ul style={{ margin: 0, paddingLeft: 16, color: '#475569', fontSize: 11, lineHeight: 1.8 }}>
                                    <li>Receipt Number: <strong>{receipt.receipt_number}</strong></li>
                                    <li>Payment Date: <strong>{dateStr}</strong></li>
                                    <li>Payment Method: <strong>{receipt.payment_method || 'N/A'}</strong></li>
                                    {receipt.payment_reference && <li>Reference: <strong>{receipt.payment_reference}</strong></li>}
                                </ul>
                            </div>
                            <div className="signatures">
                                <div className="sig-block">
                                    <div className="sig-line"></div>
                                    <p>Received By</p>
                                </div>
                                <div className="sig-block">
                                    <div className="sig-line"></div>
                                    <p>Authorised By</p>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="page-footer">
                            <p>ASPEE PHARMACEUTICALS LTD — Official Payment Receipt</p>
                            <p>Generated on {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                .a4-document-container {
                    background: var(--slate-100);
                    min-height: calc(100vh - 120px);
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
                .btn-download:hover {
                    background: var(--primary-50);
                }
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
                    background: #cbd5e1;
                }
                .a4-page {
                    width: 210mm;
                    min-height: 297mm;
                    background: white;
                    padding: 15mm 20mm;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.15);
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
                .company-name {
                    font-size: 12px;
                    font-weight: 800;
                    margin: 0;
                    color: #0f172a;
                }
                .company-tagline {
                    font-size: 11px;
                    color: #64748b;
                    font-style: italic;
                    margin: 2px 0 8px 0;
                }
                .contact-details p {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 10px;
                    margin: 3px 0;
                    color: #334155;
                }
                .doc-type h2 {
                    text-align: right;
                    font-size: 12px;
                    font-weight: 800;
                    margin: 0 0 12px 0;
                    letter-spacing: 0.05em;
                    color: #0f172a;
                }
                .grn-meta {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                .meta-row {
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                    font-size: 11px;
                }
                .meta-row .label {
                    color: #64748b;
                    font-weight: 500;
                }
                .meta-row .value {
                    color: #0f172a;
                    font-weight: 700;
                }
                .status-badge {
                    padding: 1px 8px;
                    border-radius: 4px;
                    font-size: 10px;
                    font-weight: 700;
                    text-transform: uppercase;
                }
                .status-badge.confirmed, .status-badge.completed {
                    background: #dcfce7;
                    color: #166534;
                    border: 1px solid #bbf7d0;
                }
                .status-badge.pending {
                    background: #fef3c7;
                    color: #92400e;
                    border: 1px solid #fde68a;
                }
                .doc-addresses {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 40px;
                    margin-bottom: 30px;
                }
                .address-block h3 {
                    font-size: 10px;
                    font-weight: 800;
                    color: #94a3b8;
                    border-bottom: 1px solid #e2e8f0;
                    padding-bottom: 6px;
                    margin-bottom: 12px;
                    letter-spacing: 0.05em;
                }
                .address-content {
                    font-size: 12px;
                    line-height: 1.6;
                }
                .address-content strong {
                    display: block;
                    font-size: 14px;
                    margin-bottom: 6px;
                    color: #0f172a;
                }
                .address-content p {
                    margin: 3px 0;
                    color: #334155;
                }
                .amount-panel {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border: 2px solid #22c55e;
                    border-radius: 12px;
                    padding: 24px 28px;
                    margin-bottom: 24px;
                    background: linear-gradient(135deg, #f0fdf4, #dcfce7);
                }
                .amount-label {
                    font-size: 11px;
                    font-weight: 700;
                    color: #15803d;
                    margin-bottom: 6px;
                    text-transform: uppercase;
                    letter-spacing: 0.06em;
                }
                .amount-value {
                    font-size: 32px;
                    font-weight: 900;
                    color: #166534;
                    letter-spacing: -0.03em;
                }
                .paid-stamp {
                    width: 100px;
                    height: 100px;
                    border-radius: 50%;
                    border: 4px solid #22c55e;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-direction: column;
                    gap: 4px;
                    color: #22c55e;
                }
                .paid-stamp span {
                    font-size: 12px;
                    font-weight: 900;
                    letter-spacing: 0.1em;
                }
                .notes-box {
                    padding: 14px 18px;
                    background: #fffbeb;
                    border: 1px solid #fde68a;
                    border-radius: 10px;
                    margin-bottom: 24px;
                }
                .notes-box h4 {
                    font-size: 10px;
                    font-weight: 700;
                    color: #92400e;
                    letter-spacing: 0.06em;
                    text-transform: uppercase;
                    margin: 0 0 8px 0;
                }
                .notes-box p {
                    font-size: 12px;
                    color: #78350f;
                    line-height: 1.6;
                    margin: 0;
                }
                .doc-footer {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 40px;
                    margin-top: auto;
                    padding-top: 30px;
                }
                .signatures {
                    display: flex;
                    flex-direction: column;
                    gap: 30px;
                }
                .sig-block {
                    text-align: center;
                }
                .sig-line {
                    border-bottom: 1.5px solid #1a1a1a;
                    margin-bottom: 8px;
                    height: 40px;
                }
                .sig-block p {
                    font-size: 11px;
                    font-weight: 700;
                    color: #334155;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    margin: 0;
                }
                .page-footer {
                    margin-top: 30px;
                    padding-top: 16px;
                    border-top: 2px solid #e2e8f0;
                    text-align: center;
                    font-size: 10px;
                    color: #64748b;
                }
                .page-footer p:first-child {
                    font-weight: 700;
                    color: #334155;
                    margin-bottom: 4px;
                }
            `}</style>
        </Modal>
    );
}
