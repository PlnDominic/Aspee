'use client';

import React, { useState, useEffect, useRef } from 'react';
import Modal from './Modal';
import {
    FileCheck,
    ClipboardList,
    Package,
    Hash,
    Calendar,
    AlertCircle,
    CheckCircle,
    Plus,
    Trash2,
    Save,
    Printer,
    Download,
    Mail,
    Phone,
    MapPin,
    ArrowLeft
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { UNIT_OPTIONS, GROUPED_UNIT_OPTIONS } from '@/lib/constants';
import UnitConversionHint from './UnitConversionHint';

interface Product {
    id: string;
    name: string;
    sku: string;
    unit: string;
    bulk_unit?: string | null;
    bulk_to_base_ratio?: number | null;
}

interface POItem {
    id: string;
    product_id: string;
    quantity: number;
    unit_price: number;
    product?: Product;
}

interface PurchaseOrder {
    id: string;
    po_number: string;
    supplier_id: string;
    suppliers?: { name: string };
    status: string;
    created_at: string;
}

interface GRNItem {
    po_item_id: string;
    product_id: string;
    product?: Product;
    ordered_qty: number;
    received_qty: number;
    batch_no: string;
    expiry_date: string;
    discrepancies: number;
    approved_stock?: number;
    qa_status?: string;
    unit?: string;
}

interface GRNModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    initialData?: any;
    mode?: 'create' | 'edit' | 'view';
}

