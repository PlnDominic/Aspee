-- ============================================================
-- ACCOUNTING SYSTEM UPDATE - FULL CHART OF ACCOUNTS
-- Standardizing Revenue, COGS, S&A, Assets, Liabilities, and Equity
-- ============================================================

-- 1. REVENUE (4000s)
INSERT INTO public.chart_of_accounts (code, name, type, subtype)
VALUES 
    ('4000', 'Sales - Finished goods', 'Revenue', 'Operating Revenue'),
    ('4100', 'Other Income', 'Revenue', 'Other Income')
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name, 
    type = EXCLUDED.type, 
    subtype = EXCLUDED.subtype;

-- 2. COST OF SALES (5000s)
INSERT INTO public.chart_of_accounts (code, name, type, subtype)
VALUES 
    ('5000', 'Cost of finished goods sold', 'Expense', 'Cost of Sales')
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name, 
    type = EXCLUDED.type, 
    subtype = EXCLUDED.subtype;

-- 3. SELLING & ADMINISTRATIVE (S&A) EXPENSES (6000s)
INSERT INTO public.chart_of_accounts (code, name, type, subtype)
VALUES
    ('6000', 'PAYE - GRA', 'Expense', 'S&A - Taxes'),
    ('6010', 'INTERNET EXPENSES', 'Expense', 'S&A - Utilities'),
    ('6020', 'ASPEE STAFF WELFARE SCHEME', 'Expense', 'S&A - Payroll'),
    ('6030', 'Staff Salaries (S&A)', 'Expense', 'S&A - Payroll'),
    ('6040', 'Staff Bonus and Allowances', 'Expense', 'S&A - Payroll'),
    ('6050', 'Staff Medical And Welfare Exp', 'Expense', 'S&A - Payroll'),
    ('6060', 'Staff Overtime (S&A)', 'Expense', 'S&A - Payroll'),
    ('6070', 'Feeding/Refreshment Expense', 'Expense', 'S&A - Payroll'),
    ('6080', 'Employee benefits (S&A)', 'Expense', 'S&A - Payroll'),
    ('6090', 'Travel & lodging (S&A)', 'Expense', 'S&A - Operations'),
    ('6100', 'Telecommunication and Postages (S&A)', 'Expense', 'S&A - Operations'),
    ('6110', 'Audit and Accountancy Exp', 'Expense', 'S&A - Professional'),
    ('6120', 'Marketing and Distribution Expense', 'Expense', 'S&A - Marketing'),
    ('6130', 'Protocol Exp', 'Expense', 'S&A - Operations'),
    ('6140', 'Rent expenses (S&A)', 'Expense', 'S&A - Occupancy'),
    ('6150', 'Repairing expenses (S&A)', 'Expense', 'S&A - Maintenance'),
    ('6160', 'Insurance expenses (S&A)', 'Expense', 'S&A - Financial'),
    ('6170', 'Vehicle Repairs & Maintenance Expense', 'Expense', 'S&A - Maintenance'),
    ('6180', 'Vehicle Fuel Expense', 'Expense', 'S&A - Operations'),
    ('6190', 'Staff Training and Education (S&A)', 'Expense', 'S&A - Payroll'),
    ('6200', 'Printing and Stationery Exp', 'Expense', 'S&A - Operations'),
    ('6210', 'Professional and Consultancy Fees', 'Expense', 'S&A - Professional'),
    ('6220', 'Seminars/Workshop/Training Exp', 'Expense', 'S&A - Payroll'),
    ('6230', 'Cleaning and Sanitation Exp', 'Expense', 'S&A - Maintenance'),
    ('6240', 'Advertising expenses (S&A)', 'Expense', 'S&A - Marketing'),
    ('6250', 'Building Repairs & Maintenance (S&A)', 'Expense', 'S&A - Maintenance'),
    ('6260', 'Equipment Repairs & Maintenance', 'Expense', 'S&A - Maintenance'),
    ('6270', 'ICT Expense', 'Expense', 'S&A - Professional'),
    ('6280', 'Sales commission (S&A)', 'Expense', 'S&A - Marketing'),
    ('6290', 'Registration & Licensing Exp', 'Expense', 'S&A - Professional'),
    ('6300', 'Research & Development Exp', 'Expense', 'S&A - Operations'),
    ('6310', 'Security Expense', 'Expense', 'S&A - Operations'),
    ('6320', 'Software Subscription Expense', 'Expense', 'S&A - Professional'),
    ('6330', 'Misc. expenses (S&A)', 'Expense', 'S&A - Operations'),
    ('6340', 'Bank Charges', 'Expense', 'S&A - Financial')
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name, 
    type = EXCLUDED.type, 
    subtype = EXCLUDED.subtype;

-- 4. CURRENT ASSETS (1000s)
INSERT INTO public.chart_of_accounts (code, name, type, subtype)
VALUES
    ('1000', 'Cash from Sales', 'Asset', 'Current Asset - Cash'),
    ('1010', 'Cash for Expenses', 'Asset', 'Current Asset - Cash'),
    ('1020', 'Bank Accounts', 'Asset', 'Current Asset - Cash'),
    ('1100', 'Accounts receivable', 'Asset', 'Current Asset - Receivables'),
    ('1110', 'Notes receivable', 'Asset', 'Current Asset - Receivables'),
    ('1200', 'WithHolding Tax Receivable', 'Asset', 'Current Asset - Other'),
    ('1210', 'Prepaid expenses', 'Asset', 'Current Asset - Other'),
    ('1220', 'Director Current Account', 'Asset', 'Current Asset - Other')
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name, 
    type = EXCLUDED.type, 
    subtype = EXCLUDED.subtype;

