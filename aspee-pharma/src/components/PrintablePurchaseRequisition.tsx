'use client';

import React, { useEffect, useRef, useState } from 'react';
import Modal from './Modal';
import { ArrowLeft, Download, Mail, MapPin, Phone, Printer } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface PrintablePurchaseRequisitionProps {
    isOpen: boolean;
    onClose: () => void;
    request: any;
}

const docStyles = `
    @page { size: A4; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
        font-family: 'Segoe UI', 'Inter', -apple-system, sans-serif;
        color: #1a1a1a;
        background: white;
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
        background: white;
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
    .doc-type h2 { text-align: right; font-size: 11px; font-weight: 800; margin: 0 0 12px 0; letter-spacing: 0.1em; color: #0f172a; }
    .po-meta { display: flex; flex-direction: column; gap: 4px; }
    .meta-row { display: flex; justify-content: flex-end; gap: 10px; font-size: 11px; }
    .meta-row .label { color: #64748b; font-weight: 500; }
    .meta-row .value { color: #0f172a; font-weight: 700; }
    .status-badge { padding: 1px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
    .status-badge.pending { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
    .status-badge.approved { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
    .status-badge.rejected { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
    .priority-badge { padding: 1px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
    .priority-badge.urgent { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
    .priority-badge.high { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
    .priority-badge.normal { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }
    .doc-addresses { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; margin-bottom: 36px; }
    .address-block h3 { font-size: 11px; font-weight: 800; color: #94a3b8; border-bottom: 1px solid #eee; padding-bottom: 6px; margin-bottom: 12px; letter-spacing: 0.05em; }
    .address-content { font-size: 11px; line-height: 1.6; }
    .address-content strong { display: block; font-size: 11px; margin-bottom: 4px; color: #0f172a; }
    .address-content p { margin: 1px 0; color: #334155; }
    .items-table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
    .items-table th { background: #f8fafc; padding: 10px 10px; text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #334155; border-top: 1.5px solid #1a1a1a; border-bottom: 1.5px solid #1a1a1a; }
    .items-table td { padding: 10px 10px; border-bottom: 1px solid #eee; font-size: 11px; vertical-align: top; }
    .items-table tbody tr:last-child td { border-bottom: 1.5px solid #1a1a1a; }
    .item-name { font-weight: 600; color: #0f172a; }
    .item-sku { font-size: 10px; color: #64748b; margin-top: 1px; }
    .item-purpose { font-size: 10px; color: #64748b; font-style: italic; margin-top: 2px; }
    .notes-section { margin-bottom: 32px; }
    .notes-section h4 { font-size: 11px; font-weight: 800; margin-bottom: 8px; color: #1e293b; text-transform: uppercase; border-bottom: 1px solid #eee; padding-bottom: 6px; }
    .notes-section p { font-size: 11px; color: #475569; line-height: 1.6; padding: 10px; background: #f8fafc; border-radius: 4px; }
    .doc-footer { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 40px; margin-top: auto; padding-top: 40px; }
    .sig-block { text-align: center; }
    .sig-line { border-bottom: 1px solid #1a1a1a; margin-bottom: 6px; height: 32px; }
    .sig-block p { font-size: 11px; font-weight: 700; color: #334155; text-transform: uppercase; }
    .page-footer { margin-top: 40px; padding-top: 15px; border-top: 1px solid #eee; text-align: center; font-size: 11px; color: #94a3b8; }
`;

