'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Modal from './Modal';
import { ClipboardList, Package, Save, Search, Trash2, User, Truck, MapPin, Phone, Mail, ArrowLeft, Download, Printer, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { reconcileVanStockFromWaybills } from '@/lib/vanStock';

interface SalesRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    editingRequest?: any;
    readOnly?: boolean;
    currentUser?: any;
    isStoreSection?: boolean;
}

interface SalesProfile {
    id: string;
    full_name: string;
    name?: string | null;
    email?: string | null;
}

interface SalesRoute {
    id: string;
    van_id: string;
    driver_name?: string | null;
    route_area?: string | null;
}

interface Product {
    id: string;
    name: string;
    sku: string;
    unit?: string | null;
    material_type?: string | null;
    unit_price?: number | null;
    cash_price?: number | null;
    units_per_carton?: number | null;
    unit_label?: string | null;
}

interface RequestItem {
    product_id: string;
    product?: Product;
    quantity_requested: number;
    quantity_approved?: number;
    quantity_issued?: number;
    notes: string;
}

const getSingleRelation = <T,>(value: T | T[] | null | undefined): T | null => {
    if (Array.isArray(value)) return value[0] ?? null;
    return value ?? null;
};

const normalizeSearchText = (value: unknown) => String(value ?? '').trim().toLowerCase();