export default function GRNModal({ isOpen, onClose, onSave, initialData, mode = 'create' }: GRNModalProps) {
    const printRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
    const [poItems, setPoItems] = useState<POItem[]>([]);

    const [grnNumber, setGrnNumber] = useState('');
    const [receivedDate, setReceivedDate] = useState(new Date().toISOString().split('T')[0]);
    const [grnItems, setGrnItems] = useState<GRNItem[]>([]);
    const [notes, setNotes] = useState('');

    // QA fields
    const [qaStatus, setQaStatus] = useState('Pending');
    const [qaInspector, setQaInspector] = useState('');
    const [qaDate, setQaDate] = useState(new Date().toISOString().split('T')[0]);
    const [goodsCondition, setGoodsCondition] = useState('Good');
    const [qaRemarks, setQaRemarks] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchOpenPOs();
            if (mode === 'create') {
                resetForm();
                generateGRNNumber();
            } else if (initialData) {
                populateForm(initialData);
            }
        }
    }, [isOpen, mode, initialData]);

    const fetchOpenPOs = async () => {
        setFetching(true);
        try {
            const { data, error } = await supabase
                .from('purchase_orders')
                .select('*, suppliers(name)')
                .in('status', ['Pending', 'Approved', 'Shipped', 'Partial'])
                .order('created_at', { ascending: false });

            if (error) throw error;
            setPurchaseOrders(data || []);
        } catch (error: any) {
            toast.error('Failed to fetch POs: ' + error.message);
        } finally {
            setFetching(false);
        }
    };

    const fetchPOItems = async (poId: string) => {
        setFetching(true);
        try {
            const { data, error } = await supabase
                .from('purchase_order_items')
                .select(`
                    *,
                    product:products(id, name, sku, unit, bulk_unit, bulk_to_base_ratio)
                `)
                .eq('po_id', poId);

            if (error) throw error;

            // Fetch Approved Quantities for these products
            const productIds = (data || []).map(item => item.product_id);
            const { data: qas } = await supabase
                .from('grn_items')
                .select('product_id, quantity_received')
                .in('product_id', productIds)
                .eq('qa_status', 'Approved');

            const qaMap: Record<string, number> = {};
            qas?.forEach(q => {
                qaMap[q.product_id] = (qaMap[q.product_id] || 0) + (q.quantity_received || 0);
            });

            // Initialize GRN items from PO items
            if (data && data.length > 0) {
                const items = data.map((item: any) => ({
                    po_item_id: item.id,
                    product_id: item.product_id,
                    product: item.product,
                    ordered_qty: item.quantity,
                    received_qty: 0,
                    batch_no: '',
                    expiry_date: '',
                    discrepancies: 0,
                    approved_stock: qaMap[item.product_id] || 0,
                    qa_status: 'Pending',
                    unit: item.unit || item.product?.unit || 'Pieces'
                }));
                setPoItems(data);
                setGrnItems(items);
            }
        } catch (error: any) {
            toast.error('Failed to fetch PO items: ' + error.message);
        } finally {
            setFetching(false);
        }
    };

    const resetForm = () => {
        setGrnNumber('');
        setReceivedDate(new Date().toISOString().split('T')[0]);
        setSelectedPO(null);
        setPoItems([]);
        setGrnItems([]);
        setNotes('');
        setQaStatus('Pending');
        setQaInspector('');
        setQaDate(new Date().toISOString().split('T')[0]);
        setGoodsCondition('Good');
        setQaRemarks('');
    };

    const populateForm = async (grn: any) => {
        setGrnNumber(grn.grn_number || '');
        setReceivedDate(grn.received_date || new Date().toISOString().split('T')[0]);
        setNotes(grn.notes || '');
        setQaStatus(grn.qa_status || 'Pending');
        setQaInspector(grn.qa_inspector || '');
        setQaDate(grn.qa_date ? new Date(grn.qa_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
        setGoodsCondition(grn.goods_condition || 'Good');
        setQaRemarks(grn.qa_remarks || '');

        // Fetch PO
        if (grn.po_id) {
            const { data: poData } = await supabase
                .from('purchase_orders')
                .select('*, suppliers(name)')
                .eq('id', grn.po_id)
                .single();
            
            if (poData) {
                setSelectedPO(poData);
            }
        }

        // Fetch existing GRN items directly
        if (grn.id) {
            const { data: itemsData, error: itemsError } = await supabase
                .from('grn_items')
                .select(`
                    *,
                    product:products(id, name, sku, unit, bulk_unit, bulk_to_base_ratio)
                `)
                .eq('grn_id', grn.id);

            if (itemsError) {
                console.error('Error fetching GRN items:', itemsError);
            }

            if (itemsData && itemsData.length > 0) {
                // Build items directly from GRN items data
                const items = itemsData.map((item: any) => ({
                    po_item_id: item.po_item_id || '',
                    product_id: item.product_id,
                    product: item.product,
                    ordered_qty: 0, // Will be fetched from PO items if needed
                    received_qty: item.quantity_received,
                    batch_no: item.batch_no || '',
                    expiry_date: item.expiry_date || '',
                    discrepancies: 0,
                    approved_stock: 0, // Will be fetched below
                    qa_status: item.qa_status || 'Pending',
                    unit: item.unit || item.product?.unit || 'Pieces'
                }));

                // Fetch Approved Quantities for these products
                const productIds = items.map(i => i.product_id);
                const { data: qas } = await supabase
                    .from('grn_items')
                    .select('product_id, quantity_received')
                    .in('product_id', productIds)
                    .eq('qa_status', 'Approved');

                const qaMap: Record<string, number> = {};
                qas?.forEach(q => {
                    qaMap[q.product_id] = (qaMap[q.product_id] || 0) + (q.quantity_received || 0);
                });

                items.forEach(item => {
                    item.approved_stock = qaMap[item.product_id] || 0;
                });

                setGrnItems(items);
                
                // Also fetch PO items to get ordered quantities
                if (grn.po_id) {
                    const { data: poItemsData } = await supabase
                        .from('purchase_order_items')
                        .select('id, product_id, quantity, unit')
                        .eq('po_id', grn.po_id);
                    
                    if (poItemsData) {
                        // Update ordered quantities
                        const itemsWithOrderedQty = items.map(item => {
                            const poItem = poItemsData.find((pi: any) => pi.product_id === item.product_id);
                            return {
                                ...item,
                                po_item_id: poItem?.id || item.po_item_id,
                                ordered_qty: poItem?.quantity || 0,
                                discrepancies: (item.received_qty || 0) - (poItem?.quantity || 0),
                                unit: poItem?.unit || item.unit || item.product?.unit || 'Pieces'
                            };
                        });
                        setGrnItems(itemsWithOrderedQty);
                    }
                }
            }
        }
    };

    const generateGRNNumber = () => {
        const date = new Date();
        const year = date.getFullYear().toString().slice(-2);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const random = Math.floor(10000 + Math.random() * 90000);
        setGrnNumber(`GRN-${year}${month}${day}-${random}`);
    };

    const handlePOSelect = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const poId = e.target.value;
        if (!poId) {
            setSelectedPO(null);
            setGrnItems([]);
            return;
        }

        const po = purchaseOrders.find(p => p.id === poId);
        setSelectedPO(po || null);

        if (poId) {
            await fetchPOItems(poId);
        }
    };

    const updateGRNItem = (index: number, field: keyof GRNItem, value: any) => {
        const newItems = [...grnItems];
        newItems[index] = { ...newItems[index], [field]: value };

        // Calculate discrepancies
        if (field === 'received_qty') {
            newItems[index].discrepancies = Number(value) - newItems[index].ordered_qty;
        }

        setGrnItems(newItems);
    };

    const calculateTotalDiscrepancies = () => {
        return grnItems.reduce((sum, item) => sum + Math.abs(item.discrepancies), 0);
    };

    const calculateTotalItems = () => {
        return grnItems.filter(item => item.received_qty > 0).length;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedPO) {
            toast.error('Please select a Purchase Order');
            return;
        }

        const validItems = grnItems.filter(item => item.received_qty > 0);
        if (validItems.length === 0) {
            toast.error('Please enter at least one received quantity');
            return;
        }

        setLoading(true);
        try {
            await onSave({
                id: initialData?.id,
                grn_number: grnNumber,
                po_id: selectedPO.id,
                received_date: receivedDate,
                notes: notes,
                status: 'Confirmed',
                qa_status: qaStatus,
                qa_inspector: qaInspector || null,
                qa_date: qaDate || null,
                goods_condition: goodsCondition,
                qa_remarks: qaRemarks || null,
                items: validItems.map(item => ({
                    product_id: item.product_id,
                    quantity_received: item.received_qty,
                    unit: item.unit || item.product?.unit || 'Pieces',
                    batch_no: item.batch_no,
                    expiry_date: item.expiry_date || null,
                    po_item_id: item.po_item_id,
                    qa_status: item.qa_status
                }))
            });
            onClose();
        } catch (error: any) {
            console.error('Error saving GRN:', error);
        } finally {
            setLoading(false);
        }
    };

    const isViewOnly = mode === 'view';

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

    const grnDocStyles = `
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
        .grn-meta { display: flex; flex-direction: column; gap: 4px; }
        .meta-row { display: flex; justify-content: flex-end; gap: 10px; font-size: 11px; }
        .meta-row .label { color: #64748b; font-weight: 500; }
        .meta-row .value { color: #0f172a; font-weight: 700; }
        .status-badge { padding: 1px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
        .status-badge.confirmed { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
        .status-badge.pending { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
        .doc-addresses { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; margin-bottom: 40px; }
        .address-block h3 { font-size: 11px; font-weight: 800; color: #94a3b8; border-bottom: 1px solid #eee; padding-bottom: 6px; margin-bottom: 12px; letter-spacing: 0.05em; }
        .address-content { font-size: 11px; line-height: 1.5; }
        .address-content strong { display: block; font-size: 11px; margin-bottom: 4px; color: #0f172a; }
        .address-content p { margin: 1px 0; color: #334155; }
        .items-table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
        .items-table th { background: #f8fafc; padding: 12px 10px; text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #334155; border-top: 1.5px solid #1a1a1a; border-bottom: 1.5px solid #1a1a1a; }
        .items-table td { padding: 12px 10px; border-bottom: 1px solid #eee; font-size: 11px; vertical-align: top; }
        .items-table tbody tr:last-child td { border-bottom: 1.5px solid #1a1a1a; }
        .item-name { font-weight: 600; color: #0f172a; }
        .item-sku { font-size: 11px; color: #64748b; margin-top: 1px; }
        .text-right { text-align: right; }
        .discrepancy-positive { color: #16a34a; font-weight: 700; }
        .discrepancy-negative { color: #dc2626; font-weight: 700; }
        .discrepancy-zero { color: #64748b; }
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
        .qa-section { margin-bottom: 30px; padding: 16px 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; }
        .qa-section-title { font-size: 11px; font-weight: 800; color: #334155; letter-spacing: 0.05em; margin-bottom: 14px; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0; }
        .qa-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 40px; }
        .qa-field { display: flex; align-items: center; gap: 8px; font-size: 11px; }
        .qa-label { font-weight: 600; color: #64748b; }
        .qa-value { font-weight: 700; color: #0f172a; }
        .status-badge.approved { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
        .status-badge.rejected { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
        .status-badge.quarantine { background: #fefce8; color: #854d0e; border: 1px solid #fef08a; }
        .condition-badge { padding: 1px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; }
        .condition-badge.good { background: #dcfce7; color: #166534; }
        .condition-badge.damaged { background: #fef2f2; color: #991b1b; }
        .qa-remarks { margin-top: 12px; font-size: 11px; }
        .qa-remarks p { margin-top: 4px; color: #334155; line-height: 1.5; }
    `;

    const handleDownloadPDF = async () => {
        const clonedContent = getClonedContent();
        if (!clonedContent) return;

        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.left = '-9999px';
        container.style.top = '0';

        const styleEl = document.createElement('style');
        styleEl.textContent = grnDocStyles;
        container.appendChild(styleEl);
        container.appendChild(clonedContent);
        document.body.appendChild(container);

        try {
            const html2pdf = (await import('html2pdf.js')).default;
            await html2pdf()
                .set({
                    margin: 0,
                    filename: `${grnNumber}.pdf`,
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
            toast.error('Please allow pop-ups to print the GRN.');
            return;
        }

        const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Goods Receipt Note - ${grnNumber}</title>
    <style>
        ${grnDocStyles}
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

    const totalReceived = grnItems.reduce((sum, item) => sum + item.received_qty, 0);
    const totalOrdered = grnItems.reduce((sum, item) => sum + item.ordered_qty, 0);
    const totalDiscrepancies = grnItems.reduce((sum, item) => sum + Math.abs(item.discrepancies), 0);

    if (isViewOnly) {
        return (
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                title="Goods Receipt Note Detail"
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
                                <Printer size={16} /> Print GRN
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
                                    <h2>GOODS RECEIPT NOTE</h2>
                                    <div className="grn-meta">
                                        <div className="meta-row">
                                            <span className="label">GRN Number:</span>
                                            <span className="value">{grnNumber}</span>
                                        </div>
                                        <div className="meta-row">
                                            <span className="label">PO Reference:</span>
                                            <span className="value">{selectedPO?.po_number}</span>
                                        </div>
                                        <div className="meta-row">
                                            <span className="label">Received Date:</span>
                                            <span className="value">{new Date(receivedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                        </div>
                                        <div className="meta-row">
                                            <span className="label">Status:</span>
                                            <span className={`status-badge ${(initialData?.status || 'Confirmed').toLowerCase()}`}>{initialData?.status || 'Confirmed'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="doc-addresses">
                                <div className="address-block">
                                    <h3>SUPPLIER</h3>
                                    <div className="address-content">
                                        <strong>{selectedPO?.suppliers?.name}</strong>
                                    </div>
                                </div>
                                <div className="address-block">
                                    <h3>RECEIVED BY</h3>
                                    <div className="address-content">
                                        <strong>ASPEE PHARMACEUTICALS LTD</strong>
                                        <p>Warehouse Dept. (Store Manager)</p>
                                        <p>Ejisu - Asamang</p>
                                        <p>Phone: 0244791052</p>
                                    </div>
                                </div>
                            </div>

                            {/* Items Table */}
                            <div className="doc-items">
                                <table className="items-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '40px' }}>#</th>
                                            <th>Description / Item Name</th>
                                            <th style={{ width: '60px' }}>Unit</th>
                                            <th style={{ width: '90px', textAlign: 'right' }}>Ordered</th>
                                            <th style={{ width: '90px', textAlign: 'right' }}>Received</th>
                                            <th style={{ width: '80px', textAlign: 'right' }}>Diff</th>
                                            <th style={{ width: '100px' }}>QA Status</th>
                                            <th style={{ width: '100px' }}>Batch No</th>
                                            <th style={{ width: '100px' }}>Expiry Date</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {grnItems.map((item, idx) => (
                                            <tr key={idx}>
                                                <td>{idx + 1}</td>
                                                <td>
                                                    <div className="item-name">{item.product?.name}</div>
                                                    <div className="item-sku">{item.product?.sku}</div>
                                                </td>
                                                <td>{item.unit || item.product?.unit || 'Pieces'}</td>
                                                <td className="text-right">{item.ordered_qty}</td>
                                                <td className="text-right" style={{ fontWeight: 'bold' }}>{item.received_qty}</td>
                                                <td className={`text-right ${item.discrepancies > 0 ? 'discrepancy-positive' : item.discrepancies < 0 ? 'discrepancy-negative' : 'discrepancy-zero'}`}>
                                                    {item.discrepancies > 0 ? '+' : ''}{item.discrepancies}
                                                </td>
                                                <td><span className={`status-badge ${(item.qa_status || 'Pending').toLowerCase()}`}>{item.qa_status || 'Pending'}</span></td>
                                                <td>{item.batch_no || '-'}</td>
                                                <td>{item.expiry_date ? new Date(item.expiry_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="summary-row">
                                            <td colSpan={3} className="no-border"></td>
                                            <td className="summary-label">TOTAL ORDERED</td>
                                            <td className="summary-value">{totalOrdered}</td>
                                            <td colSpan={3} className="no-border"></td>
                                        </tr>
                                        <tr className="summary-row">
                                            <td colSpan={3} className="no-border"></td>
                                            <td className="summary-label">TOTAL RECEIVED</td>
                                            <td className="summary-value">{totalReceived}</td>
                                            <td colSpan={3} className="no-border"></td>
                                        </tr>
                                        <tr className="grand-total-row">
                                            <td colSpan={3} className="no-border"></td>
                                            <td className="summary-label">DISCREPANCIES</td>
                                            <td className="summary-value">{totalDiscrepancies}</td>
                                            <td colSpan={3} className="no-border"></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            {/* QA Inspection Section */}
                            <div className="qa-section">
                                <h3 className="qa-section-title">QUALITY ASSURANCE INSPECTION</h3>
                                <div className="qa-grid">
                                    <div className="qa-field">
                                        <span className="qa-label">QA Inspector:</span>
                                        <span className="qa-value">{qaInspector || '-'}</span>
                                    </div>
                                    <div className="qa-field">
                                        <span className="qa-label">Inspection Date:</span>
                                        <span className="qa-value">{qaDate ? new Date(qaDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</span>
                                    </div>

                                </div>
                                {qaRemarks && (
                                    <div className="qa-remarks">
                                        <span className="qa-label">Remarks:</span>
                                        <p>{qaRemarks}</p>
                                    </div>
                                )}
                            </div>

                            <div className="doc-footer">
                                <div className="notes-box">
                                    <h4>Notes & Remarks</h4>
                                    {notes ? (
                                        <p>{notes}</p>
                                    ) : (
                                        <ul>
                                            <li>All items inspected and verified against Purchase Order.</li>
                                            <li>Any discrepancies have been noted above and reported.</li>
                                            <li>Goods stored in designated warehouse location.</li>
                                        </ul>
                                    )}
                                </div>
                                <div className="signatures">
                                    <div className="sig-block">
                                        <div className="sig-line"></div>
                                        <p>Received By</p>
                                    </div>
                                    <div className="sig-block">
                                        <div className="sig-line"></div>
                                        <p>QA Inspector</p>
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

                    .company-name {
                        color: var(--slate-900);
                        font-size: 11px;
                        font-weight: 800;
                        margin: 0;
                        letter-spacing: -0.02em;
                    }

                    .company-tagline {
                        font-size: 11px;
                        color: var(--slate-500);
                        font-style: italic;
                        margin: 2px 0 10px 0;
                    }

                    .contact-details p {
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        font-size: 11px;
                        margin: 3px 0;
                        color: var(--slate-700);
                    }

                    .doc-type h2 {
                        text-align: right;
                        color: var(--slate-900);
                        font-size: 11px;
                        font-weight: 800;
                        margin: 0 0 12px 0;
                        letter-spacing: 0.05em;
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
                        color: var(--slate-500);
                        font-weight: 500;
                    }

                    .meta-row .value {
                        color: var(--slate-900);
                        font-weight: 700;
                    }

                    .status-badge {
                        padding: 1px 8px;
                        border-radius: 4px;
                        font-size: 11px;
                        font-weight: 700;
                        text-transform: uppercase;
                    }

                    .status-badge.confirmed { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
                    .status-badge.pending { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }

                    .doc-addresses {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 60px;
                        margin-bottom: 40px;
                    }

                    .address-block h3 {
                        font-size: 11px;
                        font-weight: 800;
                        color: var(--slate-400);
                        border-bottom: 1px solid #eeeeee;
                        padding-bottom: 6px;
                        margin-bottom: 12px;
                        letter-spacing: 0.05em;
                    }

                    .address-content {
                        font-size: 11px;
                        line-height: 1.5;
                    }

                    .address-content strong {
                        display: block;
                        font-size: 11px;
                        margin-bottom: 4px;
                        color: var(--slate-900);
                    }

                    .address-content p {
                        margin: 1px 0;
                        color: var(--slate-700);
                    }

                    .items-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 40px;
                    }

                    .items-table th {
                        background: var(--slate-50);
                        padding: 12px 10px;
                        text-align: left;
                        font-size: 11px;
                        font-weight: 700;
                        text-transform: uppercase;
                        color: var(--slate-700);
                        border-top: 1.5px solid #1a1a1a;
                        border-bottom: 1.5px solid #1a1a1a;
                    }

                    .items-table td {
                        padding: 12px 10px;
                        border-bottom: 1px solid #eeeeee;
                        font-size: 11px;
                        vertical-align: top;
                    }

                    .items-table tbody tr:last-child td {
                        border-bottom: 1.5px solid #1a1a1a;
                    }

                    .item-name { font-weight: 600; color: var(--slate-900); }
                    .item-sku { font-size: 11px; color: var(--slate-500); margin-top: 1px; }
                    .text-right { text-align: right; }

                    .discrepancy-positive { color: #16a34a; font-weight: 700; }
                    .discrepancy-negative { color: #dc2626; font-weight: 700; }
                    .discrepancy-zero { color: var(--slate-400); }

                    .summary-row td { padding: 8px 10px; }
                    .summary-label {
                        text-align: right;
                        font-weight: 700;
                        font-size: 11px;
                        color: var(--slate-600);
                    }

                    .summary-value {
                        text-align: right;
                        font-weight: 700;
                        font-size: 11px;
                    }

                    .grand-total-row td {
                        padding: 12px 10px !important;
                        background: var(--slate-50);
                        border-top: 2px solid #1a1a1a !important;
                        border-bottom: 2px solid #1a1a1a !important;
                    }

                    .grand-total-row .summary-label {
                        color: var(--slate-900);
                        font-size: 11px;
                    }
                    .grand-total-row .summary-value {
                        font-size: 11px;
                        color: var(--slate-900);
                    }

                    .no-border { border: none !important; background: transparent !important; }

                    .doc-footer {
                        display: grid;
                        grid-template-columns: 1.5fr 1fr;
                        gap: 60px;
                        margin-top: auto;
                        padding-top: 40px;
                    }

                    .notes-box h4 {
                        font-size: 11px;
                        font-weight: 800;
                        margin: 0 0 10px 0;
                        color: var(--slate-800);
                        text-transform: uppercase;
                    }

                    .notes-box p {
                        font-size: 11px;
                        color: var(--slate-600);
                        line-height: 1.5;
                    }

                    .notes-box ul {
                        padding-left: 14px;
                        margin: 0;
                    }

                    .notes-box li {
                        font-size: 11px;
                        color: var(--slate-600);
                        margin-bottom: 4px;
                        line-height: 1.4;
                    }

                    .signatures {
                        display: flex;
                        flex-direction: column;
                        gap: 40px;
                    }

                    .sig-block {
                        text-align: center;
                    }

                    .sig-line {
                        border-bottom: 1px solid #1a1a1a;
                        margin-bottom: 6px;
                    }

                    .sig-block p {
                        font-size: 11px;
                        font-weight: 700;
                        color: var(--slate-700);
                        text-transform: uppercase;
                    }

                    .page-footer {
                        margin-top: 50px;
                        padding-top: 15px;
                        border-top: 1px solid #eeeeee;
                        text-align: center;
                        font-size: 11px;
                        color: var(--slate-400);
                    }

                    .qa-section {
                        margin-bottom: 30px;
                        padding: 16px 20px;
                        background: var(--slate-50);
                        border: 1px solid var(--slate-200);
                        border-radius: 8px;
                    }

                    .qa-section-title {
                        font-size: 11px;
                        font-weight: 800;
                        color: var(--slate-700);
                        letter-spacing: 0.05em;
                        margin-bottom: 14px;
                        padding-bottom: 8px;
                        border-bottom: 1px solid #e2e8f0;
                    }

                    .qa-grid {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 12px 40px;
                    }

                    .qa-field {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        font-size: 11px;
                    }

                    .qa-label {
                        font-weight: 600;
                        color: var(--slate-500);
                    }

                    .qa-value {
                        font-weight: 700;
                        color: var(--slate-900);
                    }

                    .status-badge.approved { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
                    .status-badge.rejected { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
                    .status-badge.quarantine { background: #fefce8; color: #854d0e; border: 1px solid #fef08a; }

                    .condition-badge {
                        padding: 1px 8px;
                        border-radius: 4px;
                        font-size: 11px;
                        font-weight: 700;
                    }
                    .condition-badge.good { background: #dcfce7; color: #166534; }
                    .condition-badge.damaged { background: #fef2f2; color: #991b1b; }

                    .qa-remarks {
                        margin-top: 12px;
                        font-size: 11px;
                    }
                    .qa-remarks p { margin-top: 4px; color: var(--slate-700); line-height: 1.5; }
                `}</style>
            </Modal>
        );
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={mode === 'edit' ? 'Edit GRN' : 'Create Goods Receipt Note'}
            subtitle="Record incoming goods from purchase orders"
            width={1200}
        >
            <form onSubmit={handleSubmit} className="grn-form">
                <div className="form-section">
                    <h4 className="section-title">
                        <FileCheck size={16} />
                        GRN Details
                    </h4>
                    
                    <div className="form-grid-3">
                        <div className="form-field">
                            <label>GRN Number</label>
                            <div className="input-wrapper">
                                <Hash size={16} className="icon" />
                                <input 
                                    value={grnNumber} 
                                    onChange={(e) => setGrnNumber(e.target.value)}
                                    placeholder="Auto-generated"
                                    readOnly
                                />
                            </div>
                        </div>

                        <div className="form-field">
                            <label>Received Date</label>
                            <div className="input-wrapper">
                                <Calendar size={16} className="icon" />
                                <input 
                                    type="date"
                                    value={receivedDate}
                                    onChange={(e) => setReceivedDate(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="form-field">
                            <label>Purchase Order *</label>
                            <div className="input-wrapper">
                                <ClipboardList size={16} className="icon" />
                                <select
                                    value={selectedPO?.id || ''}
                                    onChange={handlePOSelect}
                                    disabled={fetching || mode !== 'create'}
                                >
                                    <option value="">Select PO...</option>
                                    {purchaseOrders.map(po => (
                                        <option key={po.id} value={po.id}>
                                            {po.po_number} - {po.suppliers?.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {selectedPO && (
                        <div className="po-summary">
                            <span className="po-info">
                                <strong>PO:</strong> {selectedPO.po_number}
                            </span>
                            <span className="po-info">
                                <strong>Supplier:</strong> {selectedPO.suppliers?.name}
                            </span>
                            <span className="po-info">
                                <strong>Status:</strong> {selectedPO.status}
                            </span>
                        </div>
                    )}
                </div>

                {grnItems.length > 0 && (
                    <div className="form-section">
                        <h4 className="section-title">
                            <Package size={16} />
                            Received Items
                        </h4>

                        <div className="items-table-wrapper">
                            <table className="items-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '40px' }}>#</th>
                                        <th>Product</th>
                                        <th style={{ width: '90px' }}>Ordered</th>
                                        <th style={{ width: '90px' }}>Approved</th>
                                        <th style={{ width: '110px' }}>Unit</th>
                                        <th style={{ width: '120px' }}>Received *</th>
                                        <th style={{ width: '80px' }}>Diff</th>
                                        <th style={{ width: '120px' }}>QA Status</th>
                                        <th style={{ width: '120px' }}>Batch No</th>
                                        <th style={{ width: '120px' }}>Expiry Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {grnItems.map((item, idx) => (
                                        <tr key={idx}>
                                            <td>{idx + 1}</td>
                                            <td>
                                                <div className="product-cell">
                                                    <span className="product-name">{item.product?.name}</span>
                                                    <span className="product-sku">{item.product?.sku}</span>
                                                </div>
                                            </td>
                                            <td className="text-right">{item.ordered_qty}</td>
                                            <td className="text-right" style={{ fontWeight: 600, color: 'var(--slate-500)' }}>
                                                {(item.approved_stock || 0).toLocaleString()}
                                            </td>
                                            <td>
                                                <select
                                                    value={item.unit || item.product?.unit || ''}
                                                    onChange={(e) => updateGRNItem(idx, 'unit', e.target.value)}
                                                    className="qa-status-select"
                                                >
                                                    <option value="">Select unit</option>
                                                    {GROUPED_UNIT_OPTIONS.map((g) => (
                                                        <optgroup key={g.label} label={g.label}>
                                                            {g.units.map((unit) => (
                                                                <option key={unit} value={unit}>{unit}</option>
                                                            ))}
                                                        </optgroup>
                                                    ))}
                                                </select>
                                                {item.product?.unit && item.unit && item.unit !== item.product.unit && (
                                                    <UnitConversionHint value={item.received_qty} fromUnit={item.unit} toUnit={item.product.unit} compact />
                                                )}
                                            </td>
                                            <td>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={item.received_qty || ''}
                                                    onChange={(e) => updateGRNItem(idx, 'received_qty', parseFloat(e.target.value) || 0)}
                                                    placeholder="0"
                                                    className="qty-input"
                                                />
                                                {item.product?.bulk_unit && item.product?.bulk_to_base_ratio && item.received_qty > 0 && (
                                                    <div style={{ fontSize: 10, color: 'var(--primary-600)', fontWeight: 600, marginTop: 2, whiteSpace: 'nowrap' }}>
                                                        ≈ {(item.received_qty / item.product.bulk_to_base_ratio % 1 === 0
                                                            ? (item.received_qty / item.product.bulk_to_base_ratio).toLocaleString()
                                                            : (item.received_qty / item.product.bulk_to_base_ratio).toLocaleString(undefined, { maximumFractionDigits: 2 })
                                                        )} {item.product.bulk_unit}
                                                    </div>
                                                )}
                                            </td>
                                            <td className={`text-right ${item.discrepancies !== 0 ? 'has-discrepancy' : ''}`}>
                                                {item.discrepancies > 0 ? '+' : ''}{item.discrepancies}
                                            </td>
                                            <td>
                                                <select
                                                    value={item.qa_status || 'Pending'}
                                                    onChange={(e) => updateGRNItem(idx, 'qa_status', e.target.value)}
                                                    className="qa-status-select"
                                                >
                                                    <option value="Pending">Pending</option>
                                                    <option value="Approved">Approved</option>
                                                    <option value="Rejected">Rejected</option>
                                                    <option value="Quarantine">Quarantine</option>
                                                </select>
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    value={item.batch_no}
                                                    onChange={(e) => updateGRNItem(idx, 'batch_no', e.target.value)}
                                                    placeholder="Batch #"
                                                    className="batch-input"
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="date"
                                                    value={item.expiry_date}
                                                    onChange={(e) => updateGRNItem(idx, 'expiry_date', e.target.value)}
                                                    className="date-input"
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="summary-row">
                            <div className="summary-item">
                                <span className="summary-label">Total Items:</span>
                                <span className="summary-value">{calculateTotalItems()}</span>
                            </div>
                            <div className="summary-item">
                                <span className="summary-label">Total Discrepancies:</span>
                                <span className={`summary-value ${calculateTotalDiscrepancies() > 0 ? 'warning' : ''}`}>
                                    {calculateTotalDiscrepancies()}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                <div className="form-section">
                    <h4 className="section-title">
                        <CheckCircle size={16} />
                        Quality Assurance Inspection
                    </h4>

                    <div className="form-grid-3">
                        <div className="form-field">
                            <label>QA Status *</label>
                            <div className="input-wrapper">
                                <CheckCircle size={16} className="icon" />
                                <select
                                    value={qaStatus}
                                    onChange={(e) => setQaStatus(e.target.value)}
                                >
                                    <option value="Pending">Pending</option>
                                    <option value="Approved">Approved</option>
                                    <option value="Rejected">Rejected</option>
                                    <option value="Quarantine">Quarantine</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-field">
                            <label>QA Inspector Name</label>
                            <div className="input-wrapper">
                                <AlertCircle size={16} className="icon" />
                                <input
                                    type="text"
                                    value={qaInspector}
                                    onChange={(e) => setQaInspector(e.target.value)}
                                    placeholder="Inspector name"
                                />
                            </div>
                        </div>

                        <div className="form-field">
                            <label>Inspection Date</label>
                            <div className="input-wrapper">
                                <Calendar size={16} className="icon" />
                                <input
                                    type="date"
                                    value={qaDate}
                                    onChange={(e) => setQaDate(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="form-field">
                            <label>QA Remarks</label>
                            <textarea
                                value={qaRemarks}
                                onChange={(e) => setQaRemarks(e.target.value)}
                                placeholder="Quality inspection remarks..."
                                rows={1}
                            />
                        </div>
                    </div>
                </div>

                <div className="form-field full-width">
                    <label>General Notes</label>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Add any notes about this receipt..."
                        rows={3}
                    />
                </div>

                <div className="form-actions">
                    <button type="button" onClick={onClose} className="btn-cancel">
                        Cancel
                    </button>
                    <button type="submit" className="btn-submit" disabled={loading}>
                        {loading ? (
                            'Saving...'
                        ) : (
                            <>
                                <Save size={16} />
                                {mode === 'edit' ? 'Update GRN' : 'Confirm Receipt'}
                            </>
                        )}
                    </button>
                </div>
            </form>

            <style>{`
                .grn-form {
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
                .form-grid-3 {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
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
                .po-summary {
                    display: flex;
                    gap: 24px;
                    padding: 12px 16px;
                    background: linear-gradient(135deg, var(--primary-50), var(--slate-50));
                    border-radius: 8px;
                    border: 1px solid var(--primary-100);
                }
                .po-info {
                    font-size: 11px;
                    color: var(--slate-600);
                }
                .po-info strong {
                    color: var(--slate-900);
                }
                .items-table-wrapper {
                    overflow-x: auto;
                    border: 1px solid var(--slate-200);
                    border-radius: 12px;
                }
                .items-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 11px;
                }
                .items-table th {
                    padding: 12px 10px;
                    text-align: left;
                    font-size: 11px;
                    font-weight: 700;
                    text-transform: uppercase;
                    color: var(--slate-500);
                    background: var(--slate-50);
                    border-bottom: 1px solid var(--slate-200);
                    white-space: nowrap;
                }
                .items-table td {
                    padding: 10px;
                    border-bottom: 1px solid var(--slate-100);
                    vertical-align: middle;
                }
                .items-table tr:last-child td {
                    border-bottom: none;
                }
                .product-cell {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }
                .product-name {
                    font-weight: 600;
                    color: var(--slate-900);
                }
                .product-sku {
                    font-size: 11px;
                    font-family: var(--font-mono);
                    color: var(--slate-500);
                }
                .text-right {
                    text-align: right;
                }
                .qty-input,
                .batch-input,
                .date-input,
                .qa-status-select {
                    width: 100%;
                    padding: 8px 10px;
                    border: 1px solid var(--slate-200);
                    border-radius: 6px;
                    font-size: 11px;
                    text-align: right;
                }
                .batch-input,
                .qa-status-select {
                    text-align: left;
                }
                .qty-input:focus,
                .batch-input:focus,
                .date-input:focus,
                .qa-status-select:focus {
                    outline: none;
                    border-color: var(--primary-500);
                }
                .has-discrepancy {
                    color: var(--danger);
                    font-weight: 700;
                }
                .summary-row {
                    display: flex;
                    justify-content: flex-end;
                    gap: 32px;
                    padding: 12px 16px;
                    background: var(--slate-50);
                    border-radius: 8px;
                }
                .summary-item {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .summary-label {
                    font-size: 11px;
                    color: var(--slate-500);
                }
                .summary-value {
                    font-size: 11px;
                    font-weight: 700;
                    color: var(--slate-900);
                }
                .summary-value.warning {
                    color: var(--danger);
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
                .btn-cancel:hover {
                    background: var(--slate-50);
                }
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
                    .form-grid-3 {
                        grid-template-columns: 1fr;
                    }
                    .po-summary {
                        flex-direction: column;
                        gap: 8px;
                    }
                }
            `}</style>
        </Modal>
    );
}