-- 5. NON-CURRENT & FIXED ASSETS (1300s-1500s)
INSERT INTO public.chart_of_accounts (code, name, type, subtype)
VALUES
    ('1300', 'Long-term loan receivables', 'Asset', 'Noncurrent Asset - Long-term'),
    ('1310', 'Security deposit paid', 'Asset', 'Noncurrent Asset - Long-term'),
    ('1320', 'Investments in unused land', 'Asset', 'Noncurrent Asset - Long-term'),
    ('1400', 'Land', 'Asset', 'Fixed Asset - Land'),
    ('1410', 'Buildings', 'Asset', 'Fixed Asset - PPE'),
    ('1411', 'Accu. Depreciation - Buildings', 'Asset', 'Fixed Asset - Contra'),
    ('1420', 'Building improvements', 'Asset', 'Fixed Asset - PPE'),
    ('1421', 'Accu. Depreciation - Building improvements', 'Asset', 'Fixed Asset - Contra'),
    ('1430', 'Machinery and Equipment', 'Asset', 'Fixed Asset - PPE'),
    ('1431', 'Accu. Depreciation - Machinery and Equipment', 'Asset', 'Fixed Asset - Contra'),
    ('1440', 'Vehicles', 'Asset', 'Fixed Asset - PPE'),
    ('1441', 'Accu. Depreciation - Vehicles', 'Asset', 'Fixed Asset - Contra'),
    ('1450', 'Furniture and Fixtures', 'Asset', 'Fixed Asset - PPE'),
    ('1451', 'Accu. Depreciation - Furniture and Fixtures', 'Asset', 'Fixed Asset - Contra'),
    ('1460', 'Office Equipment', 'Asset', 'Fixed Asset - PPE'),
    ('1461', 'Accu. Depreciation - Office Equipment', 'Asset', 'Fixed Asset - Contra'),
    ('1470', 'Buildings in process', 'Asset', 'Fixed Asset - PPE'),
    ('1480', 'Lab Equipment', 'Asset', 'Fixed Asset - PPE'),
    ('1481', 'Accu. Depreciation - Lab Equipment', 'Asset', 'Fixed Asset - Contra'),
    ('1490', 'Generator', 'Asset', 'Fixed Asset - PPE'),
    ('1491', 'Accu. Depreciation - Generator', 'Asset', 'Fixed Asset - Contra'),
    ('1500', 'Computer equipment', 'Asset', 'Fixed Asset - PPE'),
    ('1501', 'Accu. Depreciation - Computer equipment', 'Asset', 'Fixed Asset - Contra'),
    ('1510', 'Other Property', 'Asset', 'Fixed Asset - PPE'),
    ('1511', 'Accu. Depreciation - Other Property', 'Asset', 'Fixed Asset - Contra'),
    ('1600', 'Computer software', 'Asset', 'Intangible Asset'),
    ('1610', 'Accu. Amortization - Software', 'Asset', 'Intangible Asset - Contra')
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name, 
    type = EXCLUDED.type, 
    subtype = EXCLUDED.subtype;

-- 6. LIABILITIES (2000s)
INSERT INTO public.chart_of_accounts (code, name, type, subtype)
VALUES
    ('2000', 'Accounts payable', 'Liability', 'Current Liability - Payables'),
    ('2010', 'Non-trade payables', 'Liability', 'Current Liability - Payables'),
    ('2020', 'PAYE Payable', 'Liability', 'Current Liability - Taxes'),
    ('2030', 'Sales tax payable', 'Liability', 'Current Liability - Taxes'),
    ('2040', 'WithHolding Tax Payable', 'Liability', 'Current Liability - Taxes'),
    ('2050', 'SSF Payable (5.5 + 13) 1st & 2nd Tier', 'Liability', 'Current Liability - Payroll'),
    ('2060', 'Salary Net Payable', 'Liability', 'Current Liability - Payroll'),
    ('2070', 'Unpaid taxes', 'Liability', 'Current Liability - Taxes'),
    ('2080', 'Deferred tax liabilities - ST', 'Liability', 'Current Liability - Taxes'),
    ('2090', 'Utilities Accrued', 'Liability', 'Current Liability - Accruals'),
    ('2500', 'Long-term loans', 'Liability', 'Long-term Liability')
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name, 
    type = EXCLUDED.type, 
    subtype = EXCLUDED.subtype;

-- 7. EQUITY (3000s)
INSERT INTO public.chart_of_accounts (code, name, type, subtype)
VALUES
    ('3000', 'Capital Stated', 'Equity', 'Capital'),
    ('3100', 'Shares Deposit', 'Equity', 'Capital'),
    ('3200', 'Appropriated Retained Earnings (Income Surplus)', 'Equity', 'Retained Earnings'),
    ('3300', 'Unappropriated retained earnings', 'Equity', 'Retained Earnings'),
    ('3400', 'Net income (Current Year)', 'Equity', 'Retained Earnings')
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name, 
    type = EXCLUDED.type, 
    subtype = EXCLUDED.subtype;

-- 8. OTHER EXPENSE & TAX (7000s-8000s)
INSERT INTO public.chart_of_accounts (code, name, type, subtype)
VALUES
    ('7100', 'Interest Expenses', 'Expense', 'Other Expense'),
    ('7200', 'Donations', 'Expense', 'Other Expense'),
    ('8000', 'Income taxes (Current Year)', 'Expense', 'Tax')
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name, 
    type = EXCLUDED.type, 
    subtype = EXCLUDED.subtype;