export default function SalesRequestModal({
    isOpen,
    onClose,
    onSuccess,
    editingRequest,
    readOnly = false,
    currentUser,
    isStoreSection = false,
}: SalesRequestModalProps) {
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [requestNumber, setRequestNumber] = useState('');
    const [salespersonId, setSalespersonId] = useState('');
    const [routeId, setRouteId] = useState('');
    const [notes, setNotes] = useState('');
    const [status, setStatus] = useState('PENDING');
    const [items, setItems] = useState<RequestItem[]>([]);

    const [salespeople, setSalespeople] = useState<SalesProfile[]>([]);
    const [routes, setRoutes] = useState<SalesRoute[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);
    const printRef = useRef<HTMLDivElement>(null);

    const isEditing = !!editingRequest;
    const currentStatus = editingRequest?.status || 'PENDING';

    useEffect(() => {
        if (!isOpen) return;

        void fetchReferenceData();

        if (editingRequest) {
            hydrateForm(editingRequest);
        } else {
            resetForm();
        }
    }, [isOpen, editingRequest]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchReferenceData = async () => {
        setFetching(true);
        try {
            const [{ data: salesProfiles, error: profilesError }, { data: vanRoutes, error: routesError }, { data: finishedGoods, error: productsError }] = await Promise.all([
                supabase.from('system_users').select('id, name, email').eq('status', 'Active').in('role', ['Van Sales Rep', 'Sales Manager']).order('name'),
                supabase.from('vans').select('id, van_id, driver_name, route_area').neq('status', 'Maintenance').order('van_id'),
                supabase.from('products').select('id, name, sku, unit, material_type, cash_price, units_per_carton, unit_label').eq('material_type', 'Finished Good').order('name'),
            ]);

            if (profilesError) throw profilesError;
            if (routesError) throw routesError;
            if (productsError) throw productsError;

            const nextSalespeople = (salesProfiles || []).map((profile: any) => ({
                ...profile,
                name: profile.name || profile.full_name || '',
                full_name: profile.name || profile.full_name || '',
            }));
            const nextRoutes = vanRoutes || [];

            setSalespeople(nextSalespeople as any);
            setRoutes(nextRoutes);
            setProducts(finishedGoods || []);

            if (!editingRequest) {
                const matchedSalesperson = nextSalespeople.find((profile: any) =>
                    (normalizeSearchText(currentUser?.email) && normalizeSearchText(profile.email) === normalizeSearchText(currentUser?.email)) ||
                    (normalizeSearchText(currentUser?.name) && normalizeSearchText(profile.full_name) === normalizeSearchText(currentUser?.name))
                );

                if (matchedSalesperson) {
                    setSalespersonId(matchedSalesperson.id);

                    const matchedRoute = nextRoutes.find((route) =>
                        normalizeSearchText(route.driver_name) && normalizeSearchText(route.driver_name) === normalizeSearchText(matchedSalesperson.full_name)
                    );

                    if (matchedRoute) {
                        setRouteId(matchedRoute.id);
                    }
                }
            }
        } catch (error: any) {
            toast.error('Failed to load request references: ' + error.message);
        } finally {
            setFetching(false);
        }
    };

    const fetchRequestItems = async (requestId: string) => {
        setFetching(true);
        try {
            const { data, error } = await supabase
                .from('requisition_items')
                .select(`
                    id,
                    product_id,
                    quantity_requested,
                    quantity_approved,
                    quantity_issued,
                    notes,
                    product:products(id, name, sku, unit, material_type)
                `)
                .eq('requisition_id', requestId)
                .order('created_at', { ascending: true });

            if (error) throw error;

            setItems(
                (data || []).map((item: any) => ({
                    product_id: item.product_id,
                    product: getSingleRelation<Product>(item.product) || undefined,
                    quantity_requested: Number(item.quantity_requested) || 0,
                    quantity_approved: Number(item.quantity_approved) || 0,
                    quantity_issued: Number(item.quantity_issued) || 0,
                    notes: item.notes || '',
                }))
            );
        } catch (error: any) {
            toast.error('Failed to load request items: ' + error.message);
        } finally {
            setFetching(false);
        }
    };

    const generateRequestNumber = () => {
        const year = new Date().getFullYear();
        const random = Math.random().toString(36).slice(2, 6).toUpperCase();
        setRequestNumber(`SRQ-${year}-${random}`);
    };

    const hydrateForm = (request: any) => {
        setRequestNumber(request.requisition_number || '');
        setSalespersonId(request.salesperson_id || getSingleRelation<any>(request.salesperson)?.id || '');
        setRouteId(request.route_id || getSingleRelation<any>(request.route)?.id || '');
        setNotes(request.notes || '');
        setStatus(request.status || 'PENDING');

        if (request.items?.length) {
            setItems(
                request.items.map((item: any) => ({
                    product_id: item.product_id,
                    product: getSingleRelation<Product>(item.product) || item.product || undefined,
                    quantity_requested: Number(item.quantity_requested) || 0,
                    quantity_approved: Number(item.quantity_approved) || 0,
                    quantity_issued: Number(item.quantity_issued) || 0,
                    notes: item.notes || '',
                }))
            );
        } else if (request.id) {
            void fetchRequestItems(request.id);
        } else {
            setItems([]);
        }
    };

    const resetForm = () => {
        generateRequestNumber();
        setSalespersonId('');
        setRouteId('');
        setNotes('');
        setStatus('PENDING');
        setItems([]);
        setSearchTerm('');
        setShowDropdown(false);
    };

    const addProduct = (product: Product) => {
        setItems((prev) => [
            ...prev,
            {
                product_id: product.id,
                product,
                quantity_requested: 1,
                notes: '',
            },
        ]);
        setSearchTerm('');
        setShowDropdown(false);
    };

    const removeItem = (index: number) => {
        setItems((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
    };

    const updateItem = (index: number, updates: Partial<RequestItem>) => {
        setItems((prev) => {
            const next = [...prev];
            next[index] = { ...next[index], ...updates };
            return next;
        });
    };

    const handleSubmit = async (event: React.FormEvent, overrideStatus?: string, overrideItems?: RequestItem[]) => {
        if (event) event.preventDefault();

        if (readOnly) return;
        
        const finalItems = overrideItems || items;

        if (!salespersonId) {
            toast.error('Select the salesperson making this request');
            return;
        }
        if (finalItems.length === 0) {
            toast.error('Add at least one finished good to request');
            return;
        }
        if (finalItems.some((item) => !item.product_id || Number(item.quantity_requested) <= 0)) {
            toast.error('Each line must have a product and a quantity above zero');
            return;
        }

        const finalStatus = overrideStatus || status;

        setLoading(true);
        try {
            let requisitionId = editingRequest?.id;

            if (isEditing) {
                const { error: updateError } = await supabase
                    .from('requisitions')
                    .update({
                        salesperson_id: salespersonId,
                        route_id: routeId || null,
                        notes,
                        status: finalStatus,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', editingRequest.id);

                if (updateError) throw updateError;

                const { error: deleteItemsError } = await supabase
                    .from('requisition_items')
                    .delete()
                    .eq('requisition_id', editingRequest.id);

                if (deleteItemsError) throw deleteItemsError;
            } else {
                const { data: requestRow, error: insertError } = await supabase
                    .from('requisitions')
                    .insert([{
                        requisition_number: requestNumber,
                        salesperson_id: salespersonId,
                        route_id: routeId || null,
                        notes,
                        status: finalStatus,
                        created_by: salespersonId,
                    }])
                    .select('id')
                    .single();

                if (insertError) throw insertError;
                requisitionId = requestRow.id;
            }

            const itemsToInsert = finalItems.map((item) => ({
                requisition_id: requisitionId,
                product_id: item.product_id,
                quantity_requested: Number(item.quantity_requested) || 0,
                quantity_approved: Number(item.quantity_approved) > 0 ? Number(item.quantity_approved) : null,
                quantity_issued: Number(item.quantity_issued) > 0 ? Number(item.quantity_issued) : null,
                notes: item.notes || null,
            }));

            const { error: itemsError } = await supabase.from('requisition_items').insert(itemsToInsert);
            if (itemsError) throw itemsError;

            const shouldGenerateWaybill = finalStatus === 'APPROVED' && currentStatus !== 'APPROVED';

            // Auto-generate Waybill when Sales Request is first APPROVED
            if (shouldGenerateWaybill) {
                if (!routeId) {
                    throw new Error('A route/van must be selected to generate a waybill upon approval.');
                }
                
                // 1. Resolve Sales Person Name
                const salesperson = salespeople.find(sp => sp.id === salespersonId);
                const salesPersonName = salesperson?.name || salesperson?.full_name || getSingleRelation<any>(editingRequest?.salesperson)?.name || getSingleRelation<any>(editingRequest?.salesperson)?.full_name || 'Unknown Rep';

                // 2. Generate a stable waybill number from the approved request.
                const autoWaybillNumber = `WB-${requestNumber}`;
                const waybillDate = new Date().toISOString().split('T')[0];

                // 3. Resolve Stock Location & Current Stock Levels in the Sales Van
                let stockMap = new Map<string, number>();
                const { data: van } = await supabase.from('vans').select('van_id').eq('id', routeId).single();
                if (van) {
                    const locationName = `Sales Van - ${van.van_id}`;
                    const { data: location } = await supabase.from('stock_locations').select('id').eq('name', locationName).maybeSingle();
                    if (location) {
                        const { data: stock } = await supabase.from('stock_levels').select('product_id, qty_on_hand').eq('location_id', location.id);
                        if (stock) {
                            stockMap = new Map(stock.map(s => [s.product_id, s.qty_on_hand]));
                        }
                    }
                }

                // 4. Map approved request lines to waybill items
                const approvedRequestItems = finalItems
                    .map((item) => ({
                        ...item,
                        approved_qty: Number(item.quantity_approved) || Number(item.quantity_requested) || 0,
                    }))
                    .filter((item) => item.product_id && item.approved_qty > 0);

                const approvedProductIds = Array.from(new Set(approvedRequestItems.map((item) => item.product_id)));
                const productDetailsMap = new Map(products.map((product) => [product.id, product]));
                const missingProductIds = approvedProductIds.filter((productId) => !productDetailsMap.has(productId));

                if (missingProductIds.length > 0) {
                    const { data: approvedProducts, error: approvedProductsError } = await supabase
                        .from('products')
                        .select('id, name, sku, unit, material_type, cash_price, unit_price, units_per_carton, unit_label')
                        .in('id', missingProductIds);

                    if (approvedProductsError) throw approvedProductsError;

                    for (const product of approvedProducts || []) {
                        productDetailsMap.set(product.id, product);
                    }
                }

                const activeWaybillItems = [];
                let autoGrandTotal = 0;

                for (const item of approvedRequestItems) {
                    const p = productDetailsMap.get(item.product_id) || item.product;
                    const currentStock = stockMap.get(item.product_id) || 0;
                    const qtyApproved = item.approved_qty;

                    if (p && qtyApproved > 0) {
                        const qtyReturned = currentStock;
                        const qtyReceivedFromStores = qtyApproved;
                        const totalQty = qtyReturned + qtyReceivedFromStores;
                        const price = Number(p.cash_price ?? p.unit_price ?? 0);
                        const totalValue = totalQty * price;

                        activeWaybillItems.push({
                            product_id: item.product_id,
                            current_stock: currentStock,
                            qty_returned: qtyReturned,
                            qty_received_from_stores: qtyReceivedFromStores,
                            total_qty: totalQty,
                            total_value: totalValue
                        });

                        autoGrandTotal += totalValue;
                    }
                }

                if (activeWaybillItems.length > 0) {
                    // 5. Insert Waybill Header
                    const { data: waybill, error: waybillError } = await supabase
                        .from('waybills')
                        .insert([{
                            waybill_number: autoWaybillNumber,
                            sales_person_name: salesPersonName,
                            van_id: routeId,
                            date: waybillDate,
                            grand_total: autoGrandTotal
                        }])
                        .select()
                        .single();

                    if (waybillError) throw waybillError;

                    // 6. Insert Waybill Items
                    const waybillItemsToInsert = activeWaybillItems.map(item => ({
                        waybill_id: waybill.id,
                        product_id: item.product_id,
                        current_stock: item.current_stock,
                        qty_returned: item.qty_returned,
                        qty_received_from_stores: item.qty_received_from_stores,
                        total_qty: item.total_qty,
                        total_value: item.total_value
                    }));

                    const { error: waybillItemsError } = await supabase
                        .from('waybill_items')
                        .insert(waybillItemsToInsert);

                    if (waybillItemsError) throw waybillItemsError;
                    await reconcileVanStockFromWaybills(routeId, activeWaybillItems.map(item => item.product_id));

                    toast.success(`Waybill ${autoWaybillNumber} auto-generated successfully!`);
                }
            }

            toast.success(isEditing ? 'Sales request updated' : 'Sales request submitted to Stores');
            onSuccess?.();
            onClose();
        } catch (error: any) {
            toast.error('Failed to save sales request: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const filteredProducts = useMemo(() => {
        return products.filter((product) => {
            if (items.some((item) => item.product_id === product.id)) return false;
            if (!searchTerm) return true;

            const query = normalizeSearchText(searchTerm);
            return normalizeSearchText(product.name).includes(query) || normalizeSearchText(product.sku).includes(query);
        });
    }, [items, products, searchTerm]);

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
        .company-name { font-size: 18px; font-weight: 800; margin: 0; letter-spacing: -0.02em; color: #0f172a; }
        .company-tagline { font-size: 11px; color: #64748b; font-style: italic; margin: 2px 0 10px 0; }
        .contact-details p { display: flex; align-items: center; gap: 6px; font-size: 11px; margin: 3px 0; color: #334155; }
        .contact-details svg { width: 12px; height: 12px; flex-shrink: 0; }
        .doc-type h2 { text-align: right; font-size: 20px; font-weight: 800; margin: 0 0 12px 0; letter-spacing: 0.1em; color: #0f172a; }
        .po-meta { display: flex; flex-direction: column; gap: 4px; }
        .meta-row { display: flex; justify-content: flex-end; gap: 10px; font-size: 11px; }
        .meta-row .label { color: #64748b; font-weight: 500; }
        .meta-row .value { color: #0f172a; font-weight: 700; }
        .status-badge { padding: 1px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
        .status-badge.pending { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
        .status-badge.approved { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
        .status-badge.fulfilled { background: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; }
        .status-badge.rejected { background: #fde8e8; color: #9b1c1c; border: 1px solid #fbd5d5; }
        .doc-addresses { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; margin-bottom: 40px; }
        .address-block h3 { font-size: 11px; font-weight: 800; color: #94a3b8; border-bottom: 1px solid #eee; padding-bottom: 6px; margin-bottom: 12px; letter-spacing: 0.05em; }
        .address-content { font-size: 11px; line-height: 1.5; }
        .address-content strong { display: block; font-size: 11px; margin-bottom: 4px; color: #0f172a; }
        .address-content p { margin: 1px 0; color: #334155; }
        .items-table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
        .items-table th { background: #f8fafc; padding: 12px 10px; text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #334155; border-top: 1.5px solid #1a1a1a; border-bottom: 1.5px solid #1a1a1a; }
        .items-table td { padding: 12px 10px; border-bottom: 1px solid #eee; font-size: 11px; vertical-align: middle; }
        .items-table tbody tr:last-child td { border-bottom: 1.5px solid #1a1a1a; }
        .item-name { font-weight: 600; color: #0f172a; }
        .item-sku { font-size: 11px; color: #64748b; margin-top: 1px; }
        .total-label { text-align: right; font-weight: 700; font-size: 11px; padding: 8px 10px; color: #475569; }
        .total-value { text-align: right; font-weight: 700; font-size: 11px; padding: 8px 10px; }
        .grand-total-row td { padding: 12px 10px !important; background: #f8fafc; border-top: 2px solid #1a1a1a !important; border-bottom: 2px solid #1a1a1a !important; }
        .grand-total-row .total-label { color: #0f172a; font-size: 11px; }
        .grand-total-row .total-value { font-size: 11px; color: #1d4ed8; }
        .no-border { border: none !important; background: transparent !important; }
        .doc-footer { display: flex; flex-direction: column; gap: 40px; margin-top: auto; padding-top: 40px; }
        .notes-box h4 { font-size: 11px; font-weight: 800; margin: 0 0 10px 0; color: #1e293b; text-transform: uppercase; }
        .notes-box ul { padding-left: 14px; margin: 0; }
        .notes-box li { font-size: 11px; color: #475569; margin-bottom: 4px; line-height: 1.4; }
        .signatures { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
        .sig-block { text-align: center; }
        .sig-line { border-bottom: 1px solid #1a1a1a; margin-bottom: 6px; margin-top: 25px; }
        .sig-block p { font-size: 10px; font-weight: 700; color: #334155; text-transform: uppercase; }
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
                    filename: `${requestNumber}.pdf`,
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
            toast.error('Please allow pop-ups to print the request.');
            return;
        }

        const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Sales Request - ${requestNumber}</title>
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

    const selectedSalesperson = salespeople.find((profile) => profile.id === salespersonId);
    const selectedRoute = routes.find((route) => route.id === routeId);
    const totalRequested = items.reduce((sum, item) => sum + (Number(item.quantity_requested) || 0), 0);

    if (readOnly) {
        const totalApproved = items.reduce((sum, item) => sum + (Number(item.quantity_approved) || 0), 0);
        const totalIssued = items.reduce((sum, item) => sum + (Number(item.quantity_issued) || 0), 0);
        const repName = selectedSalesperson?.name || selectedSalesperson?.full_name || getSingleRelation<any>(editingRequest?.salesperson)?.name || getSingleRelation<any>(editingRequest?.salesperson)?.full_name || 'Unknown Rep';
        const repEmail = selectedSalesperson?.email || getSingleRelation<any>(editingRequest?.salesperson)?.email || '';
        const vanIdStr = selectedRoute?.van_id || getSingleRelation<any>(editingRequest?.route)?.van_id || '';
        const routeAreaStr = selectedRoute?.route_area || getSingleRelation<any>(editingRequest?.route)?.route_area || '';
        const routeLabel = vanIdStr ? `${vanIdStr}${routeAreaStr ? ` - ${routeAreaStr}` : ''}` : 'No route assigned';

        return (
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                title="Sales Request Detail"
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
                                <Printer size={16} /> Print Request
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
                                    <h2>SALES REQUEST</h2>
                                    <div className="po-meta">
                                        <div className="meta-row">
                                            <span className="label">Request Number:</span>
                                            <span className="value">{requestNumber}</span>
                                        </div>
                                        <div className="meta-row">
                                            <span className="label">Date:</span>
                                            <span className="value">{new Date(editingRequest?.created_at || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Divided Columns */}
                            <div className="doc-addresses">
                                <div className="address-block">
                                    <h3>SALESPERSON / REQUESTED BY</h3>
                                    <div className="address-content">
                                        <strong>{repName}</strong>
                                        <p>Route/Van: {routeLabel}</p>
                                        {repEmail && <p>Email: {repEmail}</p>}
                                    </div>
                                </div>
                                <div className="address-block">
                                    <h3>ISSUING DEPARTMENT</h3>
                                    <div className="address-content">
                                        <strong>ASPEE PHARMACEUTICALS LTD</strong>
                                        <p>Stores & Dispatch Department</p>
                                        <p>Ejisu - Asamang Warehouse</p>
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
                                            <th>Product / SKU</th>
                                            <th style={{ width: '100px', textAlign: 'right' }}>Requested Qty</th>
                                            <th style={{ width: '100px', textAlign: 'right' }}>Approved Qty</th>
                                            <th style={{ width: '100px', textAlign: 'right' }}>Issued Qty</th>
                                            <th style={{ width: '60px', textAlign: 'center' }}>Unit</th>
                                            <th>Line Note</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((item, idx) => (
                                            <tr key={idx}>
                                                <td>{idx + 1}</td>
                                                <td>
                                                    <div className="item-name">{item.product?.name || 'Unknown product'}</div>
                                                    <div className="item-sku">{item.product?.sku || '-'}</div>
                                                </td>
                                                <td style={{ textAlign: 'right' }}>{item.quantity_requested.toLocaleString()}</td>
                                                <td style={{ textAlign: 'right' }}>{item.quantity_approved?.toLocaleString() ?? '0'}</td>
                                                <td style={{ textAlign: 'right' }}>{item.quantity_issued?.toLocaleString() ?? '0'}</td>
                                                <td style={{ textAlign: 'center' }}>{item.product?.unit || '-'}</td>
                                                <td>{item.notes || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="grand-total-row">
                                            <td colSpan={2} className="total-label">TOTALS</td>
                                            <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{totalRequested.toLocaleString()}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{totalApproved.toLocaleString()}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{totalIssued.toLocaleString()}</td>
                                            <td colSpan={2} className="no-border"></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            {/* Terms & Signatures */}
                            <div className="doc-footer">
                                <div className="notes-box">
                                    <h4>Loading & Dispatch Instructions</h4>
                                    <ul>
                                        <li>This requisition must be approved by the Sales Manager prior to stock issuance.</li>
                                        <li>The Store Manager must verify and record actual quantities issued in the system.</li>
                                        <li>Driver and Van Sales Representative must confirm receipt of loaded stocks upon delivery.</li>
                                        <li>Please report any stock discrepancies immediately to the Warehouse supervisor.</li>
                                    </ul>
                                </div>
                                <div className="signatures">
                                    <div className="sig-block">
                                        <div className="sig-line"></div>
                                        <p>Prepared By</p>
                                        <p style={{ fontSize: '9px', fontWeight: 'normal', color: '#64748b', textTransform: 'none', marginTop: '2px' }}>Sales Rep</p>
                                    </div>
                                    <div className="sig-block">
                                        <div className="sig-line"></div>
                                        <p>Approved By</p>
                                        <p style={{ fontSize: '9px', fontWeight: 'normal', color: '#64748b', textTransform: 'none', marginTop: '2px' }}>Sales Manager</p>
                                    </div>
                                    <div className="sig-block">
                                        <div className="sig-line"></div>
                                        <p>Issued By</p>
                                        <p style={{ fontSize: '9px', fontWeight: 'normal', color: '#64748b', textTransform: 'none', marginTop: '2px' }}>Store Manager</p>
                                    </div>
                                    <div className="sig-block">
                                        <div className="sig-line"></div>
                                        <p>Received By</p>
                                        <p style={{ fontSize: '9px', fontWeight: 'normal', color: '#64748b', textTransform: 'none', marginTop: '2px' }}>Driver / Van Rep</p>
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
            title={readOnly ? 'View Sales Request' : isEditing ? 'Edit Sales Request' : 'New Sales Request'}
            subtitle="Submit finished-goods requests from Sales to Stores"
            width={980}
            fullCanvas={false}
        >
            <form onSubmit={handleSubmit} className="sales-request-form">
                <div className="sales-request-section">
                    <h4 className="sales-request-title">
                        <ClipboardList size={16} />
                        Request Details
                    </h4>

                    <div className="sales-request-grid">
                        <div className="sales-request-field">
                            <label>Request #</label>
                            <div className="sales-request-input disabled">
                                <ClipboardList size={16} className="icon" />
                                <input value={requestNumber} readOnly />
                            </div>
                        </div>

                        <div className="sales-request-field">
                            <label>Salesperson</label>
                            <div className="sales-request-input">
                                <User size={16} className="icon" />
                                <select
                                    value={salespersonId}
                                    onChange={(e) => setSalespersonId(e.target.value)}
                                    disabled={readOnly}
                                >
                                    <option value="">Select salesperson</option>
                                    {salespeople.map((profile: any) => (
                                        <option key={profile.id} value={profile.id}>
                                            {profile.name || profile.full_name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="sales-request-field">
                            <label>Route / Van</label>
                            <div className="sales-request-input">
                                <Truck size={16} className="icon" />
                                <select
                                    value={routeId}
                                    onChange={(e) => setRouteId(e.target.value)}
                                    disabled={readOnly}
                                >
                                    <option value="">Select route</option>
                                    {routes.map((route) => (
                                        <option key={route.id} value={route.id}>
                                            {route.van_id} {route.route_area ? `- ${route.route_area}` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="sales-request-field full-width">
                            <label>Request Notes</label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={3}
                                readOnly={readOnly}
                                placeholder="Explain the van loading need, route restock reason, or urgent stock gap."
                            />
                        </div>
                    </div>

                    <div className="sales-request-meta">
                        <span>{selectedSalesperson?.name || selectedSalesperson?.full_name || 'No salesperson selected'}</span>
                        <span>{selectedRoute ? `${selectedRoute.van_id}${selectedRoute.route_area ? ` • ${selectedRoute.route_area}` : ''}` : 'No route selected'}</span>
                    </div>
                </div>

                <div className="sales-request-section">
                    <h4 className="sales-request-title">
                        <Package size={16} />
                        Requested Finished Goods
                    </h4>

                    {!readOnly && (
                        <div className="sales-request-toolbar">
                            <div className="sales-request-search" ref={searchRef}>
                                <Search size={16} className="search-icon" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    placeholder="Search finished goods by name or SKU..."
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value);
                                        setShowDropdown(true);
                                    }}
                                    onFocus={() => setShowDropdown(true)}
                                />

                                {showDropdown && (
                                    <div className="sales-request-dropdown">
                                        {filteredProducts.length > 0 ? (
                                            filteredProducts.slice(0, 10).map((product) => (
                                                <button
                                                    key={product.id}
                                                    type="button"
                                                    className="sales-request-dropdown-item"
                                                    onClick={() => addProduct(product)}
                                                >
                                                    <span className="name">{product.name}</span>
                                                    <span className="meta">{product.sku}{product.unit ? ` • ${product.unit}` : ''}</span>
                                                </button>
                                            ))
                                        ) : (
                                            <div className="sales-request-empty-search">No matching finished goods available.</div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="sales-request-summary-pill">
                                <strong>{items.length}</strong>
                                <span>{items.length === 1 ? 'line item' : 'line items'}</span>
                            </div>
                        </div>
                    )}

                    <div className="sales-request-table-wrap">
                        {items.length === 0 ? (
                            <div className="sales-request-empty">
                                {readOnly ? 'No request items were recorded for this request.' : 'Add at least one finished good to send this request to Stores.'}
                            </div>
                        ) : (
                            <table className="sales-request-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: 44 }}>#</th>
                                        <th>Product</th>
                                        <th style={{ width: 100 }}>Requested</th>
                                        {isStoreSection && (
                                            <>
                                                <th style={{ width: 100 }}>Approved</th>
                                                <th style={{ width: 100 }}>Issued</th>
                                            </>
                                        )}
                                        <th style={{ width: 80 }}>Unit</th>
                                        <th>Line Note</th>
                                        {!readOnly && <th style={{ width: 52 }} />}
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item, index) => (
                                        <tr key={`${item.product_id}-${index}`}>
                                            <td className="row-index">{index + 1}</td>
                                            <td>
                                                <div className="name">{item.product?.name || 'Unknown product'}</div>
                                                <div className="meta">{item.product?.sku || '-'}</div>
                                            </td>
                                            <td>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={item.quantity_requested}
                                                    onChange={(e) => updateItem(index, { quantity_requested: Number(e.target.value) || 0 })}
                                                    className="sales-request-qty"
                                                    readOnly={readOnly}
                                                />
                                            </td>
                                            {isStoreSection && (
                                                <>
                                                    <td>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={item.quantity_approved}
                                                            onChange={(e) => updateItem(index, { quantity_approved: Number(e.target.value) || 0 })}
                                                            className="sales-request-qty"
                                                            readOnly={readOnly}
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={item.quantity_issued}
                                                            onChange={(e) => updateItem(index, { quantity_issued: Number(e.target.value) || 0 })}
                                                            className="sales-request-qty"
                                                            readOnly={readOnly}
                                                        />
                                                    </td>
                                                </>
                                            )}
                                            <td>
                                                <span className="sales-request-unit">{item.product?.unit || '-'}</span>
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    value={item.notes}
                                                    onChange={(e) => updateItem(index, { notes: e.target.value })}
                                                    className="sales-request-note"
                                                    readOnly={readOnly}
                                                    placeholder="Optional line note"
                                                />
                                            </td>
                                            {!readOnly && (
                                                <td>
                                                    <button type="button" className="sales-request-remove" onClick={() => removeItem(index)}>
                                                        <Trash2 size={14} />
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    <div className="sales-request-footer-row">
                        <div className="sales-request-footer-stat">
                            <span className="label">Items</span>
                            <span className="value">{items.length}</span>
                        </div>
                        <div className="sales-request-footer-stat">
                            <span className="label">Total Requested</span>
                            <span className="value">{totalRequested.toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                <div className="sales-request-actions">
                    <button type="button" onClick={onClose} className="btn-cancel">
                        {readOnly ? 'Close' : 'Cancel'}
                    </button>

                    {!readOnly && (
                        <>
                            {isStoreSection && isEditing && (
                                <>
                                    {status === 'PENDING' && (
                                        <button 
                                            type="button" 
                                            onClick={() => {
                                                const updatedItems = items.map(item => ({
                                                    ...item,
                                                    quantity_approved: item.quantity_approved || item.quantity_requested
                                                }));
                                                void handleSubmit(null as any, 'APPROVED', updatedItems);
                                            }} 
                                            className="btn-approve"
                                            disabled={loading}
                                        >
                                            <CheckCircle size={16} /> Approve Request
                                        </button>
                                    )}
                                    {status === 'APPROVED' && (
                                        <button 
                                            type="button" 
                                            onClick={() => {
                                                const updatedItems = items.map(item => ({
                                                    ...item,
                                                    quantity_issued: item.quantity_issued || item.quantity_approved || item.quantity_requested
                                                }));
                                                void handleSubmit(null as any, 'FULFILLED', updatedItems);
                                            }} 
                                            className="btn-fulfil"
                                            disabled={loading}
                                        >
                                            <Package size={16} /> Mark as Fulfilled
                                        </button>
                                    )}
                                    {status !== 'REJECTED' && status !== 'FULFILLED' && (
                                        <button 
                                            type="button" 
                                            onClick={() => handleSubmit(null as any, 'REJECTED')} 
                                            className="btn-reject"
                                            disabled={loading}
                                        >
                                            <XCircle size={16} /> Reject
                                        </button>
                                    )}
                                </>
                            )}
                            
                            <button type="submit" disabled={loading || fetching} className="btn-save">
                                <Save size={16} />
                                {loading ? 'Saving...' : isEditing ? 'Update Request' : 'Submit Request'}
                            </button>
                        </>
                    )}
                </div>
            </form>

            <style>{`
                .sales-request-form {
                    display: flex;
                    flex-direction: column;
                    gap: 24px;
                    margin-top: 8px;
                }
                .sales-request-section {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }
                .sales-request-title {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin: 0;
                    padding-bottom: 8px;
                    border-bottom: 1px solid var(--slate-100);
                    font-size: 11px;
                    font-weight: 700;
                    color: var(--slate-700);
                }
                .sales-request-grid {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 18px;
                }
                .sales-request-field {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .sales-request-field label {
                    font-size: 11px;
                    font-weight: 600;
                    color: var(--slate-600);
                }
                .full-width {
                    grid-column: 1 / -1;
                }
                .sales-request-input {
                    position: relative;
                    display: flex;
                    align-items: center;
                }
                .sales-request-input .icon {
                    position: absolute;
                    left: 12px;
                    color: var(--slate-400);
                }
                .sales-request-input input,
                .sales-request-input select,
                .sales-request-field textarea,
                .sales-request-qty,
                .sales-request-note,
                .sales-request-search input {
                    width: 100%;
                    border: 1px solid var(--slate-200);
                    border-radius: 8px;
                    background: var(--card-bg);
                    color: var(--slate-900);
                    font-size: 11px;
                    outline: none;
                    transition: all 0.2s;
                }
                .sales-request-input input,
                .sales-request-input select {
                    padding: 10px 12px 10px 38px;
                }
                .sales-request-field textarea {
                    resize: vertical;
                    min-height: 88px;
                    padding: 10px 12px;
                }
                .sales-request-input input:focus,
                .sales-request-input select:focus,
                .sales-request-field textarea:focus,
                .sales-request-qty:focus,
                .sales-request-note:focus,
                .sales-request-search input:focus {
                    border-color: var(--primary-500);
                    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.08);
                }
                .disabled input {
                    background: var(--slate-50);
                    color: var(--slate-500);
                }
                .sales-request-status {
                    min-height: 40px;
                    display: flex;
                    align-items: center;
                }
                .sales-request-meta {
                    display: flex;
                    justify-content: space-between;
                    gap: 12px;
                    padding: 12px 14px;
                    border: 1px solid var(--slate-200);
                    border-radius: 10px;
                    background: var(--slate-50);
                    color: var(--slate-600);
                    font-size: 11px;
                    font-weight: 600;
                }
                .sales-request-toolbar {
                    display: flex;
                    align-items: flex-start;
                    gap: 12px;
                }
                .sales-request-search {
                    position: relative;
                    flex: 1;
                }
                .sales-request-search .search-icon {
                    position: absolute;
                    top: 50%;
                    left: 12px;
                    transform: translateY(-50%);
                    color: var(--slate-400);
                    pointer-events: none;
                }
                .sales-request-search input {
                    padding: 10px 12px 10px 38px;
                }
                .sales-request-dropdown {
                    position: absolute;
                    top: calc(100% + 8px);
                    left: 0;
                    right: 0;
                    z-index: 60;
                    border: 1px solid var(--slate-200);
                    border-radius: 10px;
                    background: white;
                    box-shadow: 0 14px 28px rgba(15, 23, 42, 0.12);
                    overflow: hidden;
                    max-height: 260px;
                    overflow-y: auto;
                }
                .sales-request-dropdown-item {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    width: 100%;
                    padding: 11px 14px;
                    border: none;
                    border-bottom: 1px solid var(--slate-100);
                    background: white;
                    text-align: left;
                    cursor: pointer;
                }
                .sales-request-dropdown-item:hover {
                    background: var(--slate-50);
                }
                .sales-request-dropdown-item .name,
                .sales-request-table .name {
                    font-weight: 600;
                    color: var(--slate-800);
                }
                .sales-request-dropdown-item .meta,
                .sales-request-table .meta {
                    font-size: 11px;
                    color: var(--slate-500);
                }
                .sales-request-empty-search,
                .sales-request-empty {
                    padding: 24px 16px;
                    text-align: center;
                    font-size: 11px;
                    color: var(--slate-400);
                }
                .sales-request-summary-pill {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px 14px;
                    border-radius: 10px;
                    border: 1px solid var(--slate-200);
                    background: var(--slate-50);
                    color: var(--slate-600);
                    white-space: nowrap;
                    font-size: 11px;
                }
                .sales-request-summary-pill strong {
                    color: var(--primary-600);
                    font-size: 15px;
                }
                .sales-request-table-wrap {
                    overflow-x: auto;
                    border: 1px solid var(--slate-200);
                    border-radius: 12px;
                    background: var(--card-bg);
                }
                .sales-request-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 11px;
                }
                .sales-request-table th {
                    padding: 12px 10px;
                    background: var(--slate-50);
                    border-bottom: 1px solid var(--slate-200);
                    color: var(--slate-500);
                    text-transform: uppercase;
                    font-size: 10px;
                    text-align: left;
                    font-weight: 700;
                }
                .sales-request-table td {
                    padding: 10px;
                    border-bottom: 1px solid var(--slate-100);
                    vertical-align: middle;
                }
                .row-index {
                    color: var(--slate-400);
                    font-family: var(--font-mono);
                    font-size: 10px;
                }
                .sales-request-qty,
                .sales-request-note {
                    padding: 8px 10px;
                }
                .sales-request-unit {
                    display: inline-flex;
                    padding: 6px 10px;
                    border-radius: 999px;
                    border: 1px solid var(--slate-200);
                    background: var(--slate-50);
                    color: var(--slate-700);
                    font-size: 10px;
                    font-weight: 700;
                }
                .sales-request-remove {
                    width: 28px;
                    height: 28px;
                    border: none;
                    border-radius: 6px;
                    background: #FEF2F2;
                    color: #DC2626;
                    cursor: pointer;
                }
                .sales-request-remove:hover {
                    background: #FEE2E2;
                }
                .sales-request-footer-row {
                    display: flex;
                    justify-content: flex-end;
                    gap: 24px;
                    padding: 14px 18px;
                    border-radius: 12px;
                    background: var(--slate-50);
                }
                .sales-request-footer-stat {
                    display: flex;
                    align-items: baseline;
                    gap: 10px;
                }
                .sales-request-footer-stat .label {
                    font-size: 11px;
                    color: var(--slate-500);
                    font-weight: 600;
                }
                .sales-request-footer-stat .value {
                    font-size: 16px;
                    color: var(--primary-600);
                    font-weight: 700;
                }
                .sales-request-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                    padding-top: 20px;
                    border-top: 1px solid var(--slate-100);
                }
                .btn-cancel {
                    padding: 10px 20px;
                    border-radius: 8px;
                    border: 1px solid var(--slate-200);
                    background: white;
                    color: var(--slate-600);
                    font-weight: 600;
                    cursor: pointer;
                }
                .btn-save {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px 20px;
                    border-radius: 8px;
                    border: none;
                    background: linear-gradient(135deg, var(--primary-600), var(--primary-500));
                    color: white;
                    font-weight: 600;
                    cursor: pointer;
                }
                .btn-approve {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px 20px;
                    border-radius: 8px;
                    border: none;
                    background: var(--teal-600);
                    color: white;
                    font-weight: 600;
                    cursor: pointer;
                }
                .btn-fulfil {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px 20px;
                    border-radius: 8px;
                    border: none;
                    background: var(--green-600);
                    color: white;
                    font-weight: 600;
                    cursor: pointer;
                }
                .btn-reject {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px 20px;
                    border-radius: 8px;
                    border: none;
                    background: var(--danger);
                    color: white;
                    font-weight: 600;
                    cursor: pointer;
                }
                .btn-save:disabled {
                    opacity: 0.7;
                    cursor: not-allowed;
                }
                @media (max-width: 900px) {
                    .sales-request-grid {
                        grid-template-columns: 1fr;
                    }
                    .sales-request-toolbar,
                    .sales-request-meta,
                    .sales-request-footer-row,
                    .sales-request-actions {
                        flex-direction: column;
                    }
                }
            `}</style>
        </Modal>
    );
}
