'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Modal from './Modal';
import { Save, ChevronDown, Search, AlertTriangle, Plus, Trash2, Loader2, Download, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface Product { id: string; name: string; sku: string; unit: string; }
interface Location { id: string; name: string; type: string; }

export interface OpeningStockRow {
    key: string;
    product_id: string;
    location_id: string;
    batch_number: string;
    expiry_date: string;
    counted_qty: string;
}

export interface OpeningStockEntry {
    product_id: string;
    location_id: string;
    batch_number: string;
    expiry_date: string | null;
    counted_qty: number;
    notes: string;
}

interface OpeningStockModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (rows: OpeningStockEntry[]) => Promise<{ succeeded: number; failed: { row: number; message: string }[] }>;
}

const blankRow = (): OpeningStockRow => ({
    key: crypto.randomUUID(),
    product_id: '',
    location_id: '',
    batch_number: '',
    expiry_date: '',
    counted_qty: '',
});

export default function OpeningStockModal({ isOpen, onClose, onSave }: OpeningStockModalProps) {
    const [loading, setLoading] = useState(false);
    const [products, setProducts] = useState<Product[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [rows, setRows] = useState<OpeningStockRow[]>([blankRow()]);
    const [notes, setNotes] = useState('');
    const [recordedQtyByKey, setRecordedQtyByKey] = useState<Record<string, number>>({});
    const [saveErrors, setSaveErrors] = useState<{ product: string; location: string; message: string }[]>([]);
    const [openProductDropdown, setOpenProductDropdown] = useState<string | null>(null);
    const [productSearch, setProductSearch] = useState('');
    const [importing, setImporting] = useState(false);
    const [importErrors, setImportErrors] = useState<{ row: number; label: string; message: string }[]>([]);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            fetchDropdowns();
            setRows([blankRow()]);
            setNotes('');
            setRecordedQtyByKey({});
            setSaveErrors([]);
            setImportErrors([]);
        }
    }, [isOpen]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setOpenProductDropdown(null);
            }
        };
        if (openProductDropdown) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [openProductDropdown]);

    const fetchDropdowns = async () => {
        const [prodRes, locRes] = await Promise.all([
            supabase.from('products').select('id, name, sku, unit').order('name'),
            supabase.from('stock_locations').select('id, name, type').order('name'),
        ]);
        if (!prodRes.error) setProducts(prodRes.data || []);
        if (!locRes.error) setLocations(locRes.data || []);
    };

    // One row per existing product, ready for a physical count: staff fill in
    // Location/Batch/Expiry/Qty next to each product name instead of having to
    // look up or type SKUs.
    const handleDownloadTemplate = async () => {
        if (products.length === 0) {
            toast.error('Products are still loading — try again in a moment');
            return;
        }
        const XLSX = await import('xlsx');
        const sampleLocation = locations[0];
        const templateRows = products.map(p => ({
            'Product*': p.name,
            'Location*': sampleLocation?.name || 'Main Warehouse',
            'Batch Number': '',
            'Expiry Date (YYYY-MM-DD)': '',
            'Counted Qty*': '',
        }));
        const worksheet = XLSX.utils.json_to_sheet(templateRows);
        worksheet['!cols'] = [{ wch: 34 }, { wch: 22 }, { wch: 16 }, { wch: 22 }, { wch: 14 }];
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Opening Stock');
        XLSX.writeFile(workbook, 'opening_stock_template.xlsx');
    };

    // Bulk-import counted quantities from Excel/CSV. Products are matched by
    // exact name (falls back to SKU, for older templates), locations by exact
    // name — both case-insensitive. Rows that don't match are reported, never
    // silently dropped or guessed at.
    const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setImporting(true);
        setImportErrors([]);
        try {
            const XLSX = await import('xlsx');
            const arrayBuffer = await file.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const data: any[] = XLSX.utils.sheet_to_json(worksheet);

            if (data.length === 0) {
                toast.error('The uploaded file has no rows');
                return;
            }

            const importedRows: OpeningStockRow[] = [];
            const errors: { row: number; label: string; message: string }[] = [];

            data.forEach((raw, i) => {
                const rowNum = i + 2; // +2 for header row and 1-based indexing
                const nameOrSku = String(
                    raw['Product*'] ?? raw['Product'] ?? raw['Product Name']
                    ?? raw['Product SKU*'] ?? raw['Product SKU'] ?? ''
                ).trim();
                const locationName = String(raw['Location*'] ?? raw['Location'] ?? '').trim();
                const qtyRaw = raw['Counted Qty*'] ?? raw['Counted Qty'];
                const label = `${nameOrSku || '(no product)'} @ ${locationName || '(no location)'}`;

                // The template pre-fills every product's name and a default
                // location, leaving only Counted Qty blank for staff to fill in
                // while counting. An untouched row (that product wasn't counted
                // this pass) still has Product/Location but no Qty — skip those
                // quietly instead of flagging every one of the 231 products as an
                // error; only rows where a quantity was actually entered are
                // validated below.
                if (qtyRaw === undefined || qtyRaw === '') {
                    return;
                }

                if (!nameOrSku) {
                    errors.push({ row: rowNum, label, message: 'Product is required' });
                    return;
                }
                if (!locationName) {
                    errors.push({ row: rowNum, label, message: 'Location is required' });
                    return;
                }
                if (qtyRaw === undefined || qtyRaw === '' || Number.isNaN(Number(qtyRaw))) {
                    errors.push({ row: rowNum, label, message: 'Counted Qty is required and must be a number' });
                    return;
                }
                if (Number(qtyRaw) < 0) {
                    errors.push({ row: rowNum, label, message: 'Counted Qty cannot be negative' });
                    return;
                }

                const product = products.find(p => p.name.toLowerCase() === nameOrSku.toLowerCase())
                    ?? products.find(p => p.sku.toLowerCase() === nameOrSku.toLowerCase());
                if (!product) {
                    errors.push({ row: rowNum, label, message: `No product matches "${nameOrSku}"` });
                    return;
                }

                const location = locations.find(l => l.name.toLowerCase() === locationName.toLowerCase());
                if (!location) {
                    errors.push({ row: rowNum, label, message: `No location matches "${locationName}"` });
                    return;
                }

                const expiryRaw = raw['Expiry Date (YYYY-MM-DD)'] ?? raw['Expiry Date'];
                const expiry = expiryRaw ? String(expiryRaw).trim().slice(0, 10) : '';

                importedRows.push({
                    key: crypto.randomUUID(),
                    product_id: product.id,
                    location_id: location.id,
                    batch_number: String(raw['Batch Number'] ?? '').trim(),
                    expiry_date: expiry,
                    counted_qty: String(Number(qtyRaw)),
                });
            });

            if (importedRows.length > 0) {
                setRows(prev => {
                    const prevIsBlank = prev.length === 1 && !prev[0].product_id && !prev[0].location_id && prev[0].counted_qty === '';
                    return prevIsBlank ? importedRows : [...prev, ...importedRows];
                });
                // Fetch the currently-recorded quantity for each imported row so the
                // delta preview matches what manual entry already shows.
                importedRows.forEach(r => fetchRecordedStock(r.key, r.product_id, r.location_id, r.batch_number));
            }
            setImportErrors(errors);

            if (errors.length === 0) {
                toast.success(`Imported ${importedRows.length} row${importedRows.length === 1 ? '' : 's'}`);
            } else if (importedRows.length > 0) {
                toast.error(`Imported ${importedRows.length} row${importedRows.length === 1 ? '' : 's'}, ${errors.length} skipped — see details below`);
            } else {
                toast.error(`No rows could be imported — ${errors.length} error${errors.length === 1 ? '' : 's'}, see details below`);
            }
        } catch (err: any) {
            toast.error('Failed to read file: ' + err.message);
        } finally {
            setImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const fetchRecordedStock = async (key: string, productId: string, locationId: string, batchNumber: string) => {
        if (!productId || !locationId) {
            setRecordedQtyByKey(prev => { const next = { ...prev }; delete next[key]; return next; });
            return;
        }
        const { data } = await supabase
            .from('stock_levels')
            .select('qty_on_hand')
            .eq('product_id', productId)
            .eq('location_id', locationId)
            .eq('batch_number', batchNumber.trim() || 'N/A')
            .maybeSingle();
        setRecordedQtyByKey(prev => ({ ...prev, [key]: Number(data?.qty_on_hand || 0) }));
    };

    const updateRow = (key: string, patch: Partial<OpeningStockRow>) => {
        setRows(prev => prev.map(r => (r.key === key ? { ...r, ...patch } : r)));
        const merged = { ...rows.find(r => r.key === key), ...patch } as OpeningStockRow;
        if ('product_id' in patch || 'location_id' in patch || 'batch_number' in patch) {
            fetchRecordedStock(key, merged.product_id, merged.location_id, merged.batch_number);
        }
    };

    const addRow = () => setRows(prev => [...prev, blankRow()]);

    const removeRow = (key: string) => {
        setRows(prev => (prev.length === 1 ? prev : prev.filter(r => r.key !== key)));
        setRecordedQtyByKey(prev => { const next = { ...prev }; delete next[key]; return next; });
    };

    const validRows = useMemo(
        () => rows.filter(r => r.product_id && r.location_id && r.counted_qty !== ''),
        [rows]
    );

    const handleSave = async () => {
        const incomplete = rows.some(r =>
            (r.product_id || r.location_id || r.counted_qty !== '') &&
            !(r.product_id && r.location_id && r.counted_qty !== '')
        );
        if (incomplete) {
            toast.error('Every row needs a product, location, and counted quantity — remove empty rows or fill them in');
            return;
        }
        if (validRows.length === 0) {
            toast.error('Add at least one product with a counted quantity');
            return;
        }
        if (validRows.some(r => Number(r.counted_qty) < 0)) {
            toast.error('Quantity cannot be negative');
            return;
        }

        setLoading(true);
        setSaveErrors([]);
        try {
            const entries: OpeningStockEntry[] = validRows.map(r => ({
                product_id: r.product_id,
                location_id: r.location_id,
                batch_number: r.batch_number.trim() || 'N/A',
                expiry_date: r.expiry_date || null,
                counted_qty: Number(r.counted_qty),
                notes: notes.trim(),
            }));
            const result = await onSave(entries);
            if (result.failed.length === 0) {
                onClose();
            } else {
                toast.error(`${result.succeeded} saved, ${result.failed.length} failed — see errors below`);
                // Map each failure (indexed into `entries`/`validRows`, built 1:1 from
                // it) back to a readable product/location label — rows are left as-is
                // so the user can see and fix exactly what they entered.
                setSaveErrors(result.failed.map(f => {
                    const source = validRows[f.row];
                    const product = products.find(p => p.id === source?.product_id);
                    const location = locations.find(l => l.id === source?.location_id);
                    return {
                        product: product ? `${product.name} (${product.sku})` : 'Unknown product',
                        location: location?.name || 'Unknown location',
                        message: f.message,
                    };
                }));
            }
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    const filteredProducts = (openProductDropdown
        ? products.filter(p => `${p.name} ${p.sku}`.toLowerCase().includes(productSearch.toLowerCase()))
        : []);

    const inputStyle: React.CSSProperties = {
        width: '100%', padding: '7px 9px', borderRadius: 6,
        border: '1px solid var(--slate-200)', fontSize: 12,
        background: 'white', color: 'var(--slate-800)', outline: 'none', boxSizing: 'border-box',
    };

    const totalDelta = validRows.reduce((sum, r) => {
        const recorded = recordedQtyByKey[r.key] ?? 0;
        return sum + (Number(r.counted_qty) - recorded);
    }, 0);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Enter Opening Stock"
            subtitle="One-time bulk entry of stock already physically on hand — not for regular stock movements"
            width={920}
        >
            <div style={{
                display: 'flex', gap: 10, padding: '10px 14px', marginBottom: 16,
                background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8,
            }}>
                <AlertTriangle size={16} color="#b45309" style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 11.5, color: '#92400e', margin: 0, lineHeight: 1.5 }}>
                    Use this only to record stock that is already physically in the warehouse
                    (e.g. before go-live, or after a physical count). Add one row per product/
                    location/batch — each row sets the exact quantity on hand for that line.
                    For all normal stock changes, go back to the standard workflow — GRN, Sales,
                    Transfers or Internal Use.
                </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 10 }}>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleImportFile}
                    style={{ display: 'none' }}
                    disabled={importing}
                />
                <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px',
                        borderRadius: 6, border: '1px solid var(--slate-200)', background: 'white',
                        fontSize: 11.5, fontWeight: 600, color: 'var(--slate-600)', cursor: 'pointer',
                    }}
                >
                    <Download size={13} /> Download Template
                </button>
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={importing}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px',
                        borderRadius: 6, border: '1px solid var(--slate-200)', background: 'white',
                        fontSize: 11.5, fontWeight: 600, color: 'var(--primary-600)',
                        cursor: importing ? 'not-allowed' : 'pointer', opacity: importing ? 0.6 : 1,
                    }}
                >
                    {importing ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                    {importing ? 'Importing...' : 'Import Excel'}
                </button>
            </div>

            <div ref={dropdownRef} style={{ border: '1px solid var(--slate-200)', borderRadius: 8, overflow: 'visible', marginBottom: 14 }}>
                <div style={{
                    display: 'grid', gridTemplateColumns: '2.2fr 1.4fr 1fr 1fr 1fr 32px', gap: 8,
                    padding: '8px 10px', background: 'var(--slate-50)', fontSize: 10, fontWeight: 700,
                    color: 'var(--slate-500)', letterSpacing: '0.04em', textTransform: 'uppercase',
                    borderBottom: '1px solid var(--slate-100)',
                }}>
                    <span>Product</span>
                    <span>Location</span>
                    <span>Batch No.</span>
                    <span>Expiry</span>
                    <span>Counted Qty</span>
                    <span />
                </div>

                {rows.map((row, idx) => {
                    const selectedProduct = products.find(p => p.id === row.product_id);
                    const recorded = recordedQtyByKey[row.key];
                    const delta = recorded !== undefined && row.counted_qty !== '' ? Number(row.counted_qty) - recorded : null;

                    return (
                        <div key={row.key} style={{
                            display: 'grid', gridTemplateColumns: '2.2fr 1.4fr 1fr 1fr 1fr 32px', gap: 8,
                            padding: '8px 10px', alignItems: 'start',
                            borderBottom: idx === rows.length - 1 ? 'none' : '1px solid var(--slate-50)',
                            background: idx % 2 === 0 ? 'transparent' : 'var(--slate-50)',
                        }}>
                            {/* Product */}
                            <div style={{ position: 'relative' }}>
                                <button
                                    type="button"
                                    onClick={() => { setOpenProductDropdown(v => (v === row.key ? null : row.key)); setProductSearch(''); }}
                                    style={{ ...inputStyle, textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                >
                                    <span style={{ color: selectedProduct ? 'var(--slate-800)' : 'var(--slate-400)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {selectedProduct ? `${selectedProduct.name} (${selectedProduct.sku})` : '— Select product —'}
                                    </span>
                                    <ChevronDown size={13} style={{ color: 'var(--slate-400)', flexShrink: 0 }} />
                                </button>
                                {openProductDropdown === row.key && (
                                    <div style={{
                                        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                                        background: 'white', border: '1px solid var(--slate-200)', borderRadius: 8,
                                        boxShadow: '0 4px 16px rgba(0,0,0,0.12)', marginTop: 4, overflow: 'hidden', width: 320,
                                    }}>
                                        <div style={{ padding: '8px 8px 6px', borderBottom: '1px solid var(--slate-100)', position: 'relative' }}>
                                            <Search size={13} style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)', pointerEvents: 'none' }} />
                                            <input
                                                autoFocus
                                                type="text"
                                                placeholder="Search products…"
                                                value={productSearch}
                                                onChange={e => setProductSearch(e.target.value)}
                                                style={{ ...inputStyle, paddingLeft: 32, background: 'var(--slate-50)' }}
                                            />
                                        </div>
                                        <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                                            {filteredProducts.length === 0 ? (
                                                <div style={{ padding: '12px 16px', color: 'var(--slate-400)', fontSize: 13 }}>No products found</div>
                                            ) : filteredProducts.map(p => (
                                                <button
                                                    key={p.id}
                                                    type="button"
                                                    onClick={() => { updateRow(row.key, { product_id: p.id }); setOpenProductDropdown(null); setProductSearch(''); }}
                                                    style={{
                                                        display: 'block', width: '100%', textAlign: 'left',
                                                        padding: '9px 16px', fontSize: 13, cursor: 'pointer',
                                                        background: p.id === row.product_id ? 'var(--primary-50, #eff6ff)' : 'white',
                                                        color: p.id === row.product_id ? 'var(--primary-700, #1d4ed8)' : 'var(--slate-800)',
                                                        border: 'none', borderBottom: '1px solid var(--slate-50)',
                                                        fontWeight: p.id === row.product_id ? 600 : 400,
                                                    }}
                                                >
                                                    {p.name} ({p.sku})
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {recorded !== undefined && row.product_id && row.location_id && (
                                    <p style={{ fontSize: 10, color: 'var(--slate-400)', margin: '3px 0 0' }}>
                                        Recorded: <strong>{recorded.toLocaleString()}</strong>
                                        {delta !== null && delta !== 0 && (
                                            <span style={{ color: delta > 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                                                {' '}({delta > 0 ? '+' : ''}{delta.toLocaleString()})
                                            </span>
                                        )}
                                    </p>
                                )}
                            </div>

                            {/* Location */}
                            <select
                                style={inputStyle}
                                value={row.location_id}
                                onChange={e => updateRow(row.key, { location_id: e.target.value })}
                            >
                                <option value="">— Location —</option>
                                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                            </select>

                            {/* Batch */}
                            <input
                                style={inputStyle}
                                value={row.batch_number}
                                onChange={e => updateRow(row.key, { batch_number: e.target.value })}
                                placeholder="N/A"
                            />

                            {/* Expiry */}
                            <input
                                type="date"
                                style={inputStyle}
                                value={row.expiry_date}
                                onChange={e => updateRow(row.key, { expiry_date: e.target.value })}
                            />

                            {/* Qty */}
                            <input
                                type="number" min="0" step="0.001"
                                style={inputStyle}
                                value={row.counted_qty}
                                onChange={e => updateRow(row.key, { counted_qty: e.target.value })}
                                placeholder="0"
                            />

                            {/* Remove */}
                            <button
                                type="button"
                                onClick={() => removeRow(row.key)}
                                disabled={rows.length === 1}
                                title="Remove row"
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    width: 28, height: 28, borderRadius: 6, border: '1px solid var(--slate-200)',
                                    background: 'white', color: rows.length === 1 ? 'var(--slate-300)' : 'var(--danger)',
                                    cursor: rows.length === 1 ? 'not-allowed' : 'pointer',
                                }}
                            >
                                <Trash2 size={13} />
                            </button>
                        </div>
                    );
                })}

                <div style={{ padding: '8px 10px', borderTop: '1px solid var(--slate-100)' }}>
                    <button
                        type="button"
                        onClick={addRow}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                            borderRadius: 6, border: '1px dashed var(--slate-300)', background: 'white',
                            fontSize: 12, fontWeight: 600, color: 'var(--primary-600)', cursor: 'pointer',
                        }}
                    >
                        <Plus size={13} /> Add Row
                    </button>
                </div>
            </div>

            <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--slate-600)', marginBottom: 4, display: 'block' }}>
                    Reason / Notes (applies to all rows)
                </label>
                <textarea
                    style={{ ...inputStyle, fontSize: 13, padding: '9px 12px', resize: 'vertical', minHeight: 56 }}
                    value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder="e.g. Opening stock before go-live, year-end physical count..."
                />
            </div>

            {importErrors.length > 0 && (
                <div style={{
                    marginBottom: 14, padding: '10px 14px', borderRadius: 8,
                    background: '#fef2f2', border: '1px solid #fecaca', maxHeight: 160, overflowY: 'auto',
                }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#b91c1c', margin: '0 0 6px' }}>
                        {importErrors.length} row{importErrors.length === 1 ? '' : 's'} from the import could not be matched:
                    </p>
                    {importErrors.map((e, i) => (
                        <p key={i} style={{ fontSize: 11, color: '#b91c1c', margin: '2px 0' }}>
                            Row {e.row} ({e.label}) — {e.message}
                        </p>
                    ))}
                </div>
            )}

            {saveErrors.length > 0 && (
                <div style={{
                    marginBottom: 14, padding: '10px 14px', borderRadius: 8,
                    background: '#fef2f2', border: '1px solid #fecaca',
                }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#b91c1c', margin: '0 0 6px' }}>
                        {saveErrors.length} row{saveErrors.length === 1 ? '' : 's'} failed to save:
                    </p>
                    {saveErrors.map((e, i) => (
                        <p key={i} style={{ fontSize: 11, color: '#b91c1c', margin: '2px 0' }}>
                            {e.product} @ {e.location} — {e.message}
                        </p>
                    ))}
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--slate-500)' }}>
                    {validRows.length} row{validRows.length === 1 ? '' : 's'} ready
                    {totalDelta !== 0 && (
                        <span style={{ marginLeft: 6, fontWeight: 600, color: totalDelta > 0 ? 'var(--success)' : 'var(--danger)' }}>
                            (net {totalDelta > 0 ? '+' : ''}{totalDelta.toLocaleString()} vs. currently recorded)
                        </span>
                    )}
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid var(--slate-200)', background: 'white', fontSize: 13, cursor: 'pointer' }}>
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 20px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #b45309, #d97706)', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}
                    >
                        {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        {loading ? 'Saving...' : `Set Opening Stock (${validRows.length})`}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
