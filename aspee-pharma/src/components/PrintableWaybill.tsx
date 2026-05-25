'use client';

import React from 'react';

export interface WaybillItem {
    product_name: string;
    current_stock: number;
    qty_returned: number | null;
    qty_received_from_stores: number | null;
    total_qty: number | null;
    total_value: number | null;
    units_per_carton: number;
    unit_label: string;
}

export interface WaybillData {
    waybill_number?: string;
    sales_person_name: string;
    driver_name: string;
    vehicle_no: string;
    route: string;
    date: string;
    items: WaybillItem[];
    grand_total: number;
}

interface Props {
    waybill: WaybillData;
    innerRef?: React.RefObject<HTMLDivElement | null>;
}

const th: React.CSSProperties = {
    border: '1px solid #000',
    padding: '5px 4px',
    textAlign: 'center',
    fontWeight: 700,
    fontSize: 10,
    backgroundColor: '#f0f0f0',
    verticalAlign: 'middle',
    lineHeight: 1.3,
};

const td: React.CSSProperties = {
    border: '1px solid #000',
    padding: '4px 6px',
    textAlign: 'center',
    fontSize: 10,
    verticalAlign: 'middle',
};

export default function PrintableWaybill({ waybill, innerRef }: Props) {
    const formatDate = (dateStr: string) => {
        try {
            const d = new Date(dateStr);
            const day = d.getDate();
            const month = d.toLocaleString('en-GB', { month: 'long' }).toUpperCase();
            const year = d.getFullYear();
            const s = [1, 21, 31].includes(day) ? 'ST' : [2, 22].includes(day) ? 'ND' : [3, 23].includes(day) ? 'RD' : 'TH';
            return `${day}${s} ${month}, ${year}`;
        } catch {
            return dateStr;
        }
    };

    const fmtQty = (n: number | null) =>
        n != null && n > 0 ? n.toLocaleString() : '-';

    const fmtVal = (n: number | null) =>
        n != null && n > 0
            ? n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : '-';

    return (
        <div
            ref={innerRef as React.RefObject<HTMLDivElement>}
            id="printable-waybill"
            style={{ fontFamily: 'Arial, Helvetica, sans-serif', color: '#000', background: '#fff', padding: '8mm 10mm' }}
        >
            {/* ─── Company Header ─── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                {/* Logo Section */}
                <div style={{ flexShrink: 0, width: 100 }}>
                    <img 
                        src="/logo.png" 
                        alt="ASPEE Logo" 
                        style={{ width: '100%', height: 'auto', display: 'block' }}
                        onError={(e) => {
                            // Fallback if image fails
                            e.currentTarget.style.display = 'none';
                            const parent = e.currentTarget.parentElement;
                            if (parent) {
                                parent.innerHTML = '<div style="width:64px;height:64px;border:2px solid #000;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:20px">AP</div>';
                            }
                        }}
                    />
                </div>

                <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: 0.5, textDecoration: 'underline' }}>
                        ASPEE PHARMACEUTICALS LTD
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4, textDecoration: 'underline' }}>
                        SALES AND MARKETING DEPARTMENT
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 900, marginTop: 8, textDecoration: 'underline', letterSpacing: 4 }}>
                        WAYBILL
                    </div>
                </div>

                {/* Balance space on right to keep title centered */}
                <div style={{ width: 100 }} />
            </div>

            {/* ─── Info Rows ─── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, fontSize: 11 }}>
                <div><strong>NAME OF SALES PERSON:</strong>&nbsp;{waybill.sales_person_name || '_______________'}</div>
                <div><strong>NAME OF DRIVER:</strong>&nbsp;{waybill.driver_name || '_______________'}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontSize: 11 }}>
                <div><strong>VEHICLE NO</strong>&nbsp;{waybill.vehicle_no || '___________'}</div>
                <div><strong>ROUTE:</strong>&nbsp;{waybill.route || '___________'}</div>
                <div><strong>DATE:</strong>&nbsp;{formatDate(waybill.date)}</div>
            </div>

            {/* ─── Product Table ─── */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10 }}>
                <thead>
                    <tr>
                        <th style={{ ...th, width: 32 }}>S/N</th>
                        <th style={{ ...th, textAlign: 'left' }}>PRODUCT</th>
                        <th style={{ ...th, width: 60 }}>CURR.<br />STOCK</th>
                        <th style={{ ...th, width: 100 }}>QTY RETURNED /<br />EXISTING</th>
                        <th style={{ ...th, width: 100 }}>LOAD NEW<br />STOCK</th>
                        <th style={{ ...th, width: 80 }}>TOTAL<br />QTY IN<br />VAN</th>
                        <th style={{ ...th, width: 100 }}>UNITS IN<br />VAN</th>
                        <th style={{ ...th, width: 100 }}>TOTAL VALUE<br />IN VAN (GHC)</th>
                    </tr>
                </thead>
                <tbody>
                    {waybill.items.map((item, idx) => {
                        const subUnits = item.total_qty != null && item.units_per_carton > 1
                            ? `${item.total_qty * item.units_per_carton} ${item.unit_label}`
                            : '-';
                        return (
                            <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                                <td style={td}>{idx + 1}</td>
                                <td style={{ ...td, textAlign: 'left', fontWeight: 500 }}>{item.product_name}</td>
                                <td style={td}>{item.current_stock || 0}</td>
                                <td style={td}>{fmtQty(item.qty_returned)}</td>
                                <td style={td}>{fmtQty(item.qty_received_from_stores)}</td>
                                <td style={td}>{fmtQty(item.total_qty)}</td>
                                <td style={{ ...td, fontWeight: 600 }}>{subUnits}</td>
                                <td style={{ ...td, textAlign: 'right' }}>{fmtVal(item.total_value)}</td>
                            </tr>
                        );
                    })}
                </tbody>
                <tfoot>
                    <tr>
                        <td colSpan={6} style={{ border: 'none', padding: 0 }} />
                        <td style={{ ...td, fontWeight: 800, fontSize: 11, borderTop: '2px solid #000', backgroundColor: '#f0f0f0' }}>
                            TOTAL
                        </td>
                        <td style={{ ...td, fontWeight: 800, fontSize: 11, textAlign: 'right', borderTop: '2px solid #000', backgroundColor: '#f0f0f0' }}>
                            GHC{fmtVal(waybill.grand_total)}
                        </td>
                    </tr>
                </tfoot>
            </table>

            {/* ─── Signatures ─── */}
            <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 48 }}>
                {(['SALES PERSON', 'DRIVER', 'SALES MANAGER'] as const).map(label => (
                    <div key={label} style={{ textAlign: 'center', width: '28%' }}>
                        <div style={{ fontSize: 11, fontWeight: 700 }}>{label}</div>
                        <div style={{ marginTop: 32, borderBottom: '1px solid #000' }} />
                        <div style={{ marginTop: 4, fontSize: 10, letterSpacing: 1 }}>..............................</div>
                    </div>
                ))}
            </div>
        </div>
    );
}
