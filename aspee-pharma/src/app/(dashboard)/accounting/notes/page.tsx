'use client';

import React, { useState, useEffect } from 'react';
import PageHeader from '@/components/PageHeader';
import { Calendar, Printer, Save, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/currency';
import { toast } from 'sonner';
import Link from 'next/link';

interface LedgerEntry {
    source: string;
    date: string;
    account_name: string;
    debit: number;
    credit: number;
    description: string;
    type: string;
    subtype: string;
    code: string;
}

type Overrides = Record<string, number>;
type TextOverrides = Record<string, string>;

export default function AccountingNotesPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [entries, setEntries] = useState<LedgerEntry[]>([]);
    const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [editMode, setEditMode] = useState(false);
    const [overrides, setOverrides] = useState<Overrides>({});
    const [textOverrides, setTextOverrides] = useState<TextOverrides>({
        reportingEntity: "Aspee Pharmaceutical Limited engages itself in the manufacture of pharmaceutical products. It is a limited liability company incorporated and domiciled in Ghana. The registered office is located at Ejisu, Ashanti Region.",
        basisOfPreparation: "The financial statements have been prepared on a historical cost basis and in accordance with International Financial Reporting Standards (IFRS) for small and medium size entities and in compliance with Ghana's Company Code 1963, Act 179. The financial statements are presented in Ghana Cedis (GHC) which is the company’s functional currency.",
        estimatesAndJudgement: "The preparation of financial statements in conformity with IFRS required management to make judgement, estimates and assumptions that affect the application of policies and reported amounts of assets, liabilities, income and expenses. The estimates and associated assumptions are based on historical experience and various other factors that are believed to be reasonable under the circumstances, the results of which form the basis of making the judgement about carrying values of assets and liabilities that are not readily apparent from other sources. Actual results only differ from these estimates. The estimates and underlying assumptions are reviewed on an ongoing basis. Revisions to accounting estimates are recognized in the period in which the estimate is revised if the revision affects only that period or in the period of the revision and future periods if the revision affects both current and future periods.",
        revenueRecognition: "Revenue is recognized to the extent that it is probable the economic benefits will flow to the company and the revenue can be reliably measured. Revenue is measured at the fair value of the consideration received, excluding discounts, rebates, and sales taxes or duty. The following specific recognition criteria must also be met before revenue is recognized:",
        interestIncome: "Revenue is recognized as interest accrues. Interest income is included in finance revenue in the income statement.",
        ppeCont: "Costs associated with routine servicing and maintenance of assets are expensed as incurred. Subsequent expenditure is only capitalized if it is probable that future economic benefits associated with the item will flow to the company.\nAn item of property, plant and equipment is derecognized upon disposal or when no future economic benefits are expected to arise from the continued use of the asset. Any gain or loss arising on derecognizing of the asset (calculated as the difference between the net disposal process and the carrying amount of the item) is included in the income statement in the year the item is derecognized.\n\nResidual values, useful lives and methods of depreciation for property, plant and equipment are reviewed, and adjusted if appropriate, at each financial year end.",
        investments: "Investments are purchased with the intention of being held to maturity and they are stated at fair value. The discount is disclosed separately as interest income, whilst the unearned portion is stated in the accounts as a liability.",
        dividend: "Dividends declared are treated as an appropriation of profit in the year approval while dividends proposed are disclosed as a note to the financial statements.",
        cashEquivalents: "For the purpose of cash flow statement, cash and cash equivalent include cash, non – restricted balances with Bank of Ghana amounts due from banks and financial institutions and short term government securities maturing in three months or less from the date of acquisition.",
        postBalanceEvents: "Events subsequent to the statement of financial position date are reflected in the financial statements only to the extent that they relate to the year under consideration and the effect is material."
    });

    useEffect(() => {
        fetchReportData();
    }, [startDate, endDate]);

    const fetchReportData = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('financial_ledgers')
                .select('*')
                .gte('date', startDate)
                .lte('date', endDate);
            if (error) throw error;
            setEntries(data || []);
        } catch (error: any) {
            toast.error('Failed to load report data: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const val = (key: string, ledger: number) => overrides[key] !== undefined ? overrides[key] : ledger;
    const txt = (key: string) => textOverrides[key];
    const fmt = (v: number) => formatCurrency(v).replace('GHS', '').trim();
    

    const handleOverride = (key: string, value: string) => {
        const num = parseFloat(value);
        setOverrides(prev => ({ ...prev, [key]: isNaN(num) ? 0 : num }));
    };

    const handleTextOverride = (key: string, value: string) => {
        setTextOverrides(prev => ({ ...prev, [key]: value }));
    };

    // --- Note 4: Cost of Sales Calculations ---
    const getVal = (nameMatch: string) => entries.filter(e => e.account_name.toLowerCase().includes(nameMatch.toLowerCase())).reduce((sum, e) => sum + (e.debit - e.credit), 0);
    
    // A. Cost of Manufactured Goods (Materials)
    const ledgerOpeningStockRM = getVal('Opening Stock - Raw Materials');
    const ledgerPurchases = getVal('Purchases - Raw Materials');
    const ledgerHandling = getVal('Handling and Delivery');
    const ledgerClosingStockRM = getVal('Closing Stock - Raw Materials');

    const openingStockRM = val('openingStockRM', ledgerOpeningStockRM);
    const purchases = val('purchases', ledgerPurchases);
    const handling = val('handling', ledgerHandling);
    const rawMaterialsAvailable = openingStockRM + purchases + handling;
    const closingStockRM = val('closingStockRM', ledgerClosingStockRM);
    const rawMaterialsUsed = rawMaterialsAvailable - closingStockRM;

    // B. Manufacturing Expenses
    const ledgerUniforms = getVal('Factory Protective Uniform');
    const ledgerConsumables = getVal('Lab/Production Consumables');
    const ledgerRepairs = getVal('Factory Equipment & Machine Repairs');
    const ledgerSalaries = getVal('Factory Salaries & Wages');
    const ledgerUtility = getVal('Electricity & Water');
    const ledgerFuel = getVal('Generating Plant Fuel & Lubricants');
    const ledgerDepreciation = getVal('Depreciation - Factory');

    const uniforms = val('uniforms', ledgerUniforms);
    const consumables = val('consumables', ledgerConsumables);
    const repairs = val('repairs', ledgerRepairs);
    const salaries = val('salaries', ledgerSalaries);
    const utility = val('utility', ledgerUtility);
    const fuel = val('fuel', ledgerFuel);
    const depreciation = val('depreciation', ledgerDepreciation);

    const totalProdExpenses = uniforms + consumables + repairs + salaries + utility + fuel + depreciation;
    const costOfManufacturedGoods = rawMaterialsUsed + totalProdExpenses;

    // C. Cost of Sales (Finished Goods)
    const ledgerOpeningStockFG = getVal('Opening Stock - Finished Goods');
    const ledgerClosingStockFG = getVal('Closing Stock - Finished Goods');

    const openingStockFG = val('openingStockFG', ledgerOpeningStockFG);
    const closingStockFG = val('closingStockFG', ledgerClosingStockFG);
    const costOfSales = costOfManufacturedGoods + openingStockFG - closingStockFG;
    // --- Note 5: Administrative & General Expenses ---
    const ledgerDirectorsEmoluments = getVal('Directors Emoluments');
    const ledgerGroundRent = getVal('Ground Rent & Property Rate');
    const ledgerInsurance = getVal('Insurance');
    const ledgerStaffSalaries = getVal('Staff Salaries');
    const ledgerCleaning = getVal('Cleaning & Sanitation');
    const ledgerTelecom = getVal('Telecommunication and Postages Exp.');
    const ledgerPrinting = getVal('Printing & Stationery');
    const ledgerStaffMedical = getVal('Staff Medical and Welfare Expense');
    const ledgerSSF = getVal('SSF Contributions');
    const ledgerSecurity = getVal('Security Expenses');
    const ledgerMarketing = getVal('Marketing and Distribution Expenses');
    
    // --- Note 8: Cash & Bank (User's Note 6) ---
    const ledgerGCB = getVal('GCB Bank Balance');
    const ledgerJuaben = getVal('Juaben Rural Bank');
    const ledgerCashHolding = getVal('Cash Holding Balance');
    const totalCash = ledgerGCB + ledgerJuaben + ledgerCashHolding;

    // --- Note 10: Taxation (User's Note 8) ---
    const ledgerTaxBf = getVal('Income Tax Payable (B/f)');
    const ledgerTaxCharge = getVal('Income Tax Expense (Charge)');
    const ledgerTaxPayments = getVal('Income Tax Paid');
    const taxBf = val('taxBf', ledgerTaxBf);
    const taxCharge = val('taxCharge', ledgerTaxCharge);
    const taxPayments = val('taxPayments', ledgerTaxPayments);
    const taxCf = taxBf + taxCharge - taxPayments;

    // --- Note 11: Loans & Overdrafts (User's Note 9) ---
    const ledgerJuabenLoan = getVal('Juaben Rural Bank Loan');
    const ledgerCalBankCA = getVal('CAL Bank Current Account');
    const ledgerCalBankLC = getVal('CAL Bank L/C Loan');
    const totalLoans = ledgerJuabenLoan + ledgerCalBankCA + ledgerCalBankLC;

    const ledgerPeriodicals = getVal('News Papers/Periodicals');
    const ledgerAdvertising = getVal('Advertising & Business Promotions');
    const ledgerVehicleRunning = getVal('Vehicle Running & Maintenance');
    const ledgerAudit = getVal('Audit & Accountancy');
    const ledgerStaffCanteen = getVal('Staff Canteen Expenses');
    const ledgerProfessionalDues = getVal('Professional Association Dues/License');
    const ledgerAdminDepreciation = getVal('Depreciation Charges');
    const ledgerBonusAllowances = getVal('Staff Bonus and Allowances');
    const ledgerConsultancyFees = getVal('Professional and Consultancy Fees');
    const ledgerStaffTraining = getVal('Staff Training & Development');
    const ledgerRepairsBuilding = getVal('Repairs & Maintenance - Building');
    const ledgerOfficeGeneral = getVal('Office General Expenses');
    const ledgerDonations = getVal('Donations, Protocol & Entertainment');
    const ledgerRegistration = getVal('Registration & Licensing');
    const ledgerResearchDevelopment = getVal('Research & Development');
    const ledgerSeminarsConferences = getVal('Seminars & Conferences');

    const adminTotal = ledgerDirectorsEmoluments + ledgerGroundRent + ledgerInsurance + ledgerStaffSalaries + ledgerCleaning + ledgerTelecom + ledgerPrinting + ledgerStaffMedical + ledgerSSF + ledgerSecurity + ledgerMarketing + ledgerPeriodicals + ledgerAdvertising + ledgerVehicleRunning + ledgerAudit + ledgerStaffCanteen + ledgerProfessionalDues + ledgerAdminDepreciation + ledgerBonusAllowances + ledgerConsultancyFees + ledgerStaffTraining + ledgerRepairsBuilding + ledgerOfficeGeneral + ledgerDonations + ledgerRegistration + ledgerResearchDevelopment + ledgerSeminarsConferences;

    // --- Note 6: Finance Cost ---
    const ledgerBankCharges = getVal('Bank Charges & Loan Interests');

    const saveAdjustments = async () => {
        setSaving(true);
        try {
            // Numeric Adjustments
            const adjMap: Record<string, { ledger: number; name: string }> = {
                openingStockRM: { ledger: ledgerOpeningStockRM, name: 'Opening Stock - Raw Materials' },
                purchases: { ledger: ledgerPurchases, name: 'Purchases - Raw Materials' },
                handling: { ledger: ledgerHandling, name: 'Handling and Delivery' },
                closingStockRM: { ledger: ledgerClosingStockRM, name: 'Closing Stock - Raw Materials' },
                uniforms: { ledger: ledgerUniforms, name: 'Factory Protective Uniform' },
                consumables: { ledger: ledgerConsumables, name: 'Lab/Production Consumables' },
                repairs: { ledger: ledgerRepairs, name: 'Factory Equipment & Machine Repairs' },
                salaries: { ledger: ledgerSalaries, name: 'Factory Salaries & Wages' },
                utility: { ledger: ledgerUtility, name: 'Electricity & Water' },
                fuel: { ledger: ledgerFuel, name: 'Generating Plant Fuel & Lubricants' },
                depreciation: { ledger: ledgerDepreciation, name: 'Depreciation - Factory' },
                openingStockFG: { ledger: ledgerOpeningStockFG, name: 'Opening Stock - Finished Goods' },
                closingStockFG: { ledger: ledgerClosingStockFG, name: 'Closing Stock - Finished Goods' },
                // Admin Expenses
                directorsEmoluments: { ledger: ledgerDirectorsEmoluments, name: 'Directors Emoluments' },
                groundRent: { ledger: ledgerGroundRent, name: 'Ground Rent & Property Rate' },
                insurance: { ledger: ledgerInsurance, name: 'Insurance' },
                staffSalaries: { ledger: ledgerStaffSalaries, name: 'Staff Salaries' },
                cleaning: { ledger: ledgerCleaning, name: 'Cleaning & Sanitation' },
                telecom: { ledger: ledgerTelecom, name: 'Telecommunication and Postages Exp.' },
                printing: { ledger: ledgerPrinting, name: 'Printing & Stationery' },
                staffMedical: { ledger: ledgerStaffMedical, name: 'Staff Medical and Welfare Expense' },
                ssf: { ledger: ledgerSSF, name: 'SSF Contributions' },
                security: { ledger: ledgerSecurity, name: 'Security Expenses' },
                marketing: { ledger: ledgerMarketing, name: 'Marketing and Distribution Expenses' },
                periodicals: { ledger: ledgerPeriodicals, name: 'News Papers/Periodicals' },
                advertising: { ledger: ledgerAdvertising, name: 'Advertising & Business Promotions' },
                vehicleRunning: { ledger: ledgerVehicleRunning, name: 'Vehicle Running & Maintenance' },
                audit: { ledger: ledgerAudit, name: 'Audit & Accountancy' },
                staffCanteen: { ledger: ledgerStaffCanteen, name: 'Staff Canteen Expenses' },
                professionalDues: { ledger: ledgerProfessionalDues, name: 'Professional Association Dues/License' },
                adminDepreciation: { ledger: ledgerAdminDepreciation, name: 'Depreciation Charges' },
                bonusAllowances: { ledger: ledgerBonusAllowances, name: 'Staff Bonus and Allowances' },
                consultancyFees: { ledger: ledgerConsultancyFees, name: 'Professional and Consultancy Fees' },
                staffTraining: { ledger: ledgerStaffTraining, name: 'Staff Training & Development' },
                repairsBuilding: { ledger: ledgerRepairsBuilding, name: 'Repairs & Maintenance - Building' },
                officeGeneral: { ledger: ledgerOfficeGeneral, name: 'Office General Expenses' },
                donations: { ledger: ledgerDonations, name: 'Donations, Protocol & Entertainment' },
                registration: { ledger: ledgerRegistration, name: 'Registration & Licensing' },
                researchDevelopment: { ledger: ledgerResearchDevelopment, name: 'Research & Development' },
                seminarsConferences: { ledger: ledgerSeminarsConferences, name: 'Seminars & Conferences' },
                // Finance Costs
                bankCharges: { ledger: ledgerBankCharges, name: 'Bank Charges & Loan Interests' },
            };

            let count = 0;
            for (const [key, override] of Object.entries(overrides)) {
                const map = adjMap[key];
                if (!map) continue;
                const diff = override - map.ledger;
                if (Math.abs(diff) < 0.01) continue;

                const now = new Date();
                const entryNum = `NJL-${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;

                await supabase.from('journal_entries').insert({
                    entry_number: entryNum,
                    date: endDate,
                    description: `Note adjustment: ${map.name}`,
                    ref_type: 'Adjustment',
                    debit_account: diff > 0 ? map.name : 'Cash for Expenses',
                    debit_amount: Math.abs(diff),
                    credit_account: diff > 0 ? 'Cash for Expenses' : map.name,
                    credit_amount: Math.abs(diff),
                    created_by: 'Accountant',
                    notes: 'Manual override from Accounting Notes',
                });
                count++;
            }

            // Text overrides could be saved to a preferences table but for now we'll just show success
            toast.success(`${count} adjustment(s) saved and text policies updated`);
            setOverrides({});
            setEditMode(false);
            fetchReportData();
        } catch (error: any) {
            toast.error('Failed to save: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handlePrint = () => window.print();

    const EditableCell = ({ fieldKey, ledgerValue }: { fieldKey: string; ledgerValue: number }) => {
        const v = val(fieldKey, ledgerValue);
        const isOverridden = overrides[fieldKey] !== undefined && Math.abs(overrides[fieldKey] - ledgerValue) > 0.01;
        const [localVal, setLocalVal] = useState<string>(String(v));

        useEffect(() => {
            setLocalVal(String(val(fieldKey, ledgerValue)));
        }, [editMode, ledgerValue]);

        if (!editMode) return <span style={{ color: isOverridden ? 'var(--primary-600)' : 'inherit' }}>{fmt(v)}</span>;
        return (
            <input
                type="number" step="0.01"
                value={localVal}
                onChange={(e) => setLocalVal(e.target.value)}
                onBlur={() => handleOverride(fieldKey, localVal)}
                style={{
                    width: 120, padding: '4px 8px',
                    border: isOverridden ? '2px solid var(--primary-500)' : '1px solid var(--slate-300)',
                    borderRadius: 6, fontSize: 12, textAlign: 'right', outline: 'none',
                    background: isOverridden ? '#eff6ff' : '#fff', fontWeight: 600,
                }}
            />
        );
    };

    const EditableText = ({ fieldKey, label, isSub = false }: { fieldKey: string; label?: string; isSub?: boolean }) => {
        const v = txt(fieldKey);
        const [localVal, setLocalVal] = useState<string>(v);

        useEffect(() => { setLocalVal(txt(fieldKey)); }, [editMode, textOverrides[fieldKey]]);

        if (!editMode) return (
            <div style={{ marginBottom: 20 }}>
                {label && <h4 style={{ fontSize: 14, fontWeight: 700, textDecoration: 'underline', marginBottom: 8, marginTop: 15 }}>{label}</h4>}
                <p style={{ fontSize: 13, lineHeight: 1.6, textAlign: 'justify', color: '#1a1a1a' }}>
                    {isSub && <span style={{ fontWeight: 800, marginRight: 8 }}>•</span>}
                    {v}
                </p>
            </div>
        );
        return (
            <div style={{ marginBottom: 20 }}>
                {label && <h4 style={{ fontSize: 12, color: 'var(--slate-500)', marginBottom: 4 }}>{label}</h4>}
                <textarea
                    value={localVal}
                    onChange={(e) => setLocalVal(e.target.value)}
                    onBlur={() => handleTextOverride(fieldKey, localVal)}
                    rows={4}
                    style={{
                        width: '100%', padding: 12, border: '1px solid var(--slate-200)',
                        borderRadius: 8, fontSize: 13, lineHeight: 1.5, resize: 'vertical',
                        outline: 'none', fontFamily: 'inherit'
                    }}
                />
            </div>
        );
    };

    const Row = ({ label, fieldKey, ledgerValue, isTotal = false, indent = 0, underline = false, doubleUnderline = false, isBold = false }: any) => (
        <tr style={{ 
            height: 35, 
            borderBottom: underline ? '1px solid #000' : 'none',
            borderTop: doubleUnderline ? '3px double #000' : 'none'
        }}>
            <td style={{ fontSize: 13, paddingLeft: indent * 20, fontWeight: (isTotal || isBold) ? 700 : 400 }}>{label}</td>
            <td style={{ textAlign: 'right', padding: '0 20px', fontSize: 13 }}>
                {fieldKey ? <EditableCell fieldKey={fieldKey} ledgerValue={ledgerValue} /> : (isTotal ? '' : (ledgerValue !== undefined ? fmt(ledgerValue) : ''))}
            </td>
            <td style={{ textAlign: 'right', padding: '0 10px', fontSize: 13, fontWeight: (isTotal || isBold) ? 700 : 400 }}>
                {isTotal ? fmt(ledgerValue) : ''}
            </td>
        </tr>
    );

    const PPERow = ({ label, prefix = '' }: { label: string; prefix: string }) => {
        const costBg = val(`ppe_cost_bg_${prefix}`, 0);
        const costAdd = val(`ppe_cost_add_${prefix}`, 0);
        const costEnd = costBg + costAdd;

        const deprBg = val(`ppe_depr_bg_${prefix}`, 0);
        const deprCh = val(`ppe_depr_ch_${prefix}`, 0);
        const deprEnd = deprBg + deprCh;

        const nbv = costEnd - deprEnd;

        return (
            <tr style={{ height: 35, borderBottom: '1px solid #eee' }}>
                <td style={{ fontSize: 11, padding: '4px 0', fontWeight: 500 }}>{label}</td>
                <td style={{ textAlign: 'right' }}><EditableCell fieldKey={`ppe_cost_bg_${prefix}`} ledgerValue={0} /></td>
                <td style={{ textAlign: 'right' }}><EditableCell fieldKey={`ppe_cost_add_${prefix}`} ledgerValue={0} /></td>
                <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 11, paddingRight: 10 }}>{fmt(costEnd)}</td>
                <td style={{ textAlign: 'right' }}><EditableCell fieldKey={`ppe_depr_bg_${prefix}`} ledgerValue={0} /></td>
                <td style={{ textAlign: 'right' }}><EditableCell fieldKey={`ppe_depr_ch_${prefix}`} ledgerValue={0} /></td>
                <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 11, paddingRight: 10 }}>{fmt(deprEnd)}</td>
                <td style={{ textAlign: 'right', fontWeight: 800, fontSize: 11, color: '#000' }}>{fmt(nbv)}</td>
            </tr>
        );
    };

    return (
        <div style={{ padding: 20 }}>
            <div className="no-print">
                <PageHeader
                    title="Accounting Notes"
                    subtitle="Detailed breakdowns and notes to the financial statements"
                    actions={
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid var(--slate-200)', padding: '4px 12px', borderRadius: 8 }}>
                                <Calendar size={14} color="var(--slate-400)" />
                                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ border: 'none', fontSize: 12, outline: 'none' }} />
                                <span>-</span>
                                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ border: 'none', fontSize: 12, outline: 'none' }} />
                            </div>
                            {editMode ? (
                                <>
                                    <button onClick={() => { setEditMode(false); setOverrides({}); }} style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid var(--slate-300)', background: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                                    <button onClick={saveAdjustments} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: 'var(--primary-600)', color: '#fff', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                                        <Save size={16} /> {saving ? 'Saving...' : 'Save Adjustments'}
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button onClick={() => setEditMode(true)} style={{ padding: '10px 20px', background: '#fff', border: '1px solid var(--primary-400)', color: 'var(--primary-600)', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Edit Values</button>
                                    <button onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: 'var(--slate-900)', color: '#fff', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                                        <Printer size={16} /> Print
                                    </button>
                                </>
                            )}
                        </div>
                    }
                />

                <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
                    {[
                        { label: 'Comprehensive Income', href: '/accounting/comprehensive-income' },
                        { label: 'Financial Position', href: '/accounting/financial-position' },
                        { label: 'Cash Flow', href: '/accounting/cash-flow' },
                        { label: 'Journal Entries', href: '/accounting/journal' },
                    ].map(link => (
                        <Link key={link.href} href={link.href} style={{ padding: '6px 14px', borderRadius: 20, background: 'var(--card-bg)', border: '1px solid var(--slate-200)', fontSize: 11, fontWeight: 600, color: 'var(--slate-600)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <ExternalLink size={11} /> {link.label}
                        </Link>
                    ))}
                </div>
            </div>

            {/* ARTICULATED NOTES PAGE */}
            <div style={{ background: '#fff', maxWidth: 850, margin: '0 auto', padding: '80px 100px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', minHeight: '1056px', color: '#000', fontFamily: '"Times New Roman", Times, serif' }}>
                <div style={{ textAlign: 'center', marginBottom: 40 }}>
                    <h1 style={{ fontSize: 24, fontWeight: 800, textDecoration: 'underline', marginBottom: 10 }}>ASPEE PHARMACEUTICALS LIMITED</h1>
                    <h3 style={{ fontSize: 16, fontWeight: 700, textTransform: 'uppercase' }}>NOTES TO THE ACCOUNTS FOR THREE MONTHS ENDED 30TH JUNE, 2026</h3>
                </div>

                {/* NOTE 1: ACCOUNTING POLICIES */}
                <div style={{ marginBottom: 60 }}>
                    <h2 style={{ fontSize: 16, fontWeight: 800, textDecoration: 'underline', marginBottom: 20 }}>1. ACCOUNTING POLICIES</h2>
                    
                    <EditableText fieldKey="reportingEntity" label="A. Reporting Entity" />
                    
                    <div style={{ marginBottom: 40 }}>
                        <h4 style={{ fontSize: 14, fontWeight: 700, textDecoration: 'underline', marginBottom: 8 }}>B. Basis of Preparation</h4>
                        <EditableText fieldKey="basisOfPreparation" />
                        
                        <h4 style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>• Use of Estimates and Judgement</h4>
                        <EditableText fieldKey="estimatesAndJudgement" />
                    </div>

                    <div style={{ marginBottom: 40 }}>
                        <h4 style={{ fontSize: 14, fontWeight: 700, textDecoration: 'underline', marginBottom: 8 }}>C. Summary of Significant Accounting Policies</h4>
                        
                        <h4 style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>• Revenue Recognition</h4>
                        <EditableText fieldKey="revenueRecognition" />

                        <h4 style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>• Interest Income</h4>
                        <EditableText fieldKey="interestIncome" />
                    </div>
                </div>

                {/* NOTE 2: ACCOUNTING POLICIES (Continued) */}
                <div style={{ marginBottom: 60 }}>
                    <h2 style={{ fontSize: 16, fontWeight: 800, textDecoration: 'underline', marginBottom: 20 }}>2. ACCOUNTING POLICIES (Continued)</h2>
                    
                    <h4 style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>• Current Income Tax</h4>
                    <EditableText fieldKey="currentTax" />

                    <h4 style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>• Foreign Currency Translation</h4>
                    <EditableText fieldKey="foreignCurrency" />

                    <h4 style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>• Inventories</h4>
                    <EditableText fieldKey="inventories" />

                    <h4 style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>• Property, Plant and Equipment</h4>
                    <EditableText fieldKey="ppe" />
                    
                    <table style={{ width: '60%', marginLeft: '10%', borderCollapse: 'collapse', marginTop: 10 }}>
                        <tbody>
                            <tr>
                                <td style={{ fontSize: 13, padding: '4px 0' }}>Factory Building</td>
                                <td style={{ fontSize: 13, padding: '4px 0', textAlign: 'right' }}>3%</td>
                            </tr>
                            <tr>
                                <td style={{ fontSize: 13, padding: '4px 0' }}>Machinery & Equipment</td>
                                <td style={{ fontSize: 13, padding: '4px 0', textAlign: 'right' }}>20%</td>
                            </tr>
                            <tr>
                                <td style={{ fontSize: 13, padding: '4px 0' }}>Computers & Accessories</td>
                                <td style={{ fontSize: 13, padding: '4px 0', textAlign: 'right' }}>20%</td>
                            </tr>
                            <tr>
                                <td style={{ fontSize: 13, padding: '4px 0' }}>Furniture & Equipment</td>
                                <td style={{ fontSize: 13, padding: '4px 0', textAlign: 'right' }}>10%</td>
                            </tr>
                            <tr>
                                <td style={{ fontSize: 13, padding: '4px 0' }}>Motor Vehicles</td>
                                <td style={{ fontSize: 13, padding: '4px 0', textAlign: 'right' }}>10%</td>
                            </tr>
                            <tr>
                                <td style={{ fontSize: 13, padding: '4px 0' }}>Airconditioners</td>
                                <td style={{ fontSize: 13, padding: '4px 0', textAlign: 'right' }}>15%</td>
                            </tr>
                            <tr>
                                <td style={{ fontSize: 13, padding: '4px 0' }}>Lab Equipment</td>
                                <td style={{ fontSize: 13, padding: '4px 0', textAlign: 'right' }}>20%</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* NOTE 3: ACCOUNTING POLICIES (Continued) */}
                <div style={{ marginBottom: 60 }}>
                    <h2 style={{ fontSize: 16, fontWeight: 800, textDecoration: 'underline', marginBottom: 20 }}>3. ACCOUNTING POLICIES (Continued)</h2>
                    
                    <div style={{ marginBottom: 20 }}>
                        <EditableText fieldKey="ppeCont" />
                    </div>

                    <h4 style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>• Investments</h4>
                    <EditableText fieldKey="investments" />

                    <h4 style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>• Dividend</h4>
                    <EditableText fieldKey="dividend" />

                    <h4 style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>• Cash and Cash Equivalents</h4>
                    <EditableText fieldKey="cashEquivalents" />

                    <h4 style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>• Post Statement of Financial Position Events</h4>
                    <EditableText fieldKey="postBalanceEvents" />
                </div>

                {/* NOTE 4: COST OF SALES */}
                <div style={{ pageBreakBefore: 'always' }}>
                    <h2 style={{ fontSize: 16, fontWeight: 800, textDecoration: 'underline', marginBottom: 20 }}>4. COST OF SALES</h2>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 80, paddingRight: 20, marginBottom: 10, borderBottom: '2px solid #000' }}>
                        <span style={{ fontWeight: 800, fontSize: 13 }}>GHC</span>
                        <span style={{ fontWeight: 800, fontSize: 13 }}>GHC</span>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <tbody>
                            <Row label="Opening Stock-Raw Materials" fieldKey="openingStockRM" ledgerValue={ledgerOpeningStockRM} />
                            <Row label="Purchases" fieldKey="purchases" ledgerValue={ledgerPurchases} />
                            <Row label="Handling and Delivery" fieldKey="handling" ledgerValue={ledgerHandling} />
                            <tr style={{ height: 10 }}></tr>
                            <Row label="" ledgerValue={rawMaterialsAvailable} isTotal />
                            <Row label="Closing Stock" fieldKey="closingStockRM" ledgerValue={ledgerClosingStockRM} underline />
                            <tr style={{ height: 10 }}></tr>
                            <Row label="Raw Materials Used" ledgerValue={rawMaterialsUsed} isTotal />

                            <tr style={{ height: 30 }}></tr>
                            <tr>
                                <td colSpan={3} style={{ fontSize: 13, fontWeight: 800, textDecoration: 'underline' }}>MANUFACTURING EXPENSES</td>
                            </tr>
                            <Row label="Factory Protective Uniform" fieldKey="uniforms" ledgerValue={ledgerUniforms} />
                            <Row label="Lab/Production Consumables" fieldKey="consumables" ledgerValue={ledgerConsumables} />
                            <Row label="Factory Equipment & Machine Repairs" fieldKey="repairs" ledgerValue={ledgerRepairs} />
                            <Row label="Factory Salaries & Wages" fieldKey="salaries" ledgerValue={ledgerSalaries} />
                            <Row label="Electricity & Water" fieldKey="utility" ledgerValue={ledgerUtility} />
                            <Row label="Generating Plant Fuel & Lubricants" fieldKey="fuel" ledgerValue={ledgerFuel} />
                            <Row label="Depreciation" fieldKey="depreciation" ledgerValue={ledgerDepreciation} underline />
                            
                            <tr style={{ height: 10 }}></tr>
                            <Row label="TOTAL PRODUCTION EXPENSES" ledgerValue={totalProdExpenses} isTotal />

                            <tr style={{ height: 30 }}></tr>
                            <Row label="COST OF MANUFACTURED GOODS (a+b)" ledgerValue={costOfManufacturedGoods} isTotal isBold />

                            <tr style={{ height: 30 }}></tr>
                            <Row label="+Opening Stock: Finished Goods" fieldKey="openingStockFG" ledgerValue={ledgerOpeningStockFG} />
                            <Row label="-Closing Stock: Finished Goods" fieldKey="closingStockFG" ledgerValue={ledgerClosingStockFG} underline />
                            
                            <tr style={{ height: 20 }}></tr>
                            <Row label="COST OF SALES" ledgerValue={costOfSales} isTotal doubleUnderline />
                        </tbody>
                    </table>
                </div>

                {/* NOTE 5: ADMINISTRATIVE & GEN. EXPENSES */}
                <div style={{ pageBreakBefore: 'always', marginTop: 40 }}>
                    <h2 style={{ fontSize: 16, fontWeight: 800, textDecoration: 'underline', marginBottom: 20 }}>5. ADMINISTRATIVE & GEN. EXPENSES</h2>

                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <tbody>
                            <Row label="Directors Emoluments" fieldKey="directorsEmoluments" ledgerValue={ledgerDirectorsEmoluments} />
                            <Row label="Ground Rent & Property Rate" fieldKey="groundRent" ledgerValue={ledgerGroundRent} />
                            <Row label="Insurance" fieldKey="insurance" ledgerValue={ledgerInsurance} />
                            <Row label="Staff Salaries" fieldKey="staffSalaries" ledgerValue={ledgerStaffSalaries} />
                            <Row label="Cleaning & Sanitation" fieldKey="cleaning" ledgerValue={ledgerCleaning} />
                            <Row label="Telecommunication and Postages Exp." fieldKey="telecom" ledgerValue={ledgerTelecom} />
                            <Row label="Printing & Stationery" fieldKey="printing" ledgerValue={ledgerPrinting} />
                            <Row label="Staff Medical and Welfare Expense" fieldKey="staffMedical" ledgerValue={ledgerStaffMedical} />
                            <Row label="SSF Contributions" fieldKey="ssf" ledgerValue={ledgerSSF} />
                            <Row label="Security Expenses" fieldKey="security" ledgerValue={ledgerSecurity} />
                            <Row label="Marketing and Distribution Expenses" fieldKey="marketing" ledgerValue={ledgerMarketing} />
                            <Row label="News Papers/Periodicals" fieldKey="periodicals" ledgerValue={ledgerPeriodicals} />
                            <Row label="Advertising & Business Promotions" fieldKey="advertising" ledgerValue={ledgerAdvertising} />
                            <Row label="Vehicle Running & Maintenance" fieldKey="vehicleRunning" ledgerValue={ledgerVehicleRunning} />
                            <Row label="Audit & Accountancy" fieldKey="audit" ledgerValue={ledgerAudit} />
                            <Row label="Staff Canteen Expenses" fieldKey="staffCanteen" ledgerValue={ledgerStaffCanteen} />
                            <Row label="Professional Association Dues/License" fieldKey="professionalDues" ledgerValue={ledgerProfessionalDues} />
                            <Row label="Depreciation Charges" fieldKey="adminDepreciation" ledgerValue={ledgerAdminDepreciation} />
                            <Row label="Staff Bonus and Allowances" fieldKey="bonusAllowances" ledgerValue={ledgerBonusAllowances} />
                            <Row label="Professional and Consultancy Fees" fieldKey="consultancyFees" ledgerValue={ledgerConsultancyFees} />
                            <Row label="Staff Training & Development" fieldKey="staffTraining" ledgerValue={ledgerStaffTraining} />
                            <Row label="Repairs & Maintenance - Building" fieldKey="repairsBuilding" ledgerValue={ledgerRepairsBuilding} />
                            <Row label="Office General Expenses" fieldKey="officeGeneral" ledgerValue={ledgerOfficeGeneral} />
                            <Row label="Donations, Protocol & Entertainment" fieldKey="donations" ledgerValue={ledgerDonations} />
                            <Row label="Registration & Licensing" fieldKey="registration" ledgerValue={ledgerRegistration} />
                            <Row label="Research & Development" fieldKey="researchDevelopment" ledgerValue={ledgerResearchDevelopment} />
                            <Row label="Seminars & Conferences" fieldKey="seminarsConferences" ledgerValue={ledgerSeminarsConferences} underline />
                            
                            <tr style={{ height: 20 }}></tr>
                            <Row label="TOTAL ADMINISTRATIVE & GEN. EXPENSES" ledgerValue={adminTotal} isTotal doubleUnderline />
                        </tbody>
                    </table>
                </div>

                {/* NOTE 6: FINANCE COST */}
                <div style={{ marginTop: 40 }}>
                    <h2 style={{ fontSize: 16, fontWeight: 800, textDecoration: 'underline', marginBottom: 20 }}>6. FINANCE COST</h2>

                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <tbody>
                            <Row label="Bank Charges & Loan Interests" fieldKey="bankCharges" ledgerValue={ledgerBankCharges} underline />
                            <tr style={{ height: 20 }}></tr>
                            <Row label="TOTAL FINANCE COST" ledgerValue={ledgerBankCharges} isTotal doubleUnderline />
                        </tbody>
                    </table>
                </div>

                {/* NOTE 7 (User's Note 6): PROPERTY, PLANT & EQUIPMENT */}
                <div style={{ pageBreakBefore: 'always', marginTop: 40, width: '120%', marginLeft: '-10%' }}>
                    <h2 style={{ fontSize: 16, fontWeight: 800, textDecoration: 'underline', marginBottom: 20 }}>6. PROPERTY, PLANT & EQUIPMENT</h2>

                    <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000' }}>
                        <thead>
                            <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #000' }}>
                                <th style={{ textAlign: 'left', padding: '8px 4px', fontSize: 11, width: '20%' }}>ASSET ITEM</th>
                                <th style={{ textAlign: 'right', padding: '8px 4px', fontSize: 10 }}>COST AT<br/>1/1/2026</th>
                                <th style={{ textAlign: 'right', padding: '8px 4px', fontSize: 10 }}>ADDITIONS</th>
                                <th style={{ textAlign: 'right', padding: '8px 4px', fontSize: 10 }}>COST AT<br/>6/30/2026</th>
                                <th style={{ textAlign: 'right', padding: '8px 4px', fontSize: 10 }}>DEPR AT<br/>1/1/2026</th>
                                <th style={{ textAlign: 'right', padding: '8px 4px', fontSize: 10 }}>CHARGE FOR<br/>PERIOD</th>
                                <th style={{ textAlign: 'right', padding: '8px 4px', fontSize: 10 }}>DEPR AT<br/>6/30/2026</th>
                                <th style={{ textAlign: 'right', padding: '8px 4px', fontSize: 11 }}>NET BOOK<br/>VALUE</th>
                            </tr>
                        </thead>
                        <tbody>
                            <PPERow label="Capital Work In Progress" prefix="cwip" />
                            <PPERow label="Factory Building" prefix="building" />
                            <PPERow label="Machinery and Equipment" prefix="machinery" />
                            <PPERow label="Storage Containers" prefix="containers" />
                            <PPERow label="Air Conditioners" prefix="ac" />
                            <PPERow label="Computer & Accessories" prefix="computers" />
                            <PPERow label="Office Furniture & Equipment" prefix="furniture" />
                            <PPERow label="Benz Bus AS 4998 X" prefix="bus1" />
                            <PPERow label="Urvan Bus AS 2103 Y" prefix="bus2" />
                            <PPERow label="Pick Up AS 5368 V" prefix="pickup" />
                            <PPERow label="Toyota 4 Runner AS 4573 Z" prefix="toyota4runner" />
                            <PPERow label="Opanka Benz Bus AW 2498-14" prefix="opanka" />
                            <PPERow label="Lab Equipment" prefix="lab" />
                            <PPERow label="Generators" prefix="generators" />
                            <PPERow label="Sprinter Bus AC 673-17" prefix="sprinter" />
                            <PPERow label="Toyota Saloon - GS 927-16" prefix="saloon" />
                            <PPERow label="Toyota Haice Van AC 143-17" prefix="hiace" />
                            <PPERow label="Kia Preggio Van AC 142-17" prefix="kia" />
                            <PPERow label="Benz Sprinter AC 811-17" prefix="benzsprinter" />
                            <PPERow label="Tablet Compressor" prefix="tablet" />
                        </tbody>
                    </table>
                </div>

                {/* NOTE 8 (Doc 6): CASH & BANK */}
                <div style={{ marginTop: 40 }}>
                    <h2 style={{ fontSize: 16, fontWeight: 800, textDecoration: 'underline', marginBottom: 20 }}>6. CASH & BANK</h2>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <tbody>
                            <Row label="GCB" fieldKey="gcb" ledgerValue={ledgerGCB} />
                            <Row label="Juaben Rural Bank" fieldKey="juaben" ledgerValue={ledgerJuaben} />
                            <Row label="Cash Holding Balance" fieldKey="cashHolding" ledgerValue={ledgerCashHolding} underline />
                            <tr style={{ height: 20 }}></tr>
                            <Row label="TOTAL CASH & BANK" ledgerValue={totalCash} isTotal doubleUnderline />
                        </tbody>
                    </table>
                </div>

                {/* NOTE 9 (Doc 7): STATED CAPITAL */}
                <div style={{ marginTop: 40 }}>
                    <h2 style={{ fontSize: 16, fontWeight: 800, textDecoration: 'underline', marginBottom: 20 }}>7. STATED CAPITAL</h2>
                    <div style={{ marginBottom: 15 }}>
                        <h4 style={{ fontSize: 14, fontWeight: 800, textDecoration: 'underline', marginBottom: 5 }}>Authorised</h4>
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: 20 }}>
                            <span style={{ fontSize: 13 }}>Ordinary Shares (No. of Shares)</span>
                            <div style={{ width: 150, textAlign: 'right' }}>
                                <EditableCell fieldKey="authShares" ledgerValue={500000} />
                            </div>
                        </div>
                    </div>
                    <div style={{ marginBottom: 15 }}>
                        <h4 style={{ fontSize: 14, fontWeight: 800, textDecoration: 'underline', marginBottom: 5 }}>Issued</h4>
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: 20 }}>
                            <span style={{ fontSize: 13 }}>Cash Consideration (No. of Shares)</span>
                            <div style={{ width: 150, textAlign: 'right' }}>
                                <EditableCell fieldKey="issuedShares" ledgerValue={270500} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: 20, marginTop: 5 }}>
                            <span style={{ fontSize: 13 }}>Proceeds (GHS)</span>
                            <div style={{ width: 150, textAlign: 'right', borderBottom: '1px solid #000' }}>
                                <EditableCell fieldKey="issuedProceeds" ledgerValue={270500} />
                            </div>
                        </div>
                    </div>
                    <p style={{ fontSize: 12, fontStyle: 'italic', color: '#444', marginTop: 10 }}>
                        There were no shares in Treasury and no calls or installment unpaid on any share.
                    </p>
                </div>

                {/* NOTE 10 (Doc 8): TAXATION */}
                <div style={{ marginTop: 40 }}>
                    <h2 style={{ fontSize: 16, fontWeight: 800, textDecoration: 'underline', marginBottom: 20 }}>8. TAXATION</h2>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <tbody>
                            <Row label="Balance B/f" fieldKey="taxBf" ledgerValue={ledgerTaxBf} />
                            <Row label="Charge for the Period" fieldKey="taxCharge" ledgerValue={ledgerTaxCharge} />
                            <Row label="Payments during the Period" fieldKey="taxPayments" ledgerValue={ledgerTaxPayments} underline />
                            <tr style={{ height: 20 }}></tr>
                            <Row label="Balance C/f" ledgerValue={taxCf} isTotal doubleUnderline />
                        </tbody>
                    </table>
                </div>

                {/* NOTE 11 (Doc 9): BANK OVERDRAFT & LOAN BALS */}
                <div style={{ marginTop: 40 }}>
                    <h2 style={{ fontSize: 16, fontWeight: 800, textDecoration: 'underline', marginBottom: 20 }}>9. BANK OVERDRAFT & LOAN BALS</h2>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <tbody>
                            <Row label="Juaben Rural Bank" fieldKey="juabenLoan" ledgerValue={ledgerJuabenLoan} />
                            <Row label="CAL Bank C/A" fieldKey="calBankCA" ledgerValue={ledgerCalBankCA} />
                            <Row label="CAL Bank L/C Loan A/C" fieldKey="calBankLC" ledgerValue={ledgerCalBankLC} underline />
                            <tr style={{ height: 20 }}></tr>
                            <Row label="TOTAL LOANS & OVERDRAFTS" ledgerValue={totalLoans} isTotal doubleUnderline />
                        </tbody>
                    </table>
                </div>
            </div>

            <style jsx global>{`
                @media print {
                    .no-print { display: none !important; }
                    body { background: white !important; }
                    .main-content { padding: 0 !important; margin: 0 !important; }
                    aside { display: none !important; }
                    header { display: none !important; }
                    input[type="number"] { border: none !important; background: transparent !important; }
                    textarea { border: none !important; resize: none !important; }
                }
            `}</style>
        </div>
    );
}
