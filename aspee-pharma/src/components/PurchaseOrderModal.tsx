'use client';

import React, { useState, useEffect, useRef } from 'react';
import Modal from './Modal';
import {
    ClipboardList,
    User,
    Plus,
    Trash2,
    Package,
    Banknote,
    Hash,
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
import PrintablePO from './PrintablePO';
import { generatePDF } from '@/lib/pdfGenerator';
import { formatCurrency } from '@/lib/formatCurrency';
import { UNIT_OPTIONS, GROUPED_UNIT_OPTIONS } from '@/lib/constants';
import UnitConversionHint from './UnitConversionHint';

interface Product {
    id: string;
    name: string;
    sku: string;
    unit: string;
    material_type: string;
}

interface Supplier {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    contact_person?: string;
}

interface POItem {
    product_id: string;
    quantity: number;
    unit_price: number;
    unit: string;
    product?: Product;
}

interface PurchaseOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    initialData?: any;
    mode?: 'create' | 'edit' | 'view';
}

export default function PurchaseOrderModal({ isOpen, onClose, onSave, initialData, mode = 'create' }: PurchaseOrderModalProps) {
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);

    const [supplierId, setSupplierId] = useState('');
    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
    const [poNumber, setPoNumber] = useState('');
    const [rawItems, setRawItems] = useState<POItem[]>([{ product_id: '', quantity: 1, unit_price: 0, unit: 'Pieces' }]);
    const [pkgItems, setPkgItems] = useState<POItem[]>([{ product_id: '', quantity: 1, unit_price: 0, unit: 'Pieces' }]);
    const [labItems, setLabItems] = useState<POItem[]>([{ product_id: '', quantity: 1, unit_price: 0, unit: 'Pieces' }]);
    const [factoryItems, setFactoryItems] = useState<POItem[]>([{ product_id: '', quantity: 1, unit_price: 0, unit: 'Pieces' }]);
    const [stationeryItems, setStationeryItems] = useState<POItem[]>([{ product_id: '', quantity: 1, unit_price: 0, unit: 'Pieces' }]);
    const [generalItems, setGeneralItems] = useState<POItem[]>([{ product_id: '', quantity: 1, unit_price: 0, unit: 'Pieces' }]);
    const [currency, setCurrency] = useState('GHS');

    // Quick Add State
    const [quickAddName, setQuickAddName] = useState('');
    const [creatingProduct, setCreatingProduct] = useState(false);

    const printRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            fetchSuppliersAndProducts();
            if (mode === 'create') {
                resetForm();
                generatePONumber();
            } else if (initialData) {
                populateForm(initialData);
            }
        }
    }, [isOpen, mode, initialData]);

    useEffect(() => {
        if (supplierId && suppliers.length > 0) {
            const supplier = suppliers.find(s => s.id === supplierId);
            setSelectedSupplier(supplier || null);
        }
    }, [supplierId, suppliers]);

    const resetForm = () => {
        setSupplierId('');
        setSelectedSupplier(null);
        setPoNumber('');
        setRawItems([{ product_id: '', quantity: 1, unit_price: 0, unit: 'Pieces' }]);
        setPkgItems([{ product_id: '', quantity: 1, unit_price: 0, unit: 'Pieces' }]);
        setLabItems([{ product_id: '', quantity: 1, unit_price: 0, unit: 'Pieces' }]);
        setFactoryItems([{ product_id: '', quantity: 1, unit_price: 0, unit: 'Pieces' }]);
        setStationeryItems([{ product_id: '', quantity: 1, unit_price: 0, unit: 'Pieces' }]);
        setGeneralItems([{ product_id: '', quantity: 1, unit_price: 0, unit: 'Pieces' }]);
        setCurrency('GHS');
        setQuickAddName('');
    };

    const populateForm = async (po: any) => {
        setSupplierId(po.supplier_id);
        setPoNumber(po.po_number);
        setCurrency(po.currency || 'GHS');
        setFetching(true);
        try {
            const { data, error } = await supabase
                .from('purchase_order_items')
                .select(`
                    *,
                    product:products(*)
                `)
                .eq('po_id', po.id);
            if (error) throw error;

            if (data && data.length > 0) {
                const raw = data.filter(item => item.product?.material_type === 'Raw Material');
                const pkg = data.filter(item => item.product?.material_type === 'Packaging Material');
                const lab = data.filter(item => item.product?.material_type === 'Lab Consumables');
                const factory = data.filter(item => item.product?.material_type === 'Factory Consumables');
                const stationery = data.filter(item => item.product?.material_type === 'Stationery & Printing Accessories');
                const general = data.filter(item => item.product?.material_type === 'General Consumables');

                setRawItems(raw.length > 0 ? raw.map(i => ({ ...i, unit: i.unit || 'Pieces' })) : [{ product_id: '', quantity: 1, unit_price: 0, unit: 'Pieces' }]);
                setPkgItems(pkg.length > 0 ? pkg.map(i => ({ ...i, unit: i.unit || 'Pieces' })) : [{ product_id: '', quantity: 1, unit_price: 0, unit: 'Pieces' }]);
                setLabItems(lab.length > 0 ? lab.map(i => ({ ...i, unit: i.unit || 'Pieces' })) : [{ product_id: '', quantity: 1, unit_price: 0, unit: 'Pieces' }]);
                setFactoryItems(factory.length > 0 ? factory.map(i => ({ ...i, unit: i.unit || 'Pieces' })) : [{ product_id: '', quantity: 1, unit_price: 0, unit: 'Pieces' }]);
                setStationeryItems(stationery.length > 0 ? stationery.map(i => ({ ...i, unit: i.unit || 'Pieces' })) : [{ product_id: '', quantity: 1, unit_price: 0, unit: 'Pieces' }]);
                setGeneralItems(general.length > 0 ? general.map(i => ({ ...i, unit: i.unit || 'Pieces' })) : [{ product_id: '', quantity: 1, unit_price: 0, unit: 'Pieces' }]);
            }
        } catch (error: any) {
            toast.error('Failed to load PO items: ' + error.message);
        } finally {
            setFetching(false);
        }
    };

    const fetchSuppliersAndProducts = async () => {
        setFetching(true);
        try {
            const [suppliersRes, productsRes] = await Promise.all([
                supabase.from('suppliers').select('*').order('name'),
                supabase.from('products').select('id, name, sku, unit, material_type')
                    .neq('material_type', 'Finished Good')
                    .order('name')
            ]);

            if (suppliersRes.error) throw suppliersRes.error;
            if (productsRes.error) throw productsRes.error;

            setSuppliers(suppliersRes.data || []);
            setProducts(productsRes.data || []);
        } catch (error: any) {
            toast.error('Failed to load data: ' + error.message);
        } finally {
            setFetching(false);
        }
    };

    const generatePONumber = () => {
        const date = new Date();
        const year = date.getFullYear().toString().slice(-2);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const random = Math.floor(1000 + Math.random() * 9000);
        setPoNumber(`PO-${year}${month}-${random}`);
    };

    const handleQuickAdd = async (type: 'Raw Material' | 'Packaging Material' | 'Lab Consumables' | 'Factory Consumables' | 'Stationery & Printing Accessories' | 'General Consumables') => {
        let name = quickAddName;

        if (!name.trim()) return;

        setCreatingProduct(true);
        try {
            const sku = `AUTO-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
            const { data, error } = await supabase
                .from('products')
                .insert([{ 
                    name: name.trim(), 
                    material_type: type,
                    sku: sku,
                    unit: 'Pieces',
                    reorder_level: 0
                }])
                .select()
                .single();

            if (error) throw error;

            toast.success(`${type} added: ${name}`);
            
            await fetchSuppliersAndProducts();
            setQuickAddName('');

            if (type === 'Raw Material') {
                const emptyIndex = rawItems.findIndex(i => !i.product_id);
                if (emptyIndex !== -1) updateItem('raw', emptyIndex, 'product_id', data.id);
                else setRawItems([...rawItems, { product_id: data.id, quantity: 1, unit_price: 0, unit: 'Pieces' }]);
            } else if (type === 'Packaging Material') {
                const emptyIndex = pkgItems.findIndex(i => !i.product_id);
                if (emptyIndex !== -1) updateItem('pkg', emptyIndex, 'product_id', data.id);
                else setPkgItems([...pkgItems, { product_id: data.id, quantity: 1, unit_price: 0, unit: 'Pieces' }]);
            } else if (type === 'Lab Consumables') {
                const emptyIndex = labItems.findIndex(i => !i.product_id);
                if (emptyIndex !== -1) updateItem('lab', emptyIndex, 'product_id', data.id);
                else setLabItems([...labItems, { product_id: data.id, quantity: 1, unit_price: 0, unit: 'Pieces' }]);
            } else if (type === 'Factory Consumables') {
                const emptyIndex = factoryItems.findIndex(i => !i.product_id);
                if (emptyIndex !== -1) updateItem('factory', emptyIndex, 'product_id', data.id);
                else setFactoryItems([...factoryItems, { product_id: data.id, quantity: 1, unit_price: 0, unit: 'Pieces' }]);
            } else if (type === 'Stationery & Printing Accessories') {
                const emptyIndex = stationeryItems.findIndex(i => !i.product_id);
                if (emptyIndex !== -1) updateItem('stationery', emptyIndex, 'product_id', data.id);
                else setStationeryItems([...stationeryItems, { product_id: data.id, quantity: 1, unit_price: 0, unit: 'Pieces' }]);
            } else {
                const emptyIndex = generalItems.findIndex(i => !i.product_id);
                if (emptyIndex !== -1) updateItem('general', emptyIndex, 'product_id', data.id);
                else setGeneralItems([...generalItems, { product_id: data.id, quantity: 1, unit_price: 0, unit: 'Pieces' }]);
            }
        } catch (error: any) {
            toast.error('Failed to add product: ' + error.message);
        } finally {
            setCreatingProduct(false);
        }
    };

    const addItem = (type: 'raw' | 'pkg' | 'lab' | 'factory' | 'stationery' | 'general') => {
        if (type === 'raw') setRawItems([...rawItems, { product_id: '', quantity: 1, unit_price: 0, unit: 'Pieces' }]);
        else if (type === 'pkg') setPkgItems([...pkgItems, { product_id: '', quantity: 1, unit_price: 0, unit: 'Pieces' }]);
        else if (type === 'lab') setLabItems([...labItems, { product_id: '', quantity: 1, unit_price: 0, unit: 'Pieces' }]);
        else if (type === 'factory') setFactoryItems([...factoryItems, { product_id: '', quantity: 1, unit_price: 0, unit: 'Pieces' }]);
        else if (type === 'stationery') setStationeryItems([...stationeryItems, { product_id: '', quantity: 1, unit_price: 0, unit: 'Pieces' }]);
        else setGeneralItems([...generalItems, { product_id: '', quantity: 1, unit_price: 0, unit: 'Pieces' }]);
    };

    const removeItem = (type: 'raw' | 'pkg' | 'lab' | 'factory' | 'stationery' | 'general', index: number) => {
        if (type === 'raw') {
            if (rawItems.length === 1) setRawItems([{ product_id: '', quantity: 1, unit_price: 0, unit: 'Pieces' }]);
            else setRawItems(rawItems.filter((_, i) => i !== index));
        } else if (type === 'pkg') {
            if (pkgItems.length === 1) setPkgItems([{ product_id: '', quantity: 1, unit_price: 0, unit: 'Pieces' }]);
            else setPkgItems(pkgItems.filter((_, i) => i !== index));
        } else if (type === 'lab') {
            if (labItems.length === 1) setLabItems([{ product_id: '', quantity: 1, unit_price: 0, unit: 'Pieces' }]);
            else setLabItems(labItems.filter((_, i) => i !== index));
        } else if (type === 'factory') {
            if (factoryItems.length === 1) setFactoryItems([{ product_id: '', quantity: 1, unit_price: 0, unit: 'Pieces' }]);
            else setFactoryItems(factoryItems.filter((_, i) => i !== index));
        } else if (type === 'stationery') {
            if (stationeryItems.length === 1) setStationeryItems([{ product_id: '', quantity: 1, unit_price: 0, unit: 'Pieces' }]);
            else setStationeryItems(stationeryItems.filter((_, i) => i !== index));
        } else {
            if (generalItems.length === 1) setGeneralItems([{ product_id: '', quantity: 1, unit_price: 0, unit: 'Pieces' }]);
            else setGeneralItems(generalItems.filter((_, i) => i !== index));
        }
    };

    const updateItem = (type: 'raw' | 'pkg' | 'lab' | 'factory' | 'stationery' | 'general', index: number, field: keyof POItem, value: any) => {
        if (type === 'raw') {
            const newItems = [...rawItems];
            newItems[index] = { ...newItems[index], [field]: value };
            setRawItems(newItems);
        } else if (type === 'pkg') {
            const newItems = [...pkgItems];
            newItems[index] = { ...newItems[index], [field]: value };
            setPkgItems(newItems);
        } else if (type === 'lab') {
            const newItems = [...labItems];
            newItems[index] = { ...newItems[index], [field]: value };
            setLabItems(newItems);
        } else if (type === 'factory') {
            const newItems = [...factoryItems];
            newItems[index] = { ...newItems[index], [field]: value };
            setFactoryItems(newItems);
        } else if (type === 'stationery') {
            const newItems = [...stationeryItems];
            newItems[index] = { ...newItems[index], [field]: value };
            setStationeryItems(newItems);
        } else {
            const newItems = [...generalItems];
            newItems[index] = { ...newItems[index], [field]: value };
            setGeneralItems(newItems);
        }
    };

    const calculateTotal = () => {
        const rawTotal = rawItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
        const pkgTotal = pkgItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
        const labTotal = labItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
        const factoryTotal = factoryItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
        const stationeryTotal = stationeryItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
        const generalTotal = generalItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
        return rawTotal + pkgTotal + labTotal + factoryTotal + stationeryTotal + generalTotal;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!supplierId) {
            toast.error('Please select a supplier');
            return;
        }

        const validRaw = rawItems.filter(item => item.product_id && item.quantity > 0);
        const validPkg = pkgItems.filter(item => item.product_id && item.quantity > 0);
        const validLab = labItems.filter(item => item.product_id && item.quantity > 0);
        const validFactory = factoryItems.filter(item => item.product_id && item.quantity > 0);
        const validStationery = stationeryItems.filter(item => item.product_id && item.quantity > 0);
        const validGeneral = generalItems.filter(item => item.product_id && item.quantity > 0);
        const allItems = [...validRaw, ...validPkg, ...validLab, ...validFactory, ...validStationery, ...validGeneral];

        if (allItems.length === 0) {
            toast.error('Please add at least one product');
            return;
        }

        setLoading(true);
        try {
            await onSave({
                id: initialData?.id,
                supplier_id: supplierId,
                po_number: poNumber,
                currency,
                total_amount: calculateTotal(),
                status: initialData?.status || 'Pending',
                items: allItems
            });
            onClose();
        } catch (error: any) {
            console.error('Error saving PO:', error);
        } finally {
            setLoading(false);
        }
    };

    const getClonedContent = () => {
        const printContent = printRef.current;
        if (!printContent) return null;

        const clonedContent = printContent.cloneNode(true) as HTMLElement;

        // Inline all SVG icons (Lucide renders as inline SVGs)
        const originalSvgs = printContent.querySelectorAll('svg');
        const clonedSvgs = clonedContent.querySelectorAll('svg');
        originalSvgs.forEach((svg, i) => {
            if (clonedSvgs[i]) {
                clonedSvgs[i].setAttribute('xmlns', 'http://www.w3.org/2000/svg');
            }
        });

        return clonedContent;
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
        .po-meta { display: flex; flex-direction: column; gap: 4px; }
        .meta-row { display: flex; justify-content: flex-end; gap: 10px; font-size: 11px; }
        .meta-row .label { color: #64748b; font-weight: 500; }
        .meta-row .value { color: #0f172a; font-weight: 700; }
        .status-badge { padding: 1px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
        .status-badge.pending { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
        .status-badge.approved { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
        .status-badge.sent { background: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; }
        .status-badge.received { background: #f3e8ff; color: #6b21a8; border: 1px solid #e9d5ff; }
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
        .total-label { text-align: right; font-weight: 700; font-size: 11px; padding: 8px 10px; color: #475569; }
        .total-value { text-align: right; font-weight: 700; font-size: 11px; padding: 8px 10px; }
        .grand-total-row td { padding: 12px 10px !important; background: #f8fafc; border-top: 2px solid #1a1a1a !important; border-bottom: 2px solid #1a1a1a !important; }
        .grand-total-row .total-label { color: #0f172a; font-size: 11px; }
        .grand-total-row .total-value { font-size: 11px; color: #1d4ed8; }
        .no-border { border: none !important; background: transparent !important; }
        .doc-footer { display: grid; grid-template-columns: 1.5fr 1fr; gap: 60px; margin-top: auto; padding-top: 40px; }
        .notes-box h4 { font-size: 11px; font-weight: 800; margin: 0 0 10px 0; color: #1e293b; text-transform: uppercase; }
        .notes-box ul { padding-left: 14px; margin: 0; }
        .notes-box li { font-size: 11px; color: #475569; margin-bottom: 4px; line-height: 1.4; }
        .signatures { display: flex; flex-direction: column; gap: 40px; }
        .sig-block { text-align: center; }
        .sig-line { border-bottom: 1px solid #1a1a1a; margin-bottom: 6px; }
        .sig-block p { font-size: 11px; font-weight: 700; color: #334155; text-transform: uppercase; }
        .page-footer { margin-top: 50px; padding-top: 15px; border-top: 1px solid #eee; text-align: center; font-size: 11px; color: #94a3b8; }
    `;

    const handleDownloadPDF = async () => {
        const clonedContent = getClonedContent();
        if (!clonedContent) return;

        // Create an off-screen container with styles applied
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
                    filename: `${poNumber}.pdf`,
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
            toast.error('Please allow pop-ups to print the PO.');
            return;
        }

        const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Purchase Order - ${poNumber}</title>
    <style>
        ${docStyles}
        @media print {
            body { background: white; }
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

    const isViewOnly = mode === 'view';

    if (isViewOnly) {
        return (
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                title="Purchase Order Detail"
                width={1000}
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
                                <Printer size={16} /> Print PO
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
                                    <h2>PURCHASE ORDER</h2>
                                    <div className="po-meta">
                                        <div className="meta-row">
                                            <span className="label">PO Number:</span>
                                            <span className="value">{poNumber}</span>
                                        </div>
                                        <div className="meta-row">
                                            <span className="label">Date:</span>
                                            <span className="value">{new Date(initialData?.created_at || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                        </div>
                                        <div className="meta-row">
                                            <span className="label">Status:</span>
                                            <span className={`status-badge ${initialData?.status?.toLowerCase()}`}>{initialData?.status}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="doc-addresses">
                                <div className="address-block">
                                    <h3>VENDOR / SUPPLIER</h3>
                                    <div className="address-content">
                                        <strong>{selectedSupplier?.name}</strong>
                                        {selectedSupplier?.contact_person && <p>Attn: {selectedSupplier.contact_person}</p>}
                                        {selectedSupplier?.address && <p>{selectedSupplier.address}</p>}
                                        {selectedSupplier?.phone && <p>Phone: {selectedSupplier.phone}</p>}
                                        {selectedSupplier?.email && <p>Email: {selectedSupplier.email}</p>}
                                    </div>
                                </div>
                                <div className="address-block">
                                    <h3>SHIP TO</h3>
                                    <div className="address-content">
                                        <strong>ASPEE PHARMACEUTICALS LTD</strong>
                                        <p>Warehouse Dept. (Store Manager)</p>
                                        <p>Ejisu - Asamang</p>
                                        <p>Phone: 0244791052</p>
                                    </div>
                                </div>
                            </div>

                            {/* Items Table - Unified */}
                            <div className="doc-items">
                                <table className="items-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '40px' }}>#</th>
                                            <th>Description / Item Name</th>
                                            <th style={{ width: '100px' }}>Material Type</th>
                                            <th style={{ width: '60px' }}>Unit</th>
                                            <th style={{ width: '80px', textAlign: 'right' }}>Qty</th>
                                            <th style={{ width: '100px', textAlign: 'right' }}>Unit Price (GH₵)</th>
                                            <th style={{ width: '120px', textAlign: 'right' }}>Total (GH₵)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[
                                            ...rawItems.filter(i => i.product_id), 
                                            ...pkgItems.filter(i => i.product_id),
                                            ...labItems.filter(i => i.product_id),
                                            ...factoryItems.filter(i => i.product_id),
                                            ...stationeryItems.filter(i => i.product_id),
                                            ...generalItems.filter(i => i.product_id)
                                        ].map((item, idx) => (
                                            <tr key={idx}>
                                                <td>{idx + 1}</td>
                                                <td>
                                                    <div className="item-name">{item.product?.name || products.find(p => p.id === item.product_id)?.name}</div>
                                                    <div className="item-sku">{item.product?.sku || products.find(p => p.id === item.product_id)?.sku}</div>
                                                </td>
                                                <td>{item.product?.material_type || products.find(p => p.id === item.product_id)?.material_type}</td>
                                                <td>{item.unit || item.product?.unit || products.find(p => p.id === item.product_id)?.unit || 'Pieces'}</td>
                                                <td style={{ textAlign: 'right' }}>{item.quantity}</td>
                                                <td style={{ textAlign: 'right' }}>{item.unit_price.toFixed(2)}</td>
                                                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{(item.quantity * item.unit_price).toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr>
                                            <td colSpan={5} className="no-border"></td>
                                            <td className="total-label">SUBTOTAL</td>
                                            <td className="total-value">{calculateTotal().toFixed(2)}</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={5} className="no-border"></td>
                                            <td className="total-label">TAX (0%)</td>
                                            <td className="total-value">0.00</td>
                                        </tr>
                                        <tr className="grand-total-row">
                                            <td colSpan={5} className="no-border"></td>
                                            <td className="total-label">GRAND TOTAL</td>
                                            <td className="total-value">GH₵ {calculateTotal().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            <div className="doc-footer">
                                <div className="notes-box">
                                    <h4>Terms & Conditions</h4>
                                    <ul>
                                        <li>Please include PO number on all invoices and shipping documents.</li>
                                        <li>Goods should be delivered between 8:00 AM and 4:00 PM.</li>
                                        <li>This order is valid for 30 days from the date of issue.</li>
                                    </ul>
                                </div>
                                <div className="signatures">
                                    <div className="sig-block">
                                        <div className="sig-line"></div>
                                        <p>Prepared By</p>
                                    </div>
                                    <div className="sig-block">
                                        <div className="sig-line"></div>
                                        <p>Authorized Signature</p>
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
            </Modal>
        );
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={mode === 'edit' ? 'Edit Purchase Order' : 'Create Purchase Order'}
            subtitle={mode === 'edit' ? 'Modify the details of this purchase order' : 'Draft a new purchase order for your suppliers'}
            width={1200}
        >
            <form onSubmit={handleSubmit} className="grn-form">
                <div className="form-section">
                    <h4 className="section-title">
                        <ClipboardList size={16} />
                        Purchase Order Details
                    </h4>

                    <div className="form-grid-3">
                        <div className="form-field">
                            <label>PO Number</label>
                            <div className="input-wrapper">
                                <Hash size={16} className="icon" />
                                <input value={poNumber} readOnly />
                            </div>
                        </div>

                        <div className="form-field">
                            <label>Supplier *</label>
                            <div className="input-wrapper">
                                <User size={16} className="icon" />
                                <select
                                    required
                                    value={supplierId}
                                    onChange={(e) => setSupplierId(e.target.value)}
                                >
                                    <option value="">Select a supplier</option>
                                    {suppliers.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="form-field">
                            <label>Currency</label>
                            <div className="input-wrapper">
                                <Banknote size={16} className="icon" />
                                <select
                                    value={currency}
                                    onChange={(e) => setCurrency(e.target.value)}
                                >
                                    <option value="GHS">GHS (GH₵)</option>
                                    <option value="USD">USD ($)</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="form-section">
                    <h4 className="section-title">
                        <Package size={16} />
                        Order Items
                    </h4>

                    <div className="po-table-actions-bar">
                        <div className="add-item-buttons">
                            <button type="button" onClick={() => addItem('raw')} className="btn-add-table-item raw"><Plus size={14} /> Raw</button>
                            <button type="button" onClick={() => addItem('pkg')} className="btn-add-table-item pkg"><Plus size={14} /> Pkg</button>
                            <button type="button" onClick={() => addItem('lab')} className="btn-add-table-item lab"><Plus size={14} /> Lab</button>
                            <button type="button" onClick={() => addItem('factory')} className="btn-add-table-item factory"><Plus size={14} /> Factory</button>
                            <button type="button" onClick={() => addItem('stationery')} className="btn-add-table-item stats"><Plus size={14} /> Stationery</button>
                            <button type="button" onClick={() => addItem('general')} className="btn-add-table-item general"><Plus size={14} /> General</button>
                        </div>
                        
                        <div className="quick-add-utility">
                            <span className="util-label">Quick Add To Master:</span>
                            <div className="util-fields">
                                <input 
                                    type="text" 
                                    placeholder="New Product Name..." 
                                    value={quickAddName}
                                    onChange={(e) => setQuickAddName(e.target.value)}
                                    className="util-input"
                                />
                                <select 
                                    className="util-select"
                                    onChange={(e) => {
                                        if (e.target.value) {
                                            handleQuickAdd(e.target.value as any);
                                        }
                                    }}
                                    defaultValue=""
                                >
                                    <option value="" disabled>Select Type to Save</option>
                                    <option value="Raw Material">Raw Material</option>
                                    <option value="Packaging Material">Packaging Material</option>
                                    <option value="Lab Consumables">Lab Consumables</option>
                                    <option value="Factory Consumables">Factory Consumables</option>
                                    <option value="Stationery & Printing Accessories">Stationery</option>
                                    <option value="General Consumables">General Items</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="items-table-wrapper">
                        <table className="items-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '40px' }}>#</th>
                                    <th style={{ width: '140px' }}>Category</th>
                                    <th>Product / Item Name</th>
                                    <th style={{ width: '110px' }}>Unit</th>
                                    <th style={{ width: '100px' }}>Quantity</th>
                                    <th style={{ width: '150px' }}>Unit Price</th>
                                    <th style={{ width: '120px', textAlign: 'right' }}>Total</th>
                                    <th style={{ width: '45px' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    { type: 'raw', items: rawItems, label: 'Raw Material', color: 'teal' },
                                    { type: 'pkg', items: pkgItems, label: 'Packaging', color: 'amber' },
                                    { type: 'lab', items: labItems, label: 'Lab Consumable', color: 'purple' },
                                    { type: 'factory', items: factoryItems, label: 'Factory Consumable', color: 'red' },
                                    { type: 'stationery', items: stationeryItems, label: 'Stationery', color: 'green' },
                                    { type: 'general', items: generalItems, label: 'General', color: 'slate' }
                                ].map((group, groupIdx) => (
                                    group.items.map((item, index) => {
                                        const totalIdx = [
                                            ...[...Array(groupIdx)].map((_, i) => [rawItems, pkgItems, labItems, factoryItems, stationeryItems][i]?.length || 0)
                                        ].reduce((a, b) => a + b, 0) + index + 1;

                                        return (
                                            <tr key={`${group.type}-${index}`}>
                                                <td className="text-slate-400 font-mono text-xs">{totalIdx}</td>
                                                <td>
                                                    <span className={`cat-badge ${group.color}`}>{group.label}</span>
                                                </td>
                                                <td>
                                                    <select
                                                        required={group.items.some(i => i.product_id || i.quantity > 0)}
                                                        value={item.product_id}
                                                        onChange={(e) => {
                                                            const pId = e.target.value;
                                                            updateItem(group.type as any, index, 'product_id', pId);
                                                            const selectedProduct = products.find(p => p.id === pId);
                                                            if (selectedProduct && selectedProduct.unit) {
                                                                updateItem(group.type as any, index, 'unit', selectedProduct.unit);
                                                            }
                                                        }}
                                                        className="qa-status-select"
                                                        style={{ textAlign: 'left' }}
                                                    >
                                                        <option value="">Select {group.label}</option>
                                                        {products.filter(p => p.material_type === (group.type === 'raw' ? 'Raw Material' : group.type === 'pkg' ? 'Packaging Material' : group.type === 'lab' ? 'Lab Consumables' : group.type === 'factory' ? 'Factory Consumables' : group.type === 'stationery' ? 'Stationery & Printing Accessories' : 'General Consumables')).map(p => (
                                                            <option key={p.id} value={p.id}>{p.name}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td>
                                                    <select
                                                        value={item.unit}
                                                        onChange={(e) => updateItem(group.type as any, index, 'unit', e.target.value)}
                                                        className="qa-status-select"
                                                        style={{ textAlign: 'left' }}
                                                    >
                                                        {GROUPED_UNIT_OPTIONS.map(g => (
                                                            <optgroup key={g.label} label={g.label}>
                                                                {g.units.map(u => (
                                                                    <option key={u} value={u}>{u}</option>
                                                                ))}
                                                            </optgroup>
                                                        ))}
                                                    </select>
                                                    {item.product_id && (() => {
                                                        const prod = products.find(p => p.id === item.product_id);
                                                        if (prod && prod.unit && prod.unit !== item.unit) {
                                                            return <UnitConversionHint value={item.quantity} fromUnit={item.unit} toUnit={prod.unit} compact />;
                                                        }
                                                        return null;
                                                    })()}
                                                </td>
                                                <td>
                                                    <input
                                                        required
                                                        type="number"
                                                        min="0"
                                                        value={item.quantity || ''}
                                                        onChange={(e) => updateItem(group.type as any, index, 'quantity', parseFloat(e.target.value) || 0)}
                                                        className="qty-input"
                                                        placeholder="0"
                                                    />
                                                </td>
                                                <td>
                                                    <div className="price-input-container">
                                                        <span className="currency-label">{currency === 'GHS' ? '₵' : '$'}</span>
                                                        <input
                                                            required
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            value={item.unit_price || ''}
                                                            onChange={(e) => updateItem(group.type as any, index, 'unit_price', parseFloat(e.target.value) || 0)}
                                                            className="qty-input"
                                                            style={{ paddingLeft: '24px' }}
                                                            placeholder="0.00"
                                                        />
                                                    </div>
                                                </td>
                                                <td className="text-right font-bold text-slate-900">
                                                    {formatCurrency(item.quantity * item.unit_price, currency)}
                                                </td>
                                                <td>
                                                    <button type="button" onClick={() => removeItem(group.type as any, index)} className="btn-remove-row">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="summary-row">
                        <div className="summary-item">
                            <span className="summary-label">Total Amount:</span>
                            <span className="summary-value">
                                {formatCurrency(calculateTotal(), currency)}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="form-actions">
                    <button type="button" onClick={onClose} className="btn-cancel">
                        Cancel
                    </button>
                    <button type="submit" className="btn-submit" disabled={loading || fetching || creatingProduct}>
                        {loading ? (
                            'Saving...'
                        ) : (
                            <>
                                <Save size={16} />
                                {mode === 'edit' ? 'Update PO' : 'Create Purchase Order'}
                            </>
                        )}
                    </button>
                    {mode !== 'create' && (
                        <button
                            type="button"
                            onClick={openPrintWindow}
                            className="btn-print"
                        >
                            <Printer size={16} />
                            Print PO
                        </button>
                    )}
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

                /* PO Specific Table Styles */
                .po-table-actions-bar {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 12px;
                    gap: 16px;
                }

                .add-item-buttons {
                    display: flex;
                    gap: 8px;
                    flex-wrap: wrap;
                }

                .btn-add-table-item {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 8px 12px;
                    border-radius: 8px;
                    font-size: 10px;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .btn-add-table-item.raw { background: var(--teal-50); color: var(--teal-700); border: 1px solid var(--teal-100); }
                .btn-add-table-item.pkg { background: var(--amber-50); color: var(--amber-700); border: 1px solid var(--amber-100); }
                .btn-add-table-item.lab { background: var(--purple-50); color: var(--purple-700); border: 1px solid var(--purple-100); }
                .btn-add-table-item.factory { background: var(--red-50); color: var(--red-700); border: 1px solid var(--red-100); }
                .btn-add-table-item.stats { background: var(--green-50); color: var(--green-700); border: 1px solid var(--green-100); }
                .btn-add-table-item.general { background: var(--slate-50); color: var(--slate-700); border: 1px solid var(--slate-200); }

                .quick-add-utility {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 8px 16px;
                    background: var(--slate-50);
                    border-radius: 12px;
                    border: 1px solid var(--slate-100);
                }

                .util-label {
                    font-size: 10px;
                    font-weight: 700;
                    color: var(--slate-500);
                    text-transform: uppercase;
                }

                .util-fields {
                    display: flex;
                    gap: 8px;
                }

                .util-input, .util-select {
                    padding: 6px 10px;
                    border: 1px solid var(--slate-200);
                    border-radius: 6px;
                    font-size: 10px;
                    background: var(--card-bg);
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
                    font-size: 10px;
                    font-weight: 700;
                    text-transform: uppercase;
                    color: var(--slate-500);
                    background: var(--slate-50);
                    border-bottom: 1px solid var(--slate-200);
                    white-space: nowrap;
                }

                .items-table td {
                    padding: 8px 10px;
                    border-bottom: 1px solid var(--slate-100);
                    vertical-align: middle;
                }

                .cat-badge {
                    display: inline-flex;
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-size: 9px;
                    font-weight: 700;
                    text-transform: uppercase;
                }

                .cat-badge.teal { background: #E0F2F1; color: #00796B; }
                .cat-badge.amber { background: #FFF8E1; color: #F57F17; }
                .cat-badge.purple { background: #F3E5F5; color: #7B1FA2; }
                .cat-badge.red { background: #FFEBEE; color: #C62828; }
                .cat-badge.green { background: #E8F5E9; color: #2E7D32; }
                .cat-badge.slate { background: #F8FAFC; color: #475569; }

                .qty-input, .qa-status-select {
                    width: 100%;
                    padding: 8px 10px;
                    border: 1px solid var(--slate-200);
                    border-radius: 6px;
                    font-size: 11px;
                    background: var(--card-bg);
                }

                .price-input-container {
                    position: relative;
                    display: flex;
                    align-items: center;
                }

                .currency-label {
                    position: absolute;
                    left: 10px;
                    font-size: 11px;
                    color: var(--slate-400);
                }

                .btn-remove-row {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 28px;
                    height: 28px;
                    border-radius: 6px;
                    border: none;
                    background: #FEF2F2;
                    color: #EF4444;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .btn-remove-row:hover {
                    background: #FEE2E2;
                    transform: scale(1.1);
                }

                .summary-row {
                    display: flex;
                    justify-content: flex-end;
                    gap: 32px;
                    padding: 16px 24px;
                    background: var(--slate-50);
                    border-radius: 12px;
                    margin-top: 12px;
                }

                .summary-item {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .summary-label {
                    font-size: 12px;
                    font-weight: 600;
                    color: var(--slate-500);
                }

                .summary-value {
                    font-size: 18px;
                    font-weight: 700;
                    color: var(--primary-600);
                }

                .form-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                    padding-top: 24px;
                    border-top: 1px solid var(--slate-100);
                    margin-top: 8px;
                }

                .btn-cancel, .btn-submit, .btn-print {
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

                .btn-submit {
                    background: linear-gradient(135deg, var(--primary-600), var(--primary-500));
                    border: none;
                    color: white;
                }

                .btn-print {
                    background: var(--card-bg);
                    border: 1px solid var(--primary-200);
                    color: var(--primary-600);
                }

                .btn-submit:hover:not(:disabled) {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
                }
                
                @media (max-width: 1024px) {
                    .po-table-actions-bar {
                        flex-direction: column;
                        align-items: flex-start;
                    }
                }
            `}</style>
        </Modal>
    );
}
