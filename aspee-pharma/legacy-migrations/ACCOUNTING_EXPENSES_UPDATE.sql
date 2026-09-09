-- ============================================================
-- ACCOUNTING EXPENSES UPDATE - CHART OF ACCOUNTS
-- Standardizing categories as per professional P&L structure
-- ============================================================

-- 1. Insert/Update Revenue & Cost of Sales
INSERT INTO public.chart_of_accounts (code, name, type, subtype)
VALUES 
    ('4000', 'Sales - Finished goods', 'Revenue', 'Operating Revenue'),
    ('5000', 'Cost of finished goods sold', 'Expense', 'Cost of Sales')
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name, 
    type = EXCLUDED.type, 
    subtype = EXCLUDED.subtype;

-- 2. Insert Selling & Administrative (S&A) Expenses
-- We use 6000-6999 range for S&A
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

-- 3. Insert Non-operating & Other
INSERT INTO public.chart_of_accounts (code, name, type, subtype)
VALUES
    ('7000', 'Other Income', 'Revenue', 'Other Income'),
    ('7100', 'Interest Expenses', 'Expense', 'Other Expense'),
    ('7200', 'Donations', 'Expense', 'Other Expense'),
    ('8000', 'Income taxes', 'Expense', 'Tax')
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name, 
    type = EXCLUDED.type, 
    subtype = EXCLUDED.subtype;
