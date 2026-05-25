'use client';

import React, { useState, useEffect, useRef } from 'react';
import Modal from './Modal';
import { 
    Eye, 
    Download, 
    Printer, 
    ArrowLeft,
    ShieldCheck,
    User,
    Calendar,
    Package,
    FileText,
    CheckCircle,
    XCircle,
    AlertTriangle
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface QAFinishedProductsViewModalProps {
    isOpen: boolean;
    onClose: () => void;
    record: any;
    onSuccess?: () => void;
}

export default function QAFinishedProductsViewModal({ isOpen, onClose, record, onSuccess }: QAFinishedProductsViewModalProps) {
    const [loading, setLoading] = useState(false);
    const [productionOrder, setProductionOrder] = useState<any>(null);
    const printRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen && record?.production_order_id) {
            fetchProductionOrder();
        }
    }, [isOpen, record]);

    const fetchProductionOrder = async () => {
        try {
            const { data, error } = await supabase
                .from('production_orders')
                .select('*, product:products(name, sku, unit)')
                .eq('id', record.production_order_id)
                .single();
            
            if (data) setProductionOrder(data);
        } catch (error) {
            console.error('Error fetching production order:', error);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Passed': return { bg: '#dcfce7', text: '#166534', border: '#bbf7d0' };
            case 'Failed': return { bg: '#fee2e2', text: '#991b1b', border: '#fecaca' };
            case 'Quarantine': return { bg: '#fef3c7', text: '#92400e', border: '#fde68a' };
            default: return { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' };
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'Passed': return <CheckCircle size={16} />;
            case 'Failed': return <XCircle size={16} />;
            case 'Quarantine': return <AlertTriangle size={16} />;
            default: return <FileText size={16} />;
        }
    };

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
        .qa-meta { display: flex; flex-direction: column; gap: 4px; }
        .meta-row { display: flex; justify-content: flex-end; gap: 10px; font-size: 11px; }
        .meta-row .label { color: #64748b; font-weight: 500; }
        .meta-row .value { color: #0f172a; font-weight: 700; }
        .status-badge { 
            display: inline-flex; 
            align-items: center; 
            gap: 4px;
            padding: 2px 10px; 
            border-radius: 4px; 
            font-size: 11px; 
            font-weight: 700; 
            text-transform: uppercase; 
        }
        .doc-section { margin-bottom: 25px; }
        .section-title { 
            font-size: 10px; 
            font-weight: 800; 
            color: #64748b; 
            border-bottom: 1px solid #e2e8f0; 
            padding-bottom: 6px; 
            margin-bottom: 12px; 
            letter-spacing: 0.05em;
            text-transform: uppercase;
        }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .info-item { display: flex; flex-direction: column; gap: 2px; }
        .info-label { font-size: 10px; color: #64748b; font-weight: 500; }
        .info-value { font-size: 12px; color: #0f172a; font-weight: 600; }
        .remarks-box { 
            background: #f8fafc; 
            border: 1px solid #e2e8f0; 
            border-radius: 6px; 
            padding: 12px; 
            font-size: 11px; 
            line-height: 1.5;
            color: #334155;
        }
        .tests-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        .tests-table th { 
            background: #f8fafc; 
            padding: 8px 10px; 
            text-align: left; 
            font-size: 10px; 
            font-weight: 700; 
            text-transform: uppercase; 
            color: #64748b; 
            border-bottom: 1px solid #e2e8f0; 
        }
        .tests-table td { 
            padding: 8px 10px; 
            border-bottom: 1px solid #f1f5f9; 
            font-size: 11px; 
        }
        .doc-footer { 
            margin-top: auto; 
            padding-top: 20px; 
            border-top: 1px solid #e2e8f0; 
            display: flex; 
            justify-content: space-between;
        }
        .signatures { display: flex; gap: 40px; }
        .sig-block { text-align: center; }
        .sig-line { border-bottom: 1px solid #1a1a1a; margin-bottom: 6px; width: 120px; }
        .sig-block p { font-size: 10px; font-weight: 700; color: #475569; text-transform: uppercase; }
        .page-footer { 
            margin-top: 30px; 
            padding-top: 10px; 
            border-top: 1px solid #f1f5f9; 
            text-align: center; 
            font-size: 10px; 
            color: #94a3b8; 
        }
    `;

    const getClonedContent = () => {
        const printContent = printRef.current;
        if (!printContent) return null;

        const clonedContent = printContent.cloneNode(true) as HTMLElement;
        const originalSvgs = printContent.querySelectorAll('svg');
        const clonedSvgs = clonedContent.querySelectorAll('svg');
        originalSvgs.forEach((svg, i) => {
            if (clonedSvgs[i]) {
                clonedSvgs[i].setAttribute('xmlns', 'http://www.w3.org/2000/svg');
            }
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
        styleEl.textContent = docStyles;
        container.appendChild(styleEl);
        container.appendChild(clonedContent);
        document.body.appendChild(container);

        try {
            const html2pdf = (await import('html2pdf.js')).default;
            await html2pdf()
                .set({
                    margin: 0,
                    filename: `QA-Finished-Product-${record.batch_number}.pdf`,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { scale: 2, useCORS: true, letterRendering: true },
                    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                })
                .from(clonedContent)
                .save();
            toast.success('PDF downloaded successfully!');
        } catch (error) {
            console.error('PDF download failed:', error);
            toast.error('Failed to download PDF. Please try again.');
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
    <title>QA Finished Product Analysis - ${record.batch_number}</title>
    <style>${docStyles}</style>
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

    if (!record) return null;

    const statusColors = getStatusColor(record.overall_status);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Finished Product Analysis"
            width={1000}
            noPadding
        >
            <div className="a4-document-container">
                <div className="a4-actions no-print" style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '12px 20px', borderBottom: '1px solid var(--slate-200)',
                    background: 'var(--slate-50)'
                }}>
                    <button onClick={onClose} className="btn-back" style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                        borderRadius: 6, border: '1px solid var(--slate-200)', background: 'white',
                        fontSize: 12, fontWeight: 500, cursor: 'pointer'
                    }}>
                        <ArrowLeft size={14} /> Back
                    </button>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={handleDownloadPDF} style={{
                            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                            borderRadius: 6, border: 'none', background: 'var(--primary-600)',
                            color: 'white', fontSize: 12, fontWeight: 500, cursor: 'pointer'
                        }}>
                            <Download size={14} /> Download PDF
                        </button>
                        <button onClick={openPrintWindow} style={{
                            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                            borderRadius: 6, border: '1px solid var(--slate-200)', background: 'white',
                            fontSize: 12, fontWeight: 500, cursor: 'pointer'
                        }}>
                            <Printer size={14} /> Print
                        </button>
                    </div>
                </div>

                <div className="a4-preview-scroller" style={{
                    overflow: 'auto', maxHeight: 'calc(100vh - 200px)',
                    background: 'var(--slate-100)', padding: 20
                }}>
                    <div className="a4-page" ref={printRef}>
                        <style dangerouslySetInnerHTML={{ __html: docStyles }} />

                        {/* Header */}
                        <div className="doc-header">
                            <div>
                                <h1 className="company-name">ASPEE PHARMACEUTICALS LTD</h1>
                                <p className="company-tagline">Quality Healthcare for All</p>
                                <div className="contact-details">
                                    <p><Package size={12} /> Ejisu - Asamang</p>
                                    <p><ShieldCheck size={12} /> Quality Assurance Department</p>
                                </div>
                            </div>
                            <div className="doc-type">
                                <h2>FINISHED PRODUCT ANALYSIS</h2>
                                <div className="qa-meta">
                                    <div className="meta-row">
                                        <span className="label">Batch No.:</span>
                                        <span className="value">{record.batch_number || 'N/A'}</span>
                                    </div>
                                    <div className="meta-row">
                                        <span className="label">Analysis Date:</span>
                                        <span className="value">{record.analysis_date ? new Date(record.analysis_date).toLocaleDateString('en-GB') : 'N/A'}</span>
                                    </div>
                                    <div className="meta-row">
                                        <span className="label">Status:</span>
                                        <span className="value">
                                            <span className="status-badge" style={{ background: statusColors.bg, color: statusColors.text, border: `1px solid ${statusColors.border}` }}>
                                                {getStatusIcon(record.overall_status)}
                                                {record.overall_status}
                                            </span>
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Product Info */}
                        <div className="doc-section">
                            <h3 className="section-title">Product Information</h3>
                            <div className="info-grid">
                                <div className="info-item">
                                    <span className="info-label">Product Name</span>
                                    <span className="info-value">{record.product_name || 'N/A'}</span>
                                </div>
                                <div className="info-item">
                                    <span className="info-label">Production Order</span>
                                    <span className="info-value">{productionOrder?.order_number || record.production_order_id || 'N/A'}</span>
                                </div>
                                <div className="info-item">
                                    <span className="info-label">Batch Number</span>
                                    <span className="info-value">{record.batch_number || 'N/A'}</span>
                                </div>
                                <div className="info-item">
                                    <span className="info-label">Product SKU</span>
                                    <span className="info-value">{productionOrder?.product?.sku || 'N/A'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Analysis Details */}
                        <div className="doc-section">
                            <h3 className="section-title">Analysis Details</h3>
                            <div className="info-grid">
                                <div className="info-item">
                                    <span className="info-label">Analyst</span>
                                    <span className="info-value">{record.analyst || 'N/A'}</span>
                                </div>
                                <div className="info-item">
                                    <span className="info-label">Analysis Date</span>
                                    <span className="info-value">{record.analysis_date ? new Date(record.analysis_date).toLocaleDateString('en-GB') : 'N/A'}</span>
                                </div>
                                <div className="info-item">
                                    <span className="info-label">Release Date</span>
                                    <span className="info-value">{record.release_date ? new Date(record.release_date).toLocaleDateString('en-GB') : 'Pending'}</span>
                                </div>
                                <div className="info-item">
                                    <span className="info-label">Overall Status</span>
                                    <span className="info-value">
                                        <span className="status-badge" style={{ background: statusColors.bg, color: statusColors.text, border: `1px solid ${statusColors.border}` }}>
                                            {getStatusIcon(record.overall_status)}
                                            {record.overall_status}
                                        </span>
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Tests Performed */}
                        <div className="doc-section">
                            <h3 className="section-title">Tests Performed</h3>
                            {record.tests_performed ? (
                                <div className="remarks-box" style={{ whiteSpace: 'pre-wrap' }}>
                                    {record.tests_performed}
                                </div>
                            ) : (
                                <p style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>No tests recorded</p>
                            )}
                        </div>

                        {/* Remarks */}
                        <div className="doc-section">
                            <h3 className="section-title">Remarks / Observations</h3>
                            {record.remarks ? (
                                <div className="remarks-box" style={{ whiteSpace: 'pre-wrap' }}>
                                    {record.remarks}
                                </div>
                            ) : (
                                <p style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>No remarks</p>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="doc-footer">
                            <div className="signatures">
                                <div className="sig-block">
                                    <div className="sig-line"></div>
                                    <p>Quality Analyst</p>
                                </div>
                                <div className="sig-block">
                                    <div className="sig-line"></div>
                                    <p>QA Manager</p>
                                </div>
                                <div className="sig-block">
                                    <div className="sig-line"></div>
                                    <p>Production Manager</p>
                                </div>
                            </div>
                        </div>

                        <div className="page-footer">
                            <p>This is a computer generated document. No signature required if scanned/emailed.</p>
                            <p>Aspee Pharmaceuticals Ltd — Quality Assurance Department</p>
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
