'use client';

import React, { useRef } from 'react';
import Modal from './Modal';
import { formatCurrency } from '@/lib/formatCurrency';
import { Printer, Download, ArrowLeft, MapPin, Phone, Mail } from 'lucide-react';

interface InvoiceViewModalProps {
    isOpen: boolean;
    onClose: () => void;
    invoice: any;
}

const docStyles = `
    @page { size: A4; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
        font-family: 'Segoe UI', 'Inter', -apple-system, sans-serif;
        color: #1a1a1a;
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
        background: #fff;
    }
    .doc-header { display: flex; justify-content: space-between; border-bottom: 2px solid #1a1a1a; padding-bottom: 20px; margin-bottom: 30px; }
    .company-name { font-size: 16px; font-weight: 800; margin: 0; letter-spacing: -0.02em; color: #0f172a; }
    .company-tagline { font-size: 11px; color: #64748b; font-style: italic; margin: 2px 0 10px 0; }
    .contact-details p { display: flex; align-items: center; gap: 6px; font-size: 11px; margin: 3px 0; color: #334155; }
    .doc-type h2 { text-align: right; font-size: 22px; font-weight: 800; margin: 0 0 12px 0; letter-spacing: 0.05em; color: #0f172a; }
    .meta-row { display: flex; justify-content: flex-end; gap: 10px; font-size: 11px; margin: 3px 0; }
    .meta-row .label { color: #64748b; font-weight: 500; }
    .meta-row .value { color: #0f172a; font-weight: 700; font-family: 'Courier New', monospace; }
    .status-badge { padding: 2px 10px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; display: inline-block; }
    .status-paid { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
    .status-issued { background: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; }
    .status-draft { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }
    .status-overdue { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
    .status-partiallypaid { background: #fefce8; color: #854d0e; border: 1px solid #fef08a; }
    .type-badge { padding: 2px 10px; border-radius: 4px; font-size: 11px; font-weight: 700; display: inline-block; margin-top: 4px; }
    .type-cash { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
    .type-credit { background: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; }
    .doc-addresses { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; margin-bottom: 30px; }
    .address-block h3 { font-size: 10px; font-weight: 800; color: #94a3b8; border-bottom: 1px solid #eee; padding-bottom: 6px; margin-bottom: 10px; letter-spacing: 0.08em; text-transform: uppercase; }
    .address-content strong { display: block; font-size: 13px; font-weight: 700; margin-bottom: 4px; color: #0f172a; }
    .address-content p { margin: 2px 0; font-size: 11px; color: #334155; }
    .items-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    .items-table th { background: #f8fafc; padding: 10px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; color: #334155; border-top: 1.5px solid #1a1a1a; border-bottom: 1.5px solid #1a1a1a; letter-spacing: 0.04em; }
    .items-table td { padding: 11px 10px; border-bottom: 1px solid #f1f5f9; font-size: 11px; vertical-align: top; }
    .items-table tbody tr:last-child td { border-bottom: 1.5px solid #1a1a1a; }
    .item-name { font-weight: 600; color: #0f172a; font-size: 12px; }
    .item-sku { font-size: 10px; color: #64748b; margin-top: 2px; font-family: 'Courier New', monospace; }
    .item-batch { font-size: 10px; color: #475569; margin-top: 1px; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .summary-section { display: flex; justify-content: flex-end; margin-bottom: 30px; }
    .summary-box { width: 260px; }
    .summary-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 11px; border-bottom: 1px solid #f1f5f9; }
    .summary-row .s-label { color: #64748b; }
    .summary-row .s-value { font-weight: 600; color: #0f172a; }
    .grand-total { display: flex; justify-content: space-between; padding: 10px 0; border-top: 2px solid #1a1a1a; margin-top: 4px; }
    .grand-total .s-label { font-size: 14px; font-weight: 800; color: #0f172a; }
    .grand-total .s-value { font-size: 16px; font-weight: 800; color: #0369a1; }
    .notes-section { padding: 14px 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 30px; }
    .notes-section h4 { font-size: 10px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 6px; }
    .notes-section p { font-size: 11px; color: #334155; line-height: 1.6; }
    .doc-footer { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 30px; margin-top: auto; padding-top: 40px; }
    .sig-block { text-align: center; }
    .sig-line { border-bottom: 1px solid #1a1a1a; height: 40px; margin-bottom: 6px; }
    .sig-block p { font-size: 10px; font-weight: 700; color: #334155; text-transform: uppercase; letter-spacing: 0.05em; }
    .page-footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #eee; text-align: center; font-size: 10px; color: #94a3b8; }
    @media print {
        body { background: #fff; }
        .a4-page { margin: 0; padding: 15mm 20mm; min-height: 297mm; }
    }
`;

