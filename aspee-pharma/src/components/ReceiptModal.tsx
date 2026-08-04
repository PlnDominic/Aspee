'use client';

import React, { useState, useEffect, useRef } from 'react';
import Modal from './Modal';
import {
    CreditCard,
    Hash,
    Calendar,
    Banknote,
    Save,
    Search,
    FileText,
    ChevronDown,
    X,
    User,
    Truck,
    Plus,
    Trash2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { formatCurrency, CURRENCY_SYMBOL } from '@/lib/currency';

interface Customer {
    id: string;
    name: string;
    category?: string | null;
    location?: string | null;
    route_id?: string | null;
    // text fields stored by CustomerModal (legacy/non-FK assignments)
    sales_person?: string | null;
    route?: string | null;
}

interface Invoice {
    id: string;
    invoice_number: string;
    customer_id: string | null;
    total_amount: number;
    status: string;
    date: string;
    paid_amount?: number;
    outstanding?: number;
}

interface AllocationRow {
    key: string;
    invoice_id: string;
    invoice_number: string;
    invoice_total: number;
    outstanding: number;
    amount: string;
}

interface ReceiptModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    record?: any;
}

export default function ReceiptModal({ isOpen, onClose, onSuccess, record }: ReceiptModalProps) {
    const [loading, setLoading] = useState(false);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [salesPersons, setSalesPersons] = useState<{ id: string; name: string }[]>([]);
    const [vans, setVans] = useState<{ id: string; van_number?: string; driver_name?: string; route_name?: string; route_area?: string }[]>([]);

    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [customerInvoices, setCustomerInvoices] = useState<Invoice[]>([]);
    const [customerTotalOutstanding, setCustomerTotalOutstanding] = useState<number>(0);
    const [allocations, setAllocations] = useState<AllocationRow[]>([]);
    // IDs of vans assigned to routes for the currently-selected sales person
    const [salesPersonRouteIds, setSalesPersonRouteIds] = useState<Set<string>>(new Set());

    const [searchTerm, setSearchTerm] = useState('');
    const [isOpenDropdown, setIsOpenDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const [receiptNumber, setReceiptNumber] = useState('');
    const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split('T')[0]);
    const [paymentMethod, setPaymentMethod] = useState('Cash');
    const [paymentReference, setPaymentReference] = useState('');
    const [amount, setAmount] = useState<number>(0);
    const [salesPersonId, setSalesPersonId] = useState('');
    const [routeId, setRouteId] = useState('');
    const [notes, setNotes] = useState('');
    // Holds the raw route text from the customer record so we can resolve it
    // once the vans list is loaded (whichever arrives last).
    const [pendingRouteText, setPendingRouteText] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        fetchCustomers();
        fetchSalesPersons();
        fetchVans();
        if (record) {
            setReceiptNumber(record.receipt_number || '');
            setReceiptDate(record.date || new Date().toISOString().split('T')[0]);
            setPaymentMethod(record.payment_method || 'Cash');
            setPaymentReference(record.payment_reference || '');
            setAmount(Number(record.amount) || 0);
            setNotes(record.notes || '');
            setSalesPersonId(record.sales_rep_id || '');
            setRouteId(record.route_id || '');
            if (record.customer_id) {
                loadCustomerById(record.customer_id);
            } else if (record.customer_name) {
                // Legacy receipt — no customer_id, but we can still load balance by name
                const fakeCust: Customer = { id: '', name: record.customer_name };
                setSelectedCustomer(fakeCust);
                loadCustomerBalance(fakeCust);
                loadCustomerOpenInvoices(fakeCust);
            }
            if (record.id) loadAllocations(record.id);
        } else {
            generateReceiptNumber();
            resetForm();
        }
    }, [isOpen, record]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpenDropdown(false);
                setSearchTerm('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Resolve pendingRouteText → van ID whenever vans finishes loading.
    // This handles the race where a customer is selected before fetchVans completes.
    useEffect(() => {
        if (!pendingRouteText || vans.length === 0) return;
        const needle = pendingRouteText.trim().toLowerCase();
        const matched = vans.find(v =>
            (v.route_area || '').trim().toLowerCase() === needle ||
            (v.van_number || '').trim().toLowerCase() === needle ||
            (v.route_name || '').trim().toLowerCase() === needle
        );
        if (matched) {
            setRouteId(matched.id);
            setPendingRouteText(null);   // resolved — stop watching
        }
    }, [vans, pendingRouteText]);

    const resetForm = () => {
        setSelectedCustomer(null);
        setCustomerInvoices([]);
        setCustomerTotalOutstanding(0);
        setAllocations([]);
        setSalesPersonRouteIds(new Set());
        setPendingRouteText(null);
        setSearchTerm('');
        setIsOpenDropdown(false);
        setReceiptDate(new Date().toISOString().split('T')[0]);
        setPaymentMethod('Cash');
        setPaymentReference('');
        setAmount(0);
        setSalesPersonId('');
        setRouteId('');
        setNotes('');
    };

    const fetchCustomers = async () => {
        const { data, error } = await supabase
            .from('customers')
            .select('id, name, category, location, route_id, sales_person, route')
            .order('name', { ascending: true });
        if (error) {
            toast.error('Failed to load customers: ' + error.message);
            return;
        }
        setCustomers((data as Customer[]) || []);
    };

    const fetchSalesPersons = async () => {
        const { data } = await supabase
            .from('sales_reps')
            .select('id, name')
            .eq('status', 'Active')
            .order('name');
        setSalesPersons((data as any) || []);
    };

    const fetchVans = async () => {
        const { data } = await supabase
            .from('vans')
            .select('id, van_number, driver_name, route_name, route_area')
            .order('van_number');
        setVans((data as any) || []);
    };

    const loadCustomerById = async (id: string) => {
        const { data } = await supabase
            .from('customers')
            .select('id, name, category, location, route_id, sales_person, route')
            .eq('id', id)
            .single();
        if (data) {
            setSelectedCustomer(data as Customer);
            loadCustomerBalance(data as Customer);
            loadCustomerOpenInvoices(data as Customer);
        }
    };

    // Calculates the customer running balance exactly as the customer page does:
    // sum(all non-cancelled invoices) - sum(all non-void receipts), matched by customer_name.
    const loadCustomerBalance = async (c: Customer) => {
        const name = c.name.trim().toLowerCase();

        const [{ data: invoices }, { data: receipts }] = await Promise.all([
            supabase
                .from('sales_invoices')
                .select('total_amount, status')
                .ilike('customer_name', c.name),
            supabase
                .from('sales_receipts')
                .select('amount, status')
                .ilike('customer_name', c.name),
        ]);

        const totalInvoiced = (invoices || []).reduce((s: number, inv: any) => {
            const st = (inv.status || '').trim().toUpperCase();
            if (st === 'DRAFT' || st === 'CANCELLED') return s;
            return s + Number(inv.total_amount || 0);
        }, 0);

        const totalPaid = (receipts || []).reduce((s: number, r: any) => {
            const st = (r.status || '').trim().toUpperCase();
            if (st === 'VOID' || st === 'CANCELLED') return s;
            return s + Number(r.amount || 0);
        }, 0);

        setCustomerTotalOutstanding(Math.max(0, totalInvoiced - totalPaid));
    };

    // Loads individual open invoices for the optional allocation section.
    const loadCustomerOpenInvoices = async (c: Customer) => {
        // Query by customer_name (text) — same approach as the rest of the system.
        // Also try customer_id as a secondary match for newer invoices.
        const { data: invoices } = await supabase
            .from('sales_invoices')
            .select('id, invoice_number, customer_id, total_amount, status, date')
            .ilike('customer_name', c.name)
            .not('status', 'in', '("PAID","Paid","CANCELLED","Cancelled")')
            .order('date', { ascending: true });

        if (!invoices || invoices.length === 0) {
            setCustomerInvoices([]);
            return;
        }

        // Subtract existing receipts by invoice_id (legacy) or allocations (new)
        const ids = invoices.map((i: any) => i.id);
        const paidMap = new Map<string, number>();

        // Try allocations table first (may not exist if migration pending)
        const { data: allocs, error: allocErr } = await supabase
            .from('sales_receipt_allocations')
            .select('invoice_id, amount')
            .in('invoice_id', ids);

        if (!allocErr && allocs && allocs.length > 0) {
            (allocs as any[]).forEach((a: any) => {
                paidMap.set(a.invoice_id, (paidMap.get(a.invoice_id) || 0) + Number(a.amount || 0));
            });
        } else {
            // Fallback: use sales_receipts.invoice_id (pre-allocation model)
            const { data: legacyReceipts } = await supabase
                .from('sales_receipts')
                .select('invoice_id, amount, status')
                .in('invoice_id', ids);
            (legacyReceipts || []).forEach((r: any) => {
                const st = (r.status || '').trim().toUpperCase();
                if (st === 'VOID' || st === 'CANCELLED') return;
                paidMap.set(r.invoice_id, (paidMap.get(r.invoice_id) || 0) + Number(r.amount || 0));
            });
        }

        const enriched: Invoice[] = (invoices as any[]).map((inv: any) => {
            const paid = paidMap.get(inv.id) || 0;
            return { ...inv, paid_amount: paid, outstanding: Number(inv.total_amount || 0) - paid };
        }).filter(inv => (inv.outstanding ?? 0) > 0.01);

        setCustomerInvoices(enriched);
    };

    const loadAllocations = async (receiptId: string) => {
        const { data } = await supabase
            .from('sales_receipt_allocations')
            .select('id, invoice_id, amount, sales_invoices(invoice_number, total_amount)')
            .eq('receipt_id', receiptId);
        if (!data) return;
        const rows: AllocationRow[] = (data as any[]).map((a, i) => ({
            key: `existing-${i}-${a.id}`,
            invoice_id: a.invoice_id,
            invoice_number: a.sales_invoices?.invoice_number ?? '',
            invoice_total: Number(a.sales_invoices?.total_amount ?? 0),
            outstanding: Number(a.sales_invoices?.total_amount ?? 0),
            amount: String(a.amount),
        }));
        setAllocations(rows);
    };

    const generateReceiptNumber = () => {
        const date = new Date();
        const year = date.getFullYear().toString().slice(-2);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const random = Math.floor(1000 + Math.random() * 9000);
        setReceiptNumber(`RCT-${year}${month}-${random}`);
    };

    // Find which van IDs belong to a sales person's routes by looking at
    // what route_area customers with that sales_person name are assigned to.
    const loadRoutesForSalesPerson = async (spId: string) => {
        const sp = salesPersons.find(s => s.id === spId);
        if (!sp) { setSalesPersonRouteIds(new Set()); return; }

        const { data: custRows } = await supabase
            .from('customers')
            .select('route')
            .ilike('sales_person', sp.name)
            .not('route', 'is', null);

        const routeAreas = new Set<string>(
            ((custRows || []) as any[]).map(r => (r.route || '').trim().toLowerCase()).filter(Boolean)
        );

        // Match those route_area texts to van IDs already in state
        const matchedIds = new Set<string>(
            vans.filter(v => routeAreas.has((v.route_area || '').trim().toLowerCase())).map(v => v.id)
        );
        setSalesPersonRouteIds(matchedIds);
    };

    const handleSelectCustomer = (c: Customer) => {
        setSelectedCustomer(c);
        setIsOpenDropdown(false);
        setSearchTerm('');
        setAllocations([]);
        loadCustomerBalance(c);
        loadCustomerOpenInvoices(c);

        // Pre-fill Route: prefer the customer's FK assignment, then fall back
        // to legacy route text matching for older records.
        if (c.route_id) {
            setRouteId(c.route_id);
            setPendingRouteText(null);
        } else if (c.route) {
            const routeText = c.route.trim().toLowerCase();
            const matchedVan = vans.find(v =>
                (v.route_area || '').trim().toLowerCase() === routeText ||
                (v.van_number || '').trim().toLowerCase() === routeText ||
                (v.route_name || '').trim().toLowerCase() === routeText
            );
            if (matchedVan) {
                setRouteId(matchedVan.id);
                setPendingRouteText(null);
            } else {
                // Vans not loaded yet — defer resolution
                setPendingRouteText(c.route);
            }
        } else {
            setRouteId('');
            setPendingRouteText(null);
        }

        // Pre-fill Sales Person: match customers.sales_person (text) → system_user name
        if (c.sales_person) {
            const spText = c.sales_person.trim().toLowerCase();
            const matchedSp = salesPersons.find(s => s.name.trim().toLowerCase() === spText);
            if (matchedSp) {
                setSalesPersonId(matchedSp.id);
                loadRoutesForSalesPerson(matchedSp.id);
            }
        } else {
            setSalesPersonId('');
        }
    };

    const handleSalesPersonChange = (spId: string) => {
        setSalesPersonId(spId);
        if (spId) {
            loadRoutesForSalesPerson(spId);
        } else {
            setSalesPersonRouteIds(new Set());
        }
    };

    const filteredCustomers = customers.filter(c => {
        if (!searchTerm) return true;
        const t = searchTerm.toLowerCase();
        return c.name.toLowerCase().includes(t)
            || (c.location ?? '').toLowerCase().includes(t)
            || (c.category ?? '').toLowerCase().includes(t);
    });

    // Use the state value so it shows even when invoices list is still loading
    const allocatedTotal = allocations.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
    const unallocated = Math.max(0, amount - allocatedTotal);

    const addAllocation = (invoice: Invoice) => {
        if (allocations.some(a => a.invoice_id === invoice.id)) {
            toast.error('Invoice already allocated');
            return;
        }
        const remaining = amount - allocatedTotal;
        const defaultAmt = Math.min(invoice.outstanding ?? 0, Math.max(0, remaining));
        setAllocations(prev => [...prev, {
            key: `${Date.now()}-${invoice.id}`,
            invoice_id: invoice.id,
            invoice_number: invoice.invoice_number,
            invoice_total: invoice.total_amount,
            outstanding: invoice.outstanding ?? 0,
            amount: defaultAmt > 0 ? defaultAmt.toFixed(2) : '',
        }]);
    };

    const updateAllocation = (key: string, value: string) => {
        setAllocations(prev => prev.map(a => a.key === key ? { ...a, amount: value } : a));
    };

    const removeAllocation = (key: string) => {
        setAllocations(prev => prev.filter(a => a.key !== key));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedCustomer) { toast.error('Please select a customer'); return; }
        if (!paymentMethod) { toast.error('Please select a payment method'); return; }
        if (amount <= 0) { toast.error('Amount must be greater than zero'); return; }
        if (allocatedTotal > amount + 0.01) {
            toast.error('Allocated amount exceeds receipt total');
            return;
        }

        setLoading(true);
        try {
            const cleanAllocations = allocations
                .filter(a => a.invoice_id && parseFloat(a.amount) > 0)
                .map(a => ({ invoice_id: a.invoice_id, amount: parseFloat(a.amount) }));

            const receiptPayload: any = {
                ...(record?.id ? { id: record.id } : {}),
                receipt_number: receiptNumber,
                customer_id: selectedCustomer.id,
                customer_name: selectedCustomer.name,
                sales_rep_id: salesPersonId || null,
                route_id: routeId || null,
                date: receiptDate,
                payment_method: paymentMethod,
                payment_reference: paymentReference || null,
                amount,
                notes,
                status: 'Confirmed',
                allocations: cleanAllocations,
            };

            const { error } = await supabase.rpc('post_sales_receipt', { receipt_payload: receiptPayload });
            if (error) throw error;

            toast.success(record?.id ? 'Receipt updated' : 'Receipt recorded');
            onSuccess?.();
            onClose();
        } catch (err: any) {
            toast.error('Error: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={record?.id ? 'Edit Payment Receipt' : 'Record Payment Receipt'}
            subtitle={record?.id ? 'Update receipt details' : 'Record a payment received from a customer'}
            width={720}
        >
            <form onSubmit={handleSubmit} className="rct-form">
                <div className="rct-grid">
                    <div className="rct-field">
                        <label>Receipt Number</label>
                        <div className="rct-input-wrap disabled">
                            <Hash size={15} className="rct-icon" />
                            <input value={receiptNumber} readOnly />
                        </div>
                    </div>

                    <div className="rct-field">
                        <label>Receipt Date</label>
                        <div className="rct-input-wrap">
                            <Calendar size={15} className="rct-icon" />
                            <input type="date" value={receiptDate} onChange={e => setReceiptDate(e.target.value)} required />
                        </div>
                    </div>

                    <div className="rct-field full-width" ref={dropdownRef} style={{ position: 'relative' }}>
                        <label>Customer *</label>
                        <div
                            className={`rct-select-trigger ${isOpenDropdown ? 'open' : ''}`}
                            onClick={() => {
                                setIsOpenDropdown(v => !v);
                                setTimeout(() => searchInputRef.current?.focus(), 50);
                            }}
                        >
                            {selectedCustomer ? (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 1 }}>
                                    <div>
                                        <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--primary-600)' }}>
                                            {selectedCustomer.name}
                                        </span>
                                        {selectedCustomer.location && (
                                            <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--slate-500)' }}>
                                                {selectedCustomer.location}
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        className="rct-clear-btn"
                                        onClick={e => {
                                            e.stopPropagation();
                                            setSelectedCustomer(null);
                                            setCustomerInvoices([]);
                                            setCustomerTotalOutstanding(0);
                                            setAllocations([]);
                                            setRouteId('');
                                            setSalesPersonId('');
                                            setSalesPersonRouteIds(new Set());
                                            setPendingRouteText(null);
                                        }}
                                    ><X size={13} /></button>
                                </div>
                            ) : (
                                <span style={{ color: 'var(--slate-400)', fontSize: 12 }}>Select a customer...</span>
                            )}
                            <ChevronDown size={15} className={`rct-chevron ${isOpenDropdown ? 'rotated' : ''}`} />
                        </div>

                        {isOpenDropdown && (
                            <div className="rct-dropdown-panel">
                                <div className="rct-dropdown-search">
                                    <Search size={13} style={{ color: 'var(--slate-400)' }} />
                                    <input
                                        ref={searchInputRef}
                                        type="text"
                                        placeholder="Search customer name or location..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        onClick={e => e.stopPropagation()}
                                    />
                                </div>
                                <div className="rct-dropdown-list">
                                    {filteredCustomers.length === 0 ? (
                                        <div className="rct-no-results">No customers found</div>
                                    ) : (
                                        filteredCustomers.slice(0, 100).map(c => (
                                            <div
                                                key={c.id}
                                                className={`rct-dropdown-item ${selectedCustomer?.id === c.id ? 'selected' : ''}`}
                                                onClick={() => handleSelectCustomer(c)}
                                            >
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--primary-600)' }}>{c.name}</div>
                                                    <div style={{ fontSize: 11, color: 'var(--slate-500)' }}>
                                                        {c.location || '—'} {c.category ? `· ${c.category}` : ''}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {selectedCustomer && (
                        <div className="rct-summary full-width">
                            <div className="rct-summary-row highlight">
                                <span>Outstanding Balance</span>
                                <span className="rct-summary-val" style={{ color: customerTotalOutstanding > 0 ? 'var(--danger)' : 'var(--success)' }}>
                                    {formatCurrency(customerTotalOutstanding)}
                                </span>
                            </div>
                            <div className="rct-summary-row" style={{ fontSize: 10, color: 'var(--slate-500)' }}>
                                {customerInvoices.length > 0
                                    ? `Across ${customerInvoices.length} unpaid invoice${customerInvoices.length === 1 ? '' : 's'}`
                                    : 'No outstanding invoices'}
                            </div>
                        </div>
                    )}

                    <div className="rct-field">
                        <label>Sales Person</label>
                        <div className="rct-input-wrap">
                            <User size={15} className="rct-icon" />
                            <select value={salesPersonId} onChange={e => handleSalesPersonChange(e.target.value)}>
                                <option value="">— select sales person —</option>
                                {salesPersons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="rct-field">
                        <label>Route / Van</label>
                        <div className="rct-input-wrap">
                            <Truck size={15} className="rct-icon" />
                            <select value={routeId} onChange={e => setRouteId(e.target.value)}>
                                <option value="">— select route —</option>
                                {(salesPersonRouteIds.size > 0
                                    ? vans.filter(v => salesPersonRouteIds.has(v.id))
                                    : vans
                                ).map(v => (
                                    <option key={v.id} value={v.id}>
                                        {v.van_number ?? v.route_name ?? 'Van'} {v.driver_name ? `· ${v.driver_name}` : ''}
                                    </option>
                                ))}
                                {salesPersonRouteIds.size > 0 && vans.filter(v => !salesPersonRouteIds.has(v.id)).length > 0 && (
                                    <>
                                        <option disabled>──── Other routes ────</option>
                                        {vans.filter(v => !salesPersonRouteIds.has(v.id)).map(v => (
                                            <option key={v.id} value={v.id}>
                                                {v.van_number ?? v.route_name ?? 'Van'} {v.driver_name ? `· ${v.driver_name}` : ''}
                                            </option>
                                        ))}
                                    </>
                                )}
                            </select>
                        </div>
                        {salesPersonRouteIds.size > 0 && (
                            <div style={{ fontSize: 10, color: 'var(--primary-600)', marginTop: 4 }}>
                                Showing routes assigned to this sales person first
                            </div>
                        )}
                    </div>

                    <div className="rct-field">
                        <label>Payment Method *</label>
                        <div className="rct-input-wrap">
                            <CreditCard size={15} className="rct-icon" />
                            <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} required>
                                <option value="Cash">Cash</option>
                                <option value="Bank Transfer">Bank Transfer</option>
                                <option value="Mobile Money">Mobile Money</option>
                                <option value="Cheque">Cheque</option>
                            </select>
                        </div>
                    </div>

                    <div className="rct-field">
                        <label>Amount ({CURRENCY_SYMBOL}) *</label>
                        <div className="rct-input-wrap">
                            <Banknote size={15} className="rct-icon" />
                            <input
                                type="number"
                                value={amount}
                                onChange={e => setAmount(parseFloat(e.target.value) || 0)}
                                min="0.01"
                                step="0.01"
                                required
                            />
                        </div>
                    </div>

                    <div className="rct-field full-width">
                        <label>Payment Reference</label>
                        <div className="rct-input-wrap">
                            <FileText size={15} className="rct-icon" />
                            <input
                                type="text"
                                placeholder="Cheque number, transaction ID, etc."
                                value={paymentReference}
                                onChange={e => setPaymentReference(e.target.value)}
                            />
                        </div>
                    </div>

                    {selectedCustomer && customerInvoices.length > 0 && (
                        <div className="rct-alloc full-width">
                            <div className="rct-alloc-header">
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--slate-700)' }}>
                                        Allocate to Invoices (optional)
                                    </div>
                                    <div style={{ fontSize: 10, color: 'var(--slate-500)', marginTop: 2 }}>
                                        Leave blank to apply payment to the customer's running balance.
                                    </div>
                                </div>
                                <div className="rct-alloc-status">
                                    <span>Allocated: <strong>{formatCurrency(allocatedTotal)}</strong></span>
                                    <span>Unallocated: <strong style={{ color: unallocated > 0 ? 'var(--warning)' : 'var(--success)' }}>{formatCurrency(unallocated)}</strong></span>
                                </div>
                            </div>

                            {allocations.length > 0 && (
                                <table className="rct-alloc-table">
                                    <thead>
                                        <tr>
                                            <th>Invoice</th>
                                            <th>Outstanding</th>
                                            <th>Allocation</th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {allocations.map(a => (
                                            <tr key={a.key}>
                                                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{a.invoice_number}</td>
                                                <td>{formatCurrency(a.outstanding)}</td>
                                                <td>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        value={a.amount}
                                                        onChange={e => updateAllocation(a.key, e.target.value)}
                                                    />
                                                </td>
                                                <td>
                                                    <button type="button" onClick={() => removeAllocation(a.key)} className="rct-alloc-del">
                                                        <Trash2 size={12} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}

                            <div className="rct-alloc-picker">
                                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--slate-500)', marginBottom: 6 }}>
                                    Available invoices:
                                </div>
                                <div className="rct-alloc-chips">
                                    {customerInvoices
                                        .filter(inv => !allocations.some(a => a.invoice_id === inv.id))
                                        .map(inv => (
                                            <button
                                                key={inv.id}
                                                type="button"
                                                className="rct-alloc-chip"
                                                onClick={() => addAllocation(inv)}
                                            >
                                                <Plus size={11} />
                                                <span>{inv.invoice_number}</span>
                                                <span style={{ color: 'var(--slate-500)' }}>· {formatCurrency(inv.outstanding ?? 0)}</span>
                                            </button>
                                        ))
                                    }
                                    {customerInvoices.every(inv => allocations.some(a => a.invoice_id === inv.id)) && (
                                        <span style={{ fontSize: 10, color: 'var(--slate-400)' }}>All outstanding invoices allocated.</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="rct-field full-width">
                        <label>Notes</label>
                        <div className="rct-input-wrap">
                            <textarea
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                placeholder="Additional notes..."
                                rows={2}
                            />
                        </div>
                    </div>
                </div>

                <div className="rct-actions">
                    <button type="button" onClick={onClose} className="rct-btn-secondary">Cancel</button>
                    <button type="submit" disabled={loading || !selectedCustomer} className="rct-btn-primary">
                        <Save size={16} />
                        {loading ? 'Saving...' : record?.id ? 'Update Receipt' : 'Record Receipt'}
                    </button>
                </div>
            </form>

            <style>{`
                .rct-form { padding: 4px; }
                .rct-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 16px;
                }
                .full-width { grid-column: span 2; }
                .rct-field { position: relative; }
                .rct-field label {
                    display: block;
                    font-size: 11px;
                    font-weight: 600;
                    color: var(--slate-600);
                    margin-bottom: 6px;
                }
                .rct-input-wrap { position: relative; }
                .rct-input-wrap .rct-icon {
                    position: absolute;
                    left: 12px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: var(--slate-400);
                }
                .rct-input-wrap.disabled { opacity: 0.7; }
                .rct-input-wrap input, .rct-input-wrap select {
                    width: 100%;
                    padding: 10px 12px 10px 38px;
                    border: 1.5px solid var(--slate-200);
                    border-radius: 8px;
                    font-size: 11px;
                    outline: none;
                }
                .rct-input-wrap textarea {
                    width: 100%;
                    padding: 10px 12px;
                    border: 1.5px solid var(--slate-200);
                    border-radius: 8px;
                    font-size: 11px;
                    outline: none;
                    resize: vertical;
                }

                .rct-select-trigger {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 8px;
                    padding: 10px 12px;
                    border: 1.5px solid var(--slate-200);
                    border-radius: 8px;
                    background: var(--card-bg);
                    cursor: pointer;
                    font-size: 12px;
                    min-height: 42px;
                    transition: border-color 0.15s, box-shadow 0.15s;
                }
                .rct-select-trigger.open {
                    border-color: var(--primary-500);
                    box-shadow: 0 0 0 3px rgba(59,130,246,0.12);
                }
                .rct-chevron { color: var(--slate-400); transition: transform 0.2s; }
                .rct-chevron.rotated { transform: rotate(180deg); }
                .rct-clear-btn {
                    background: none; border: none; cursor: pointer; color: var(--slate-400);
                    padding: 2px 4px; border-radius: 4px;
                }
                .rct-clear-btn:hover { color: var(--danger); background: var(--danger-50); }

                .rct-dropdown-panel {
                    position: absolute;
                    top: calc(100% + 4px);
                    left: 0; right: 0;
                    background: var(--card-bg);
                    border: 1.5px solid var(--slate-200);
                    border-radius: 10px;
                    box-shadow: 0 12px 32px rgba(0,0,0,0.12);
                    z-index: 9999;
                    overflow: hidden;
                }
                .rct-dropdown-search {
                    display: flex; align-items: center; gap: 8px;
                    padding: 10px 14px;
                    border-bottom: 1.5px solid var(--slate-100);
                    background: var(--slate-50);
                }
                .rct-dropdown-search input {
                    flex: 1; border: none; background: none; font-size: 12px; outline: none;
                    color: var(--foreground); padding: 0;
                }
                .rct-dropdown-list { max-height: 260px; overflow-y: auto; }
                .rct-dropdown-item {
                    padding: 10px 14px;
                    cursor: pointer;
                    display: flex; align-items: center; gap: 12px;
                    border-bottom: 1px solid var(--slate-50);
                }
                .rct-dropdown-item:hover { background: rgba(59,130,246,0.04); }
                .rct-dropdown-item.selected { background: rgba(59,130,246,0.07); }
                .rct-no-results {
                    padding: 20px; text-align: center; font-size: 11px; color: var(--slate-400);
                }

                .rct-summary {
                    background: var(--slate-50);
                    border: 1.5px solid var(--slate-100);
                    border-radius: 10px;
                    padding: 14px 16px;
                    display: flex; flex-direction: column; gap: 6px;
                }
                .rct-summary-row { display: flex; justify-content: space-between; font-size: 11px; color: var(--slate-600); }
                .rct-summary-val { font-weight: 600; color: var(--slate-800); }
                .rct-summary-row.highlight {
                    font-weight: 700; color: var(--primary-700); font-size: 12px;
                }
                .rct-summary-row.highlight .rct-summary-val { color: var(--primary-700); font-weight: 800; }

                .rct-alloc {
                    border: 1.5px dashed var(--slate-200);
                    border-radius: 10px;
                    padding: 14px;
                    background: rgba(59,130,246,0.02);
                }
                .rct-alloc-header {
                    display: flex; align-items: flex-start; justify-content: space-between;
                    gap: 12px; margin-bottom: 10px;
                }
                .rct-alloc-status {
                    display: flex; gap: 12px; font-size: 10px; color: var(--slate-500);
                }
                .rct-alloc-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 11px;
                    margin-bottom: 10px;
                }
                .rct-alloc-table th, .rct-alloc-table td {
                    padding: 6px;
                    border-bottom: 1px solid var(--slate-100);
                    text-align: left;
                }
                .rct-alloc-table th { font-weight: 600; color: var(--slate-600); }
                .rct-alloc-table input {
                    width: 110px;
                    padding: 5px 8px;
                    border: 1.5px solid var(--slate-200);
                    border-radius: 6px;
                    font-size: 11px;
                    outline: none;
                }
                .rct-alloc-del {
                    padding: 4px;
                    background: none;
                    border: 1px solid var(--slate-200);
                    border-radius: 5px;
                    color: var(--danger);
                    cursor: pointer;
                }
                .rct-alloc-picker {
                    border-top: 1px dashed var(--slate-200);
                    padding-top: 10px;
                }
                .rct-alloc-chips { display: flex; flex-wrap: wrap; gap: 6px; }
                .rct-alloc-chip {
                    display: inline-flex; align-items: center; gap: 4px;
                    padding: 5px 9px;
                    border: 1.5px solid var(--slate-200);
                    border-radius: 16px;
                    background: var(--card-bg);
                    font-size: 10px;
                    cursor: pointer;
                    color: var(--slate-700);
                }
                .rct-alloc-chip:hover { border-color: var(--primary-400); color: var(--primary-700); }

                .rct-actions {
                    display: flex; justify-content: flex-end; gap: 12px;
                    margin-top: 24px; padding-top: 16px;
                    border-top: 1.5px solid var(--slate-100);
                }
                .rct-btn-secondary {
                    padding: 8px 16px; border-radius: 8px;
                    border: 1.5px solid var(--slate-200);
                    background: var(--card-bg);
                    font-size: 11px; font-weight: 600; cursor: pointer;
                }
                .rct-btn-primary {
                    display: flex; align-items: center; gap: 8px;
                    padding: 8px 20px; border-radius: 8px; border: none;
                    background: var(--primary-600); color: white;
                    font-size: 11px; font-weight: 600; cursor: pointer;
                }
                .rct-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
            `}</style>
        </Modal>
    );
}
