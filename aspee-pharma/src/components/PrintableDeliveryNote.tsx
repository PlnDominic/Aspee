'use client';

import React from 'react';
import { formatCurrency } from '@/lib/formatCurrency';
import { MapPin, Phone, Mail, Truck, User, Calendar, Hash } from 'lucide-react';

interface PrintableDeliveryNoteProps {
    dispatch: any;
}

export default function PrintableDeliveryNote({ dispatch }: PrintableDeliveryNoteProps) {
    if (!dispatch) return null;

    return (
        <div id="printable-delivery-note" className="delivery-note-print-only">
            <div className="dn-container">
                {/* Header */}
                <div className="dn-header">
                    <div className="company-info">
                        <h1 className="company-name">ASPEE PHARMACEUTICALS LTD</h1>
                        <p className="company-tagline">Quality Healthcare for All</p>
                        <div className="contact-details">
                            <p><MapPin size={12} /> Ejisu - Asamang, Ashanti Region</p>
                            <p><Phone size={12} /> 0244791052 / 0501234567</p>
                            <p><Mail size={12} /> aspeepharmaceuticalsgh@gmail.com</p>
                        </div>
                    </div>
                    <div className="doc-type">
                        <h2>DELIVERY NOTE / DISPATCH</h2>
                        <div className="meta-grid">
                            <div className="meta-item">
                                <span className="label">Dispatch #:</span>
                                <span className="value">{dispatch.dispatch_number}</span>
                            </div>
                            <div className="meta-item">
                                <span className="label">Date:</span>
                                <span className="value">{new Date(dispatch.dispatch_date).toLocaleDateString()}</span>
                            </div>
                            <div className="meta-item">
                                <span className="label">Van:</span>
                                <span className="value">{dispatch.van?.name} ({dispatch.van?.license_plate})</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="dn-divider" />

                {/* Dispatch Details */}
                <div className="dn-body">
                    <h3 className="section-title">Assigned Invoices</h3>
                    <table className="dn-table">
                        <thead>
                            <tr>
                                <th style={{ textAlign: 'left', width: '40px' }}>#</th>
                                <th style={{ textAlign: 'left' }}>Invoice #</th>
                                <th style={{ textAlign: 'left' }}>Customer / Recipient</th>
                                <th style={{ textAlign: 'right' }}>Amount</th>
                                <th style={{ textAlign: 'center' }}>Status</th>
                                <th style={{ textAlign: 'left', width: '150px' }}>Customer Signature</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dispatch.items?.map((item: any, idx: number) => (
                                <tr key={idx}>
                                    <td>{idx + 1}</td>
                                    <td style={{ fontWeight: 700 }}>{item.invoice?.invoice_number}</td>
                                    <td>
                                        <div style={{ fontWeight: 600 }}>{item.invoice?.customer_name}</div>
                                        <div style={{ fontSize: 10, color: '#666' }}>Date: {new Date(item.invoice?.date).toLocaleDateString()}</div>
                                    </td>
                                    <td style={{ textAlign: 'right' }}>{formatCurrency(item.invoice?.total_amount)}</td>
                                    <td style={{ textAlign: 'center' }}>{item.status}</td>
                                    <td style={{ borderBottom: '1px solid #ccc', height: '40px' }}></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Footer / Signatures */}
                <div className="dn-footer">
                    <div className="notes-section">
                        <h4>Notes:</h4>
                        <p>{dispatch.notes || 'Please verify the quantity and condition of goods before signing.'}</p>
                    </div>

                    <div className="signature-grid">
                        <div className="sig-block">
                            <div className="sig-line" />
                            <p>Warehouse / Dispatch Manager</p>
                        </div>
                        <div className="sig-block">
                            <div className="sig-line" />
                            <p>Driver / Dispatcher</p>
                        </div>
                        <div className="sig-block">
                            <div className="sig-line" />
                            <p>Total Delivered Invoices Signature</p>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                @media screen {
                    .delivery-note-print-only { display: none; }
                }
                @media print {
                    .delivery-note-print-only { 
                        display: block; 
                        position: fixed;
                        top: 0; left: 0; right: 0; bottom: 0;
                        background: white;
                        z-index: 9999;
                        padding: 20mm;
                    }
                    body * { visibility: hidden; }
                    .delivery-note-print-only, .delivery-note-print-only * { visibility: visible; }
                    .dn-container { width: 100%; font-family: 'Inter', -apple-system, sans-serif; color: #1a1a1a; }
                    .dn-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; }
                    .company-name { font-size: 20px; font-weight: 800; margin: 0; color: #0f172a; }
                    .company-tagline { font-size: 12px; color: #64748b; font-style: italic; margin: 4px 0 12px 0; }
                    .contact-details p { display: flex; align-items: center; gap: 8px; font-size: 11px; margin: 4px 0; color: #334155; }
                    .doc-type h2 { font-size: 16px; font-weight: 800; text-align: right; margin: 0 0 15px 0; color: #0f172a; }
                    .meta-grid { display: grid; gap: 6px; }
                    .meta-item { display: flex; justify-content: flex-end; gap: 12px; font-size: 11px; }
                    .meta-item .label { color: #64748b; font-weight: 500; }
                    .meta-item .value { font-weight: 700; color: #0f172a; }
                    .dn-divider { height: 2px; background: #0f172a; margin: 20px 0; }
                    .section-title { font-size: 14px; font-weight: 700; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 0.05em; }
                    .dn-table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
                    .dn-table th { padding: 12px; border-bottom: 2px solid #0f172a; font-size: 11px; font-weight: 700; color: #475569; }
                    .dn-table td { padding: 12px; border-bottom: 1px solid #e2e8f0; font-size: 11px; vertical-align: middle; }
                    .dn-footer { margin-top: 50px; }
                    .notes-section { margin-bottom: 40px; padding: 15px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
                    .notes-section h4 { font-size: 11px; margin: 0 0 8px 0; text-transform: uppercase; color: #64748b; }
                    .notes-section p { font-size: 11px; margin: 0; line-height: 1.6; color: #334155; }
                    .signature-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 40px; margin-top: 60px; }
                    .sig-block { text-align: center; }
                    .sig-line { border-bottom: 1px solid #0f172a; margin-bottom: 8px; }
                    .sig-block p { font-size: 10px; font-weight: 600; color: #64748b; text-transform: uppercase; }
                }
            `}</style>
        </div>
    );
}