export default function InvoiceViewModal({ isOpen, onClose, invoice }: InvoiceViewModalProps) {
    const printRef = useRef<HTMLDivElement>(null);

    if (!invoice) return null;

    const items = invoice.items ?? [];
    const hasDiscounts = items.some((item: any) => Number(item.discount_pct || 0) > 0 || Number(item.discount_amount || 0) > 0);
    const netSubtotal = items.reduce((sum: number, item: any) => sum + Number(item.total_price || 0), 0);
    const taxAmount = Number(invoice.tax_amount || 0);
    const discountAmount = Number(invoice.total_discount || invoice.discount_amount || 0);
    const grossSubtotal = netSubtotal + discountAmount;
    const total = Number(invoice.total_amount || netSubtotal);

    const statusClass = `status-${(invoice.status || 'draft').toLowerCase().replace(/\s+/g, '')}`;
    const typeClass = invoice.type === 'Cash Sale' ? 'type-cash' : 'type-credit';

    const getClonedContent = () => {
        const el = printRef.current;
        if (!el) return null;
        const clone = el.cloneNode(true) as HTMLElement;
        el.querySelectorAll('svg').forEach((svg, i) => {
            const clonedSvg = clone.querySelectorAll('svg')[i];
            if (clonedSvg) clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        });
        return clone;
    };

    const handleDownloadPDF = async () => {
        const content = getClonedContent();
        if (!content) return;
        const container = document.createElement('div');
        container.style.cssText = 'position:fixed;left:-9999px;top:0;';
        const style = document.createElement('style');
        style.textContent = docStyles;
        container.appendChild(style);
        container.appendChild(content);
        document.body.appendChild(container);
        try {
            const html2pdf = (await import('html2pdf.js')).default;
            await html2pdf()
                .set({
                    margin: 0,
                    filename: `${invoice.invoice_number}.pdf`,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { scale: 2, useCORS: true },
                    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                })
                .from(content)
                .save();
        } finally {
            document.body.removeChild(container);
        }
    };

    const openPrintWindow = () => {
        const content = getClonedContent();
        if (!content) return;
        const win = window.open('', '_blank', 'width=900,height=700');
        if (!win) return;
        win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice ${invoice.invoice_number}</title><style>${docStyles}</style></head><body>${content.outerHTML}</body></html>`);
        win.document.close();
        win.onload = () => { win.focus(); win.print(); };
    };

    const fmt = (v: any) => formatCurrency(v, invoice.currency);
    const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Invoice Detail" width={1200} noPadding>
            <div className="a4-document-container">
                {/* Toolbar */}
                <div className="a4-actions no-print">
                    <button onClick={onClose} className="btn-back">
                        <ArrowLeft size={16} /> Back
                    </button>
                    <div className="a4-action-group">
                        <button onClick={handleDownloadPDF} className="btn-download">
                            <Download size={16} /> Download PDF
                        </button>
                        <button onClick={openPrintWindow} className="btn-print">
                            <Printer size={16} /> Print Invoice
                        </button>
                    </div>
                </div>

                {/* A4 Page */}
                <div className="a4-preview-scroller">
                    <div className="a4-page" ref={printRef}>
                        {/* Scoped styles for on-screen rendering */}
                        <style dangerouslySetInnerHTML={{ __html: docStyles }} />

                        {/* ── Company Header ── */}
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
                                <h2>SALES INVOICE</h2>
                                <div>
                                    <div className="meta-row">
                                        <span className="label">Invoice No:</span>
                                        <span className="value">{invoice.invoice_number}</span>
                                    </div>
                                    <div className="meta-row">
                                        <span className="label">Date:</span>
                                        <span className="value">{fmtDate(invoice.date)}</span>
                                    </div>
                                    {invoice.due_date && (
                                        <div className="meta-row">
                                            <span className="label">Due Date:</span>
                                            <span className="value">{fmtDate(invoice.due_date)}</span>
                                        </div>
                                    )}
                                    <div className="meta-row" style={{ marginTop: 6 }}>
                                        <span className={`status-badge ${statusClass}`}>{invoice.status}</span>
                                    </div>
                                    <div className="meta-row">
                                        <span className={`type-badge ${typeClass}`}>{invoice.type || 'Invoice'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── Bill To / From ── */}
                        <div className="doc-addresses">
                            <div className="address-block">
                                <h3>Bill To</h3>
                                <div className="address-content">
                                    <strong>{invoice.customer_name || '—'}</strong>
                                    {invoice.route && <p>Route: {invoice.route}</p>}
                                </div>
                            </div>
                            <div className="address-block">
                                <h3>From</h3>
                                <div className="address-content">
                                    <strong>ASPEE PHARMACEUTICALS LTD</strong>
                                    <p>Sales Department</p>
                                    <p>Ejisu - Asamang</p>
                                    <p>Phone: 0244791052</p>
                                </div>
                            </div>
                        </div>

                        {/* ── Line Items ── */}
                        <table className="items-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 36 }}>#</th>
                                    <th>Product Description</th>
                                    <th style={{ width: 60, textAlign: 'center' }}>Qty</th>
                                    <th style={{ width: 110, textAlign: 'right' }}>Unit Price</th>
                                    {hasDiscounts && <th style={{ width: 100, textAlign: 'right' }}>Discount</th>}
                                    <th style={{ width: 120, textAlign: 'right' }}>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} style={{ textAlign: 'center', color: '#94a3b8', padding: 24 }}>No line items</td>
                                    </tr>
                                ) : items.map((item: any, i: number) => (
                                    <tr key={item.id ?? i}>
                                        <td>{i + 1}</td>
                                        <td>
                                            <div className="item-name">{item.product?.name ?? item.product_name ?? '—'}</div>
                                            {item.product?.sku && <div className="item-sku">SKU: {item.product.sku}</div>}
                                            {item.batch_number && <div className="item-batch">Batch: {item.batch_number}</div>}
                                        </td>
                                        <td className="text-center" style={{ fontWeight: 600 }}>{item.quantity}</td>
                                        <td className="text-right">{fmt(item.unit_price)}</td>
                                        {hasDiscounts && (
                                            <td className="text-right" style={{ color: '#16a34a' }}>
                                                {Number(item.discount_pct || 0) > 0
                                                    ? `${Number(item.discount_pct).toFixed(1)}% (−${fmt(item.discount_amount || 0)})`
                                                    : '—'}
                                            </td>
                                        )}
                                        <td className="text-right" style={{ fontWeight: 700 }}>{fmt(item.total_price)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* ── Totals ── */}
                        <div className="summary-section">
                            <div className="summary-box">
                                <div className="summary-row">
                                    <span className="s-label">{discountAmount > 0 ? 'Gross Subtotal' : 'Subtotal'}</span>
                                    <span className="s-value">{fmt(discountAmount > 0 ? grossSubtotal : netSubtotal)}</span>
                                </div>
                                {discountAmount > 0 && (
                                    <div className="summary-row">
                                        <span className="s-label">Discount</span>
                                        <span className="s-value" style={{ color: '#16a34a' }}>− {fmt(discountAmount)}</span>
                                    </div>
                                )}
                                {taxAmount > 0 && (
                                    <div className="summary-row">
                                        <span className="s-label">Tax / VAT</span>
                                        <span className="s-value">{fmt(taxAmount)}</span>
                                    </div>
                                )}
                                <div className="grand-total">
                                    <span className="s-label">TOTAL</span>
                                    <span className="s-value">{fmt(total)}</span>
                                </div>
                            </div>
                        </div>

                        {/* ── Notes ── */}
                        {invoice.notes && (
                            <div className="notes-section">
                                <h4>Notes</h4>
                                <p>{invoice.notes}</p>
                            </div>
                        )}

                        {/* ── Signatures ── */}
                        <div className="doc-footer">
                            <div className="sig-block">
                                <div className="sig-line" />
                                <p>Prepared By</p>
                            </div>
                            <div className="sig-block">
                                <div className="sig-line" />
                                <p>Authorised By</p>
                            </div>
                            <div className="sig-block">
                                <div className="sig-line" />
                                <p>Received By</p>
                            </div>
                        </div>

                        {/* ── Page Footer ── */}
                        <div className="page-footer">
                            This is a computer-generated invoice. — ASPEE PHARMACEUTICALS LTD | aspeepharmaceuticalsgh@gmail.com
                        </div>

                    </div>
                </div>
            </div>
        </Modal>
    );
}
