/**
 * Standard unit of measurement options for pharmaceutical inventory
 * Used across the application for consistency
 */
export const UNIT_OPTIONS = [
  // Weight - Metric
  'Milligrams',
  'Grams',
  'Kilograms',
  // Weight - Imperial
  'Ounces',
  'Pounds',
  // Volume - Metric
  'Millilitres',
  'Litres',
  'Cubic Centimeters',
  // Volume - Imperial
  'Fluid Ounces',
  'Gallons',
  // Count/Quantity
  'Pieces',
  'Tablets',
  'Capsules',
  'Vials',
  'Ampoules',
  'Bottles',
  'Boxes',
  'Packs',
  'Strips',
  'Rolls',
  'Drums',
  'Cartons',
  'Sachets',
  'Tubes',
  'Skellets',
  // Length
  'Millimeters',
  'Centimeters',
  'Meters',
  // Area
  'Square Meters',
  'Square Centimeters'
] as const;

export type UnitOption = typeof UNIT_OPTIONS[number];

/**
 * Grouped unit options for organized dropdown menus
 */
export const GROUPED_UNIT_OPTIONS: { label: string; units: string[] }[] = [
  {
    label: 'Weight',
    units: ['Milligrams', 'Grams', 'Kilograms', 'Ounces', 'Pounds']
  },
  {
    label: 'Volume',
    units: ['Millilitres', 'Litres', 'Cubic Centimeters', 'Fluid Ounces', 'Gallons']
  },
  {
    label: 'Count / Quantity',
    units: ['Pieces', 'Tablets', 'Capsules', 'Vials', 'Ampoules', 'Bottles', 'Boxes', 'Packs', 'Strips', 'Rolls', 'Drums', 'Cartons', 'Sachets', 'Tubes', 'Skellets']
  },
  {
    label: 'Length',
    units: ['Millimeters', 'Centimeters', 'Meters']
  },
  {
    label: 'Area',
    units: ['Square Centimeters', 'Square Meters']
  }
];

/**
 * Standard expense categories for pharmaceutical accounting
 * Grouped by accounting class for organized selection
 */
export const EXPENSE_CATEGORIES = [
  {
    label: 'Payroll & Welfare',
    categories: [
      'ASPEE STAFF WELFARE SCHEME',
      'Staff Salaries (S&A)',
      'Staff Bonus and Allowances',
      'Staff Medical And Welfare Exp',
      'Staff Overtime (S&A)',
      'Feeding/Refreshment Expense',
      'Employee benefits (S&A)',
      'Staff Training and Education (S&A)',
      'Seminars/Workshop/Training Exp'
    ]
  },
  {
    label: 'Operations & S&A',
    categories: [
      'Travel & lodging (S&A)',
      'Telecommunication and Postages (S&A)',
      'Protocol Exp',
      'Vehicle Fuel Expense',
      'Printing and Stationery Exp',
      'Research & Development Exp',
      'Security Expense',
      'Misc. expenses (S&A)'
    ]
  },
  {
    label: 'Professional & ICT',
    categories: [
      'Audit and Accountancy Exp',
      'Professional and Consultancy Fees',
      'ICT Expense',
      'Registration & Licensing Exp',
      'Software Subscription Expense'
    ]
  },
  {
    label: 'Marketing & Sales',
    categories: [
      'Marketing and Distribution Expense',
      'Advertising expenses (S&A)',
      'Sales commission (S&A)'
    ]
  },
  {
    label: 'Maintenance & Occupancy',
    categories: [
      'Rent expenses (S&A)',
      'Repairing expenses (S&A)',
      'Vehicle Repairs & Maintenance Expense',
      'Cleaning and Sanitation Exp',
      'Building Repairs & Maintenance (S&A)',
      'Equipment Repairs & Maintenance'
    ]
  },
  {
    label: 'Financial & Taxes',
    categories: [
      'PAYE - GRA',
      'INTERNET EXPENSES', // Often grouped with utilities/ops but listed here for tax/license context in some charts
      'Insurance expenses (S&A)',
      'Bank Charges',
      'Interest Expenses',
      'Income taxes (Current Year)'
    ]
  },
  {
    label: 'Other',
    categories: [
      'Donations',
      'Other Income'
    ]
  }
];
