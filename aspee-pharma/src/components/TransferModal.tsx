'use client';

import React, { useState, useEffect, useRef } from 'react';
import Modal from './Modal';
import { 
    ArrowLeftRight, 
    MapPin, 
    Package, 
    Plus, 
    Trash2, 
    Save, 
    Calendar,
    Hash,
    FileText,
    AlertCircle,
    Download,
    Printer,
    ArrowLeft
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { ensureSalesDepartmentLocation, ensureVanStockLocation, ensureSalespersonStockLocation, getSalespersonLocationName, isSalesDepartmentLocation, isVanStockLocation, isFinishedGoodsLocation, isSalespersonStockLocation } from '@/lib/vanStock';
import { formatMixedBulk } from '@/lib/unitConversions';

interface Product {
    id: string;
    name: string;
    sku: string;
    unit: string;
    bulk_unit?: string | null;
    bulk_to_base_ratio?: number | null;
}

interface Location {
    id: string;
    name: string;
    type: string;
}

interface TransferItem {
    product_id: string;
    product?: Product;
    quantity: number;
    current_stock?: number;
}

interface TransferModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    initialData?: any;
    mode?: 'create' | 'edit' | 'view';
    flowMode?: 'general' | 'sales-van-load';
}

export default function TransferModal({ isOpen, onClose, onSave, initialData, mode = 'create', flowMode = 'general' }: TransferModalProps) {
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const isViewOnly = mode === 'view';
    const isSalesVanLoadFlow = flowMode === 'sales-van-load';
    
    const [products, setProducts] = useState<Product[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [validSalespersonLocNames, setValidSalespersonLocNames] = useState<Set<string>>(new Set());
    
    const [transferNumber, setTransferNumber] = useState('');
    const [fromLocationId, setFromLocationId] = useState('');
    const [toLocationId, setToLocationId] = useState('');
    const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0]);
    const [items, setItems] = useState<TransferItem[]>([]);
    const [notes, setNotes] = useState('');
    const printRef = useRef<HTMLDivElement>(null);

    const fromLocation = locations.find(loc => loc.id === fromLocationId);
    const toLocation = locations.find(loc => loc.id === toLocationId);
    const salesDepartmentLocation = locations.find(loc => isSalesDepartmentLocation(loc));

    // PDF generation functions
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
        styleEl.textContent = transferDocStyles;
        container.appendChild(styleEl);
        container.appendChild(clonedContent);
        document.body.appendChild(container);
        try {
            const html2pdf = (await import('html2pdf.js')).default;
            await html2pdf()
                .set({ margin: 0, filename: `${transferNumber}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true, letterRendering: true }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } })
                .from(clonedContent)
                .save();
            toast.success('PDF downloaded successfully!');
        } catch (error) {
            toast.error('Failed to download PDF');
        } finally {
            document.body.removeChild(container);
        }
    };

    const openPrintWindow = () => {
        const clonedContent = getClonedContent();
        if (!clonedContent) return;
        const printWindow = window.open('', '_blank', 'width=900,height=700');
        if (!printWindow) { toast.error('Please allow pop-ups to print'); return; }
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Transfer - ${transferNumber}</title><style>${transferDocStyles}@media print { body { background: white; } .a4-page { margin: 0; padding: 15mm 20mm; } }</style></head><body>${clonedContent.outerHTML}</body></html>`;
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.onload = () => { printWindow.focus(); printWindow.print(); };
    };

    const filteredFromLocations = locations.filter(loc => {
        if (isViewOnly) return true;
        if (loc.id === toLocationId) return false;
        if (isSalesVanLoadFlow) {
            return isSalesDepartmentLocation(loc);
        }
        if (isVanStockLocation(loc) || isSalespersonStockLocation(loc)) {
            return false;
        }
        if (toLocation && isVanStockLocation(toLocation)) {
            return isSalesDepartmentLocation(loc);
        }
        return true;
    });
    const filteredToLocations = locations.filter(loc => {
        if (isViewOnly) return true;
        if (loc.id === fromLocationId) return false;
        if (isSalesVanLoadFlow) {
            return isVanStockLocation(loc);
        }
        // Finished Goods Store → only salesperson locations for actual sales-role staff
        if (fromLocation && isFinishedGoodsLocation(fromLocation)) {
            return isSalespersonStockLocation(loc) && validSalespersonLocNames.has(loc.name);
        }
        // Vans are valid destinations from Sales Department only
        if (isVanStockLocation(loc)) {
            return fromLocation ? isSalesDepartmentLocation(fromLocation) : false;
        }
        // Salesperson locations are only reachable from Finished Goods (handled above)
        if (isSalespersonStockLocation(loc)) {
            return false;
        }
        return true;
    });

    useEffect(() => {
        if (isOpen) {
            fetchData();
            if (mode === 'create') {
                resetForm();
                generateTransferNumber().then(() => {});
            } else if (initialData) {
                populateForm(initialData);
            }
        }
    }, [isOpen, mode, initialData]);

    useEffect(() => {
        if (isOpen && mode === 'create' && isSalesVanLoadFlow && salesDepartmentLocation?.id) {
            setFromLocationId(prev => prev || salesDepartmentLocation.id);
        }
    }, [isOpen, mode, isSalesVanLoadFlow, salesDepartmentLocation?.id]);

    const fetchData = async () => {
        setFetching(true);
        try {
            const productsQuery = isSalesVanLoadFlow
                ? supabase.from('products').select('id, name, sku, unit, bulk_unit, bulk_to_base_ratio').eq('material_type', 'Finished Good').order('name')
                : supabase.from('products').select('id, name, sku, unit, bulk_unit, bulk_to_base_ratio').order('name');

            const [prodRes, vanRes, profilesRes] = await Promise.all([
                productsQuery,
                supabase.from('vans').select('id, van_id, driver_name, route_area').order('van_id'),
                supabase.from('system_users').select('id, name, role').eq('status', 'Active').in('role', ['Van Sales Rep', 'Sales Manager']).not('name', 'is', null).order('name'),
            ]);

            if (prodRes.error) throw prodRes.error;
            if (vanRes.error) throw vanRes.error;

            const salesProfiles = (profilesRes.data || []).map((p: any) => ({
                ...p,
                full_name: p.name || p.full_name || '',
            })).filter((p: any) => p.full_name?.trim());
            setValidSalespersonLocNames(new Set(salesProfiles.map((p: any) => getSalespersonLocationName(p.full_name))));

            await ensureSalesDepartmentLocation();
            await Promise.all((vanRes.data || []).map((van: any) => ensureVanStockLocation(van)));
            await Promise.all(salesProfiles.map((p: any) => ensureSalespersonStockLocation({ id: p.id, full_name: p.full_name })));

            const { data: locationsData, error: locationsError } = await supabase
                .from('stock_locations')
                .select('*')
                .order('name');
            if (locationsError) throw locationsError;

            setProducts(prodRes.data || []);
            setLocations(locationsData || []);
        } catch (error: any) {
            toast.error('Failed to fetch data: ' + error.message);
        } finally {
            setFetching(false);
        }
    };

    const generateTransferNumber = async () => {
        const date = new Date();
        const year = date.getFullYear().toString().slice(-2);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        
        // Use timestamp for uniqueness
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.floor(Math.random() * 100).toString().padStart(2, '0');
        const candidateNumber = `TRF-${year}${month}${day}-${timestamp}${random}`;
        
        // Check if number already exists
        const { data: existing } = await supabase
            .from('stock_transfers')
            .select('id')
            .eq('transfer_number', candidateNumber)
            .maybeSingle();
        
        if (existing) {
            // If exists, add extra random suffix
            const extraRandom = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
            setTransferNumber(`TRF-${year}${month}${day}-${timestamp}${extraRandom}`);
        } else {
            setTransferNumber(candidateNumber);
        }
    };

    const resetForm = () => {
        setTransferNumber('');
        setTransferDate(new Date().toISOString().split('T')[0]);
        setItems([{ product_id: '', quantity: 1 }]);
        setNotes('');
        setFromLocationId(isSalesVanLoadFlow ? (salesDepartmentLocation?.id || '') : '');
        setToLocationId('');
    };

    const populateForm = async (data: any) => {
        setTransferNumber(data.transfer_number || '');
        setFromLocationId(data.from_location_id || '');
        setToLocationId(data.to_location_id || '');
        setTransferDate(data.created_at?.split('T')[0] || new Date().toISOString().split('T')[0]);
        setNotes(data.notes || '');

        // Fetch items
        if (data.id) {
            const { data: itemsData, error } = await supabase
                .from('stock_transfer_items')
                .select('*, product:products(id, name, sku, unit)')
                .eq('transfer_id', data.id);
            
            if (error) {
                console.error('Error fetching items:', error);
            } else {
                setItems(itemsData || []);
            }
        }
    };

    const addItem = () => {
        setItems([...items, { product_id: '', quantity: 1 }]);
    };

    const removeItem = (index: number) => {
        if (items.length === 1) return;
        setItems(items.filter((_, i) => i !== index));
    };

    const updateItem = (index: number, field: keyof TransferItem, value: any) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        
        if (field === 'product_id' && value) {
            const product = products.find(p => p.id === value);
            newItems[index].product = product;
        }
        
        setItems(newItems);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!fromLocationId || !toLocationId) {
            toast.error('Please select both From and To locations');
            return;
        }

        if (fromLocationId === toLocationId) {
            toast.error('Source and Destination locations cannot be the same');
            return;
        }

        if (toLocation && isVanStockLocation(toLocation) && !fromLocation) {
            toast.error('Please select the source location first');
            return;
        }

        if (toLocation && isVanStockLocation(toLocation) && fromLocation && isVanStockLocation(fromLocation)) {
            toast.error('Cannot transfer directly between two vans.');
            return;
        }

        if (isSalesVanLoadFlow) {
            if (!isSalesDepartmentLocation(fromLocation)) {
                toast.error('This page only allows loading stock from Sales Department.');
                return;
            }
            if (!isVanStockLocation(toLocation)) {
                toast.error('This page only allows loading stock into an individual van.');
                return;
            }
        }

        const validItems = items.filter(item => item.product_id && item.quantity > 0);
        if (validItems.length === 0) {
            toast.error('Please add at least one valid item');
            return;
        }

        setLoading(true);
        try {
            await onSave({
                id: initialData?.id,
                transfer_number: transferNumber,
                from_location_id: fromLocationId,
                to_location_id: toLocationId,
                notes,
                items: validItems.map(item => ({
                    product_id: item.product_id,
                    quantity: item.quantity
                }))
            });
            onClose();
        } catch (error: any) {
            console.error('Error saving transfer:', error);
        } finally {
            setLoading(false);
        }
    };

    // View Mode - A4 PDF Style
    if (isViewOnly) {
        const totalQty = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
        
        return (
            <Modal isOpen={isOpen} onClose={onClose} title="Transfer Details" subtitle={transferNumber} width={1000} noPadding>
                <div className="a4-document-container">
                    <div className="a4-actions no-print">
                        <button onClick={onClose} className="btn-back"><ArrowLeft size={16} /> Back</button>
                        <div className="a4-action-group">
                            <button onClick={handleDownloadPDF} className="btn-download"><Download size={16} /> Download PDF</button>
                            <button onClick={openPrintWindow} className="btn-print"><Printer size={16} /> Print</button>
                        </div>
                    </div>
                    <div className="a4-preview-scroller">
                        <div className="a4-page" ref={printRef}>
                            <style dangerouslySetInnerHTML={{ __html: transferDocStyles }} />
                            
                            {/* Header */}
                            <div className="doc-header">
                                <div className="company-info">
                                    <h1 className="company-name">ASPEE PHARMACEUTICALS LTD</h1>
                                    <p className="company-tagline">Quality Healthcare for All</p>
                                    <div className="contact-details">
                                        <p><MapPin size={12} /> Ejisu - Asamang, Ashanti Region</p>
                                        <p>0244791052 / 0501234567</p>
                                    </div>
                                </div>
                                <div className="doc-type">
                                    <h2>STOCK TRANSFER</h2>
                                    <div className="transfer-meta">
                                        <div className="meta-row"><span className="label">Transfer #:</span><span className="value">{transferNumber}</span></div>
                                        <div className="meta-row"><span className="label">Date:</span><span className="value">{new Date(transferDate).toLocaleDateString('en-GB')}</span></div>
                                    </div>
                                </div>
                            </div>

                            {/* Locations */}
                            <div className="locations-section">
                                <div className="location-block">
                                    <h3>FROM</h3>
                                    <div className="location-info">
                                        <strong>{fromLocation?.name || 'N/A'}</strong>
                                        <span>{fromLocation?.type || ''}</span>
                                    </div>
                                </div>
                                <div className="arrow-icon">→</div>
                                <div className="location-block">
                                    <h3>TO</h3>
                                    <div className="location-info">
                                        <strong>{toLocation?.name || 'N/A'}</strong>
                                        <span>{toLocation?.type || ''}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Items Table */}
                            <table className="items-table">
                                <thead>
                                    <tr><th>#</th><th>Product</th><th>SKU</th><th>Unit</th><th style={{textAlign:'right'}}>Qty</th></tr>
                                </thead>
                                <tbody>
                                    {items.map((item, idx) => (
                                        <tr key={idx}>
                                            <td>{idx + 1}</td>
                                            <td style={{fontWeight:600}}>{item.product?.name || '-'}</td>
                                            <td style={{fontFamily:'monospace',fontSize:10}}>{item.product?.sku || '-'}</td>
                                            <td>{item.product?.unit || '-'}</td>
                                            <td style={{textAlign:'right',fontWeight:600}}>{item.quantity}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="grand-total-row">
                                        <td colSpan={4} style={{textAlign:'right',fontWeight:700}}>TOTAL</td>
                                        <td style={{textAlign:'right',fontWeight:700}}>{totalQty}</td>
                                    </tr>
                                </tfoot>
                            </table>

                            {/* Notes */}
                            {notes && (
                                <div className="notes-section">
                                    <h4>Notes</h4>
                                    <p>{notes}</p>
                                </div>
                            )}

                            {/* Signatures */}
                            <div className="doc-footer">
                                <div className="signatures">
                                    <div className="sig-block"><div className="sig-line"></div><p>Prepared By</p></div>
                                    <div className="sig-block"><div className="sig-line"></div><p>Checked By</p></div>
                                    <div className="sig-block"><div className="sig-line"></div><p>Received By</p></div>
                                </div>
                            </div>

                            <div className="page-footer"><p>This is a computer generated document.</p></div>
                        </div>
                    </div>
                </div>

                <style>{`
                    .a4-document-container { background: #f1f5f9; min-height: 100%; }
                    .a4-actions { display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; background: white; border-bottom: 1px solid #e2e8f0; }
                    .btn-back { display: flex; align-items: center; gap: 8px; padding: 8px 16px; border: 1px solid #e2e8f0; border-radius: 8px; background: white; font-size: 12px; cursor: pointer; }
                    .a4-action-group { display: flex; gap: 12px; }
                    .btn-download, .btn-print { display: flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; }
                    .btn-download { background: #0f172a; color: white; border: none; }
                    .btn-print { background: white; color: #0f172a; border: 1px solid #e2e8f0; }
                    .a4-preview-scroller { padding: 24px; overflow: auto; max-height: calc(100vh - 200px); display: flex; justify-content: center; }
                    .a4-page { width: 210mm; min-height: 297mm; padding: 15mm 20mm; background: white; box-shadow: 0 4px 20px rgba(0,0,0,0.15); }
                    .doc-header { display: flex; justify-content: space-between; border-bottom: 2px solid #1a1a1a; padding-bottom: 20px; margin-bottom: 24px; }
                    .company-name { font-size: 16px; font-weight: 800; margin: 0; color: #0f172a; }
                    .company-tagline { font-size: 11px; color: #64748b; font-style: italic; margin: 2px 0 8px 0; }
                    .contact-details p { font-size: 10px; margin: 2px 0; color: #334155; }
                    .doc-type h2 { text-align: right; font-size: 18px; font-weight: 800; margin: 0 0 12px 0; color: #0f172a; }
                    .transfer-meta { display: flex; flex-direction: column; gap: 4px; }
                    .meta-row { display: flex; justify-content: flex-end; gap: 10px; font-size: 11px; }
                    .meta-row .label { color: #64748b; font-weight: 500; }
                    .meta-row .value { color: #0f172a; font-weight: 700; font-family: monospace; }
                    .locations-section { display: flex; align-items: center; gap: 20px; margin-bottom: 24px; padding: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; }
                    .location-block { flex: 1; }
                    .location-block h3 { font-size: 10px; font-weight: 800; color: #64748b; margin: 0 0 8px 0; letter-spacing: 0.05em; }
                    .location-info { display: flex; flex-direction: column; gap: 2px; }
                    .location-info strong { font-size: 13px; color: #0f172a; }
                    .location-info span { font-size: 11px; color: #64748b; }
                    .arrow-icon { font-size: 24px; color: #64748b; }
                    .items-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
                    .items-table th { background: #f8fafc; padding: 10px 8px; text-align: left; font-size: 10px; font-weight: 700; color: #334155; border-top: 1.5px solid #1a1a1a; border-bottom: 1.5px solid #1a1a1a; }
                    .items-table td { padding: 12px 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; }
                    .items-table tbody tr:last-child td { border-bottom: 1.5px solid #1a1a1a; }
                    .grand-total-row td { padding: 10px 8px !important; background: #f8fafc; border-top: 2px solid #1a1a1a !important; }
                    .notes-section { margin-bottom: 20px; padding: 12px 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; }
                    .notes-section h4 { font-size: 10px; font-weight: 800; color: #64748b; margin: 0 0 6px 0; }
                    .notes-section p { font-size: 11px; color: #334155; margin: 0; }
                    .doc-footer { display: grid; grid-template-columns: 1fr; gap: 40px; margin-top: auto; padding-top: 30px; }
                    .signatures { display: flex; gap: 40px; }
                    .sig-block { text-align: center; }
                    .sig-line { border-bottom: 1px solid #1a1a1a; margin-bottom: 6px; width: 120px; }
                    .sig-block p { font-size: 10px; font-weight: 700; color: #334155; text-transform: uppercase; margin: 0; }
                    .page-footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #eee; text-align: center; font-size: 10px; color: #94a3b8; }
                `}</style>
            </Modal>
        );
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={mode === 'create' ? (isSalesVanLoadFlow ? 'Load Van Stock' : 'New Stock Transfer') : isViewOnly ? 'Transfer Details' : 'Edit Transfer'}
            subtitle={mode === 'create'
                ? (isSalesVanLoadFlow ? 'Sales Department → Individual Vans only' : 'Flow: Finished Goods Store → Salesperson · Sales Department → Vans')
                : `Reviewing transfer ${transferNumber}`}
            width={850}
        >
            <form onSubmit={handleSubmit} className="transfer-form">
                <div className="form-grid">
                    {/* Header Info */}
                    <div className="section-title full-width">Transfer Information</div>
                    
                    <div className="form-field">
                        <label>Transfer Number</label>
                        <div className="input-wrapper disabled">
                            <Hash size={16} className="icon" />
                            <input value={transferNumber} readOnly />
                        </div>
                    </div>

                    <div className="form-field">
                        <label>Date</label>
                        <div className="input-wrapper">
                            <Calendar size={16} className="icon" />
                            <input 
                                type="date" 
                                value={transferDate} 
                                onChange={(e) => setTransferDate(e.target.value)} 
                                readOnly={isViewOnly}
                            />
                        </div>
                    </div>

                    <div className="form-field">
                        <label>Source Location (From) *</label>
                        <div className="input-wrapper">
                            <MapPin size={16} className="icon" />
                            <select
                                required
                                value={fromLocationId}
                                onChange={(e) => {
                                    const newId = e.target.value;
                                    const newLoc = locations.find(l => l.id === newId);
                                    setFromLocationId(newId);
                                    // Clear destination if it is now excluded by the new source rules
                                    const currentTo = locations.find(l => l.id === toLocationId);
                                    const toIsVan = currentTo ? isVanStockLocation(currentTo) : false;
                                    if (
                                        toLocationId === newId ||
                                        (newLoc && isFinishedGoodsLocation(newLoc) && !toIsVan)
                                    ) {
                                        setToLocationId('');
                                    }
                                }}
                                disabled={isViewOnly || isSalesVanLoadFlow}
                            >
                                <option value="">Select source</option>
                                {filteredFromLocations.map(loc => (
                                    <option key={loc.id} value={loc.id}>{loc.name} ({loc.type})</option>
                                ))}
                            </select>
                        </div>
                        {!isViewOnly && toLocation && isVanStockLocation(toLocation) && salesDepartmentLocation && (
                            <div style={{ fontSize: 10, color: 'var(--slate-500)', marginTop: 4 }}>
                                Vans can only be loaded from {salesDepartmentLocation.name}.
                            </div>
                        )}
                    </div>

                    <div className="form-field">
                        <label>Destination Location (To) *</label>
                        <div className="input-wrapper">
                            <MapPin size={16} className="icon" />
                            <select 
                                required 
                                value={toLocationId} 
                                onChange={(e) => setToLocationId(e.target.value)}
                                disabled={isViewOnly}
                            >
                                <option value="">Select destination</option>
                                {filteredToLocations.map(loc => (
                                    <option key={loc.id} value={loc.id}>{loc.name} ({loc.type})</option>
                                ))}
                            </select>
                        </div>
                        {!isViewOnly && (
                            <div style={{ fontSize: 10, color: 'var(--slate-500)', marginTop: 4 }}>
                                {isSalesVanLoadFlow
                                    ? 'Use this page only for Sales Department to van loading.'
                                    : fromLocation && isFinishedGoodsLocation(fromLocation)
                                        ? 'Stock from Finished Goods is assigned to a salesperson, not a van.'
                                        : 'Select any warehouse as the destination.'}
                            </div>
                        )}
                    </div>

                    {/* Items Section */}
                    <div className="section-title full-width" style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Transfer Items</span>
                        {!isViewOnly && (
                            <button type="button" onClick={addItem} className="btn-add-item">
                                <Plus size={14} /> Add Item
                            </button>
                        )}
                    </div>

                    <div className="items-container full-width">
                        <table className="items-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '50%' }}>Product</th>
                                    <th style={{ width: '20%' }}>Unit</th>
                                    <th style={{ width: '20%' }}>Quantity</th>
                                    {!isViewOnly && <th style={{ width: '10%' }}></th>}
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, index) => (
                                    <tr key={index}>
                                        <td>
                                            <select 
                                                required 
                                                value={item.product_id}
                                                onChange={(e) => updateItem(index, 'product_id', e.target.value)}
                                                disabled={isViewOnly}
                                                className="item-select"
                                            >
                                                <option value="">Select product</option>
                                                {products.map(p => (
                                                    <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td>
                                            <div className="unit-display">
                                                {item.product?.unit || '-'}
                                                {item.product?.bulk_unit && item.product?.bulk_to_base_ratio && (
                                                    <div style={{ fontSize: 10, color: 'var(--primary-600)', fontWeight: 500, marginTop: 2 }}>
                                                        1 {item.product.bulk_unit} = {item.product.bulk_to_base_ratio} {item.product.unit}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <input
                                                type="number"
                                                min="1"
                                                value={item.quantity}
                                                onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value))}
                                                disabled={isViewOnly}
                                                className="item-input"
                                            />
                                            {item.product?.bulk_unit && item.product?.bulk_to_base_ratio && item.quantity > 0 && (() => {
                                                const mixed = formatMixedBulk(item.quantity, item.product.unit, item.product.bulk_unit, item.product.bulk_to_base_ratio);
                                                return mixed ? (
                                                    <div style={{ fontSize: 10, color: 'var(--primary-600)', fontWeight: 600, marginTop: 2, whiteSpace: 'nowrap' }}>
                                                        = {mixed}
                                                    </div>
                                                ) : null;
                                            })()}
                                        </td>
                                        {!isViewOnly && (
                                            <td>
                                                <button 
                                                    type="button" 
                                                    onClick={() => removeItem(index)}
                                                    className="btn-remove"
                                                    disabled={items.length === 1}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="form-field full-width">
                        <label>Notes</label>
                        <div className="input-wrapper">
                            <FileText size={16} className="icon" style={{ top: 12 }} />
                            <textarea 
                                value={notes} 
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Purpose of transfer, driver info, etc."
                                rows={3}
                                readOnly={isViewOnly}
                            />
                        </div>
                    </div>
                </div>

                {!isViewOnly && (
                    <div className="modal-actions">
                        <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
                        <button type="submit" disabled={loading} className="btn-primary">
                            <Save size={16} />
                            {loading ? 'Saving...' : mode === 'edit' ? 'Update Transfer' : 'Save Transfer'}
                        </button>
                    </div>
                )}
            </form>

            <style>{`
                .transfer-form {
                    padding: 8px 4px;
                }
                .form-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 20px;
                }
                .full-width {
                    grid-column: span 2;
                }
                .section-title {
                    font-size: 11px;
                    font-weight: 700;
                    color: var(--slate-800);
                    border-bottom: 2px solid var(--slate-100);
                    padding-bottom: 8px;
                    margin-bottom: 4px;
                }
                .form-field label {
                    display: block;
                    font-size: 11px;
                    font-weight: 600;
                    color: var(--slate-600);
                    margin-bottom: 6px;
                }
                .input-wrapper {
                    position: relative;
                }
                .input-wrapper .icon {
                    position: absolute;
                    left: 12px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: var(--slate-400);
                }
                .input-wrapper.disabled {
                    opacity: 0.7;
                    background: var(--slate-50);
                }
                .input-wrapper input, .input-wrapper select, textarea {
                    width: 100%;
                    padding: 10px 12px 10px 38px;
                    border: 1.5px solid var(--slate-200);
                    border-radius: 10px;
                    font-size: 11px;
                    outline: none;
                    transition: all 0.2s;
                    background: var(--card-bg);
                }
                textarea {
                    padding-top: 10px;
                }
                .input-wrapper input:focus, .input-wrapper select:focus, textarea:focus {
                    border-color: var(--primary-500);
                    box-shadow: 0 0 0 4px var(--primary-50);
                }
                
                .btn-add-item {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 12px;
                    background: var(--primary-50);
                    color: var(--primary-600);
                    border: 1px solid var(--primary-200);
                    border-radius: 6px;
                    font-size: 11px;
                    font-weight: 600;
                    cursor: pointer;
                }
                .btn-add-item:hover {
                    background: var(--primary-100);
                }

                .items-container {
                    border: 1.5px solid var(--slate-100);
                    border-radius: 12px;
                    overflow: hidden;
                    margin-bottom: 8px;
                }
                .items-table {
                    width: 100%;
                    border-collapse: collapse;
                }
                .items-table th {
                    background: var(--slate-50);
                    padding: 12px 16px;
                    text-align: left;
                    font-size: 11px;
                    font-weight: 700;
                    color: var(--slate-600);
                    border-bottom: 1.5px solid var(--slate-100);
                }
                .items-table td {
                    padding: 10px 16px;
                    border-bottom: 1px solid var(--slate-50);
                }
                .item-select, .item-input {
                    width: 100%;
                    padding: 8px 10px;
                    border: 1px solid var(--slate-200);
                    border-radius: 8px;
                    font-size: 11px;
                    outline: none;
                }
                .unit-display {
                    font-size: 11px;
                    color: var(--slate-500);
                }
                .btn-remove {
                    color: var(--slate-400);
                    background: none;
                    border: none;
                    cursor: pointer;
                    padding: 6px;
                    border-radius: 6px;
                    transition: all 0.2s;
                }
                .btn-remove:hover:not(:disabled) {
                    background: var(--danger-light);
                    color: var(--danger);
                }
                .btn-remove:disabled {
                    opacity: 0.3;
                    cursor: not-allowed;
                }

                .modal-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                    margin-top: 28px;
                    padding-top: 20px;
                    border-top: 1.5px solid var(--slate-100);
                }
                .btn-secondary {
                    padding: 10px 20px;
                    border-radius: 10px;
                    border: 1.5px solid var(--slate-200);
                    background: var(--card-bg);
                    color: var(--slate-600);
                    font-size: 11px;
                    font-weight: 600;
                    cursor: pointer;
                }
                .btn-primary {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px 24px;
                    border-radius: 10px;
                    border: none;
                    background: linear-gradient(135deg, var(--primary-600), var(--primary-500));
                    color: white;
                    font-size: 11px;
                    font-weight: 600;
                    cursor: pointer;
                    box-shadow: 0 4px 12px rgba(6, 182, 212, 0.2);
                }
                .btn-primary:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 6px 16px rgba(6, 182, 212, 0.3);
                }
            `}</style>
        </Modal>
    );
}

const transferDocStyles = `
    @page { size: A4; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', 'Inter', -apple-system, sans-serif; color: #1a1a1a; background: white; }
    .a4-page { width: 210mm; min-height: 297mm; padding: 15mm 20mm; margin: 0 auto; background: white; }
    .doc-header { display: flex; justify-content: space-between; border-bottom: 2px solid #1a1a1a; padding-bottom: 20px; margin-bottom: 24px; }
    .company-name { font-size: 16px; font-weight: 800; margin: 0; color: #0f172a; }
    .company-tagline { font-size: 11px; color: #64748b; font-style: italic; margin: 2px 0 8px 0; }
    .contact-details p { font-size: 10px; margin: 2px 0; color: #334155; }
    .doc-type h2 { text-align: right; font-size: 18px; font-weight: 800; margin: 0 0 12px 0; color: #0f172a; }
    .transfer-meta { display: flex; flex-direction: column; gap: 4px; }
    .meta-row { display: flex; justify-content: flex-end; gap: 10px; font-size: 11px; }
    .meta-row .label { color: #64748b; font-weight: 500; }
    .meta-row .value { color: #0f172a; font-weight: 700; font-family: monospace; }
    .locations-section { display: flex; align-items: center; gap: 20px; margin-bottom: 24px; padding: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; }
    .location-block { flex: 1; }
    .location-block h3 { font-size: 10px; font-weight: 800; color: #64748b; margin: 0 0 8px 0; letter-spacing: 0.05em; }
    .location-info { display: flex; flex-direction: column; gap: 2px; }
    .location-info strong { font-size: 13px; color: #0f172a; }
    .location-info span { font-size: 11px; color: #64748b; }
    .arrow-icon { font-size: 24px; color: #64748b; }
    .items-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    .items-table th { background: #f8fafc; padding: 10px 8px; text-align: left; font-size: 10px; font-weight: 700; color: #334155; border-top: 1.5px solid #1a1a1a; border-bottom: 1.5px solid #1a1a1a; }
    .items-table td { padding: 12px 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; }
    .items-table tbody tr:last-child td { border-bottom: 1.5px solid #1a1a1a; }
    .grand-total-row td { padding: 10px 8px !important; background: #f8fafc; border-top: 2px solid #1a1a1a !important; }
    .notes-section { margin-bottom: 20px; padding: 12px 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; }
    .notes-section h4 { font-size: 10px; font-weight: 800; color: #64748b; margin: 0 0 6px 0; }
    .notes-section p { font-size: 11px; color: #334155; margin: 0; }
    .doc-footer { display: grid; grid-template-columns: 1fr; gap: 40px; margin-top: auto; padding-top: 30px; }
    .signatures { display: flex; gap: 40px; }
    .sig-block { text-align: center; }
    .sig-line { border-bottom: 1px solid #1a1a1a; margin-bottom: 6px; width: 120px; }
    .sig-block p { font-size: 10px; font-weight: 700; color: #334155; text-transform: uppercase; margin: 0; }
    .page-footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #eee; text-align: center; font-size: 10px; color: #94a3b8; }
`;