export default function PrintablePurchaseRequisition({ isOpen, onClose, request }: PrintablePurchaseRequisitionProps) {
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const printRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen && request?.id) {
            fetchItems();
        }
    }, [isOpen, request]);

    const fetchItems = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('purchase_request_items')
                .select('*, product:products(name, sku, unit)')
                .eq('request_id', request.id);
            if (error) throw error;
            setItems(data || []);
        } catch (err: any) {
            toast.error('Failed to load requisition items: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const getClonedContent = () => {
        const el = printRef.current;
        if (!el) return null;
        const cloned = el.cloneNode(true) as HTMLElement;
        el.querySelectorAll('svg').forEach((svg, i) => {
            cloned.querySelectorAll('svg')[i]?.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        });
        return cloned;
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
                    filename: `${request.request_number}.pdf`,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { scale: 2, useCORS: true, letterRendering: true },
                    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                })
                .from(content)
                .save();
            toast.success('PDF downloaded successfully!');
        } catch {
            toast.error('Failed to download PDF. Please try again.');
        } finally {
            document.body.removeChild(container);
        }
    };

    const openPrintWindow = () => {
        const content = getClonedContent();
        if (!content) return;

        const win = window.open('', '_blank', 'width=900,height=700');
        if (!win) { toast.error('Please allow pop-ups to print.'); return; }

        win.document.write(`<!DOCTYPE html><html><head>
            <meta charset="utf-8">
            <title>Purchase Requisition - ${request.request_number}</title>
            <style>${docStyles}
                @media print { body { background: white; } .a4-page { margin: 0; padding: 15mm 20mm; min-height: 297mm; } }
            </style>
        </head><body>${content.outerHTML}</body></html>`);
        win.document.close();
        win.onload = () => { win.focus(); win.print(); };
    };

    const priorityClass = (p: string) =>
        p === 'Urgent' ? 'urgent' : p === 'High' ? 'high' : 'normal';

    if (!request) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Purchase Requisition" width={1000} noPadding>
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
                            <Printer size={16} /> Print
                        </button>
                    </div>
                </div>

                <div className="a4-preview-scroller">
                    <div className="a4-page" ref={printRef}>
                        <style dangerouslySetInnerHTML={{ __html: docStyles }} />

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
                                <h2>PURCHASE REQUISITION</h2>
                                <div className="po-meta">
                                    <div className="meta-row">
                                        <span className="label">Request #:</span>
                                        <span className="value">{request.request_number}</span>
                                    </div>
                                    <div className="meta-row">
                                        <span className="label">Date:</span>
                                        <span className="value">
                                            {new Date(request.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </span>
                                    </div>
                                    <div className="meta-row">
                                        <span className="label">Priority:</span>
                                        <span className={`priority-badge ${priorityClass(request.priority)}`}>{request.priority}</span>
                                    </div>
                                    <div className="meta-row">
                                        <span className="label">Status:</span>
                                        <span className={`status-badge ${request.status?.toLowerCase()}`}>{request.status}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Requester / Deliver To */}
                        <div className="doc-addresses">
                            <div className="address-block">
                                <h3>REQUESTED BY</h3>
                                <div className="address-content">
                                    <strong>{request.requester?.name || 'Unknown'}</strong>
                                    <p>Department: Stores</p>
                                    <p>Aspee Pharmaceuticals Ltd</p>
                                    <p>Ejisu - Asamang</p>
                                </div>
                            </div>
                            <div className="address-block">
                                <h3>DELIVER TO</h3>
                                <div className="address-content">
                                    <strong>Purchasing Department</strong>
                                    <p>Aspee Pharmaceuticals Ltd</p>
                                    <p>Ejisu - Asamang</p>
                                    <p>Phone: 0244791052</p>
                                </div>
                            </div>
                        </div>

                        {/* Items Table */}
                        {loading ? (
                            <p style={{ fontSize: 12, color: '#64748b', textAlign: 'center', padding: '20px 0' }}>Loading items…</p>
                        ) : (
                            <table className="items-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: 32 }}>#</th>
                                        <th>Material / Item Description</th>
                                        <th style={{ width: 70, textAlign: 'right' }}>Qty</th>
                                        <th style={{ width: 70 }}>Unit</th>
                                        <th style={{ width: 120, textAlign: 'right' }}>Last Unit Price</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item, idx) => (
                                        <tr key={idx}>
                                            <td>{idx + 1}</td>
                                            <td>
                                                <div className="item-name">{item.product?.name || '—'}</div>
                                                <div className="item-sku">{item.product?.sku}</div>
                                                {item.purpose && <div className="item-purpose">Purpose: {item.purpose}</div>}
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: 700 }}>{Number(item.quantity).toLocaleString()}</td>
                                            <td>{item.unit || item.product?.unit || '—'}</td>
                                            <td style={{ textAlign: 'right' }}>
                                                {item.last_purchase_price
                                                    ? `GH₵ ${Number(item.last_purchase_price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                                    : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}

                        {/* Notes */}
                        {request.notes && (
                            <div className="notes-section">
                                <h4>Notes / Justification</h4>
                                <p>{request.notes}</p>
                            </div>
                        )}

                        {/* Signature Block */}
                        <div className="doc-footer">
                            <div className="sig-block">
                                <div className="sig-line" />
                                <p>Requested By</p>
                            </div>
                            <div className="sig-block">
                                <div className="sig-line" />
                                <p>Reviewed By (Stores)</p>
                            </div>
                            <div className="sig-block">
                                <div className="sig-line" />
                                <p>Approved By (Purchasing)</p>
                            </div>
                        </div>

                        <div className="page-footer">
                            <p>This is a computer generated document. Aspee Pharmaceuticals Ltd — Delivering Precision in Medicine</p>
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
