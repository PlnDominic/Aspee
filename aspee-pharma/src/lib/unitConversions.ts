/**
 * Unit Conversion Utility for Aspee Pharmaceuticals
 * 
 * Provides centralized conversion factors and functions to ensure
 * consistency across Purchasing, Stores, Production, and QA departments.
 */

// --- Conversion Factor Tables ---
// Each group uses a common base unit internally for conversion math.

/** Weight conversions — base: Grams */
const WEIGHT_FACTORS: Record<string, number> = {
    'Milligrams': 0.001,
    'Grams': 1,
    'Kilograms': 1000,
    'Ounces': 28.3495,
    'Pounds': 453.592,
};

/** Volume conversions — base: Millilitres */
const VOLUME_FACTORS: Record<string, number> = {
    'Millilitres': 1,
    'Litres': 1000,
    'Cubic Centimeters': 1, // 1 cc = 1 mL
    'Fluid Ounces': 29.5735,
    'Gallons': 3785.41,
};

/** Length conversions — base: Millimeters */
const LENGTH_FACTORS: Record<string, number> = {
    'Millimeters': 1,
    'Centimeters': 10,
    'Meters': 1000,
};

/** Area conversions — base: Square Centimeters */
const AREA_FACTORS: Record<string, number> = {
    'Square Centimeters': 1,
    'Square Meters': 10000,
};

/** Count units — no conversion between these */
const COUNT_UNITS = [
    'Pieces', 'Tablets', 'Capsules', 'Vials',
    'Ampoules', 'Bottles', 'Boxes', 'Packs', 'Strips', 'Rolls', 'Drums', 'Cartons', 'Sachets', 'Tubes', 'Skellets'
];

// --- Group Definitions ---

export type UnitGroup = 'Weight' | 'Volume' | 'Length' | 'Area' | 'Count';

export const UNIT_GROUPS: Record<UnitGroup, string[]> = {
    Weight: Object.keys(WEIGHT_FACTORS),
    Volume: Object.keys(VOLUME_FACTORS),
    Length: Object.keys(LENGTH_FACTORS),
    Area: Object.keys(AREA_FACTORS),
    Count: COUNT_UNITS,
};

/** All factor tables for lookup */
const ALL_FACTOR_TABLES: Record<string, Record<string, number>> = {
    Weight: WEIGHT_FACTORS,
    Volume: VOLUME_FACTORS,
    Length: LENGTH_FACTORS,
    Area: AREA_FACTORS,
};

// --- Core Functions ---

/**
 * Find which group a unit belongs to
 */
export function getUnitGroup(unit: string): UnitGroup | null {
    for (const [group, units] of Object.entries(UNIT_GROUPS)) {
        if (units.includes(unit)) return group as UnitGroup;
    }
    return null;
}

/**
 * Get all units that can be converted to/from the given unit
 */
export function getCompatibleUnits(unit: string): string[] {
    const group = getUnitGroup(unit);
    if (!group) return [unit];
    return UNIT_GROUPS[group];
}

/**
 * Check if two units are convertible
 */
export function areUnitsConvertible(fromUnit: string, toUnit: string): boolean {
    if (fromUnit === toUnit) return true;
    const fromGroup = getUnitGroup(fromUnit);
    const toGroup = getUnitGroup(toUnit);
    if (!fromGroup || !toGroup) return false;
    // Count units are not interconvertible (1 Tablet ≠ 1 Box)
    if (fromGroup === 'Count' || toGroup === 'Count') return fromUnit === toUnit;
    return fromGroup === toGroup;
}

/**
 * Convert a value from one unit to another.
 * Returns null if conversion is not possible.
 */
export function convertUnit(value: number, fromUnit: string, toUnit: string): number | null {
    if (fromUnit === toUnit) return value;
    
    const fromGroup = getUnitGroup(fromUnit);
    const toGroup = getUnitGroup(toUnit);

    if (!fromGroup || !toGroup || fromGroup !== toGroup) return null;
    if (fromGroup === 'Count') return null; // Can't convert between count units

    const factors = ALL_FACTOR_TABLES[fromGroup];
    if (!factors) return null;

    const fromFactor = factors[fromUnit];
    const toFactor = factors[toUnit];
    if (fromFactor === undefined || toFactor === undefined) return null;

    // Convert: value * fromFactor gives base units, then divide by toFactor
    return (value * fromFactor) / toFactor;
}

/**
 * Format a converted value with smart precision
 */
export function formatConvertedValue(value: number): string {
    if (value >= 1000) return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
    if (value >= 1) return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
    if (value >= 0.001) return value.toLocaleString(undefined, { maximumFractionDigits: 6 });
    return value.toExponential(2);
}

/**
 * Generate a human-readable conversion string
 * e.g. "5 Kilograms = 5,000 Grams"
 */
export function getConversionText(value: number, fromUnit: string, toUnit: string): string | null {
    const converted = convertUnit(value, fromUnit, toUnit);
    if (converted === null) return null;
    return `${formatConvertedValue(value)} ${fromUnit} = ${formatConvertedValue(converted)} ${toUnit}`;
}

/**
 * Get the base unit abbreviation for display
 */
export const UNIT_ABBREVIATIONS: Record<string, string> = {
    'Milligrams': 'mg',
    'Grams': 'g',
    'Kilograms': 'kg',
    'Ounces': 'oz',
    'Pounds': 'lb',
    'Millilitres': 'mL',
    'Litres': 'L',
    'Cubic Centimeters': 'cc',
    'Fluid Ounces': 'fl oz',
    'Gallons': 'gal',
    'Millimeters': 'mm',
    'Centimeters': 'cm',
    'Meters': 'm',
    'Square Centimeters': 'cm²',
    'Square Meters': 'm²',
    'Pieces': 'pcs',
    'Tablets': 'tab',
    'Capsules': 'cap',
    'Vials': 'vial',
    'Ampoules': 'amp',
    'Bottles': 'btl',
    'Boxes': 'box',
    'Packs': 'pk',
    'Strips': 'strip',
    'Rolls': 'roll',
    'Drums': 'drum',
    'Cartons': 'ctn',
    'Sachets': 'sach',
    'Tubes': 'tube',
    'Skellets': 'sklt',
};

export function getAbbreviation(unit: string): string {
    return UNIT_ABBREVIATIONS[unit] || unit;
}

// --- Pack / Bulk Conversion Helpers ---

/** Convert base units to bulk units. Returns null if ratio is invalid. */
export function toBulkQty(baseQty: number, ratio: number): number | null {
    if (!ratio || ratio <= 0) return null;
    return baseQty / ratio;
}

/** Convert bulk units to base units. Returns null if ratio is invalid. */
export function toBaseQty(bulkQty: number, ratio: number): number | null {
    if (!ratio || ratio <= 0) return null;
    return bulkQty * ratio;
}

/**
 * Format a base quantity with its bulk equivalent.
 * e.g. formatWithBulk(60, 'Bottles', 'Cartons', 30) → "60 Btl (2 Ctn)"
 */
export function formatWithBulk(
    baseQty: number,
    baseUnit: string,
    bulkUnit: string | null | undefined,
    ratio: number | null | undefined,
): string {
    const baseAbbr = getAbbreviation(baseUnit);
    const base = `${baseQty.toLocaleString()} ${baseAbbr}`;
    if (!bulkUnit || !ratio || ratio <= 0) return base;
    const bulkQty = baseQty / ratio;
    const bulkAbbr = getAbbreviation(bulkUnit);
    const bulkFormatted = Number.isInteger(bulkQty)
        ? bulkQty.toLocaleString()
        : bulkQty.toLocaleString(undefined, { maximumFractionDigits: 2 });
    return `${base} (${bulkFormatted} ${bulkAbbr})`;
}

/**
 * Format a base quantity as mixed whole-bulk + remainder-base units.
 * e.g. formatMixedBulk(30, 'Skellets', 'Cartons', 24) → "1 Cartons 6 Skellets"
 *      formatMixedBulk(48, 'Skellets', 'Cartons', 24) → "2 Cartons"
 * Returns null when the whole-bulk portion is 0 (nothing useful to show).
 */
export function formatMixedBulk(
    baseQty: number,
    baseUnit: string,
    bulkUnit: string | null | undefined,
    ratio: number | null | undefined,
): string | null {
    if (!bulkUnit || !ratio || ratio <= 0 || baseQty <= 0) return null;
    const whole = Math.floor(baseQty / ratio);
    if (whole === 0) return null;
    const remainder = Math.round((baseQty - whole * ratio) * 1000) / 1000;
    return remainder > 0
        ? `${whole} ${bulkUnit} ${remainder} ${baseUnit}`
        : `${whole} ${bulkUnit}`;
}

/**
 * Returns a short label like "1 Carton = 30 Bottles" for product display.
 */
export function bulkConversionLabel(
    baseUnit: string,
    bulkUnit: string | null | undefined,
    ratio: number | null | undefined,
): string | null {
    if (!bulkUnit || !ratio || ratio <= 0) return null;
    return `1 ${bulkUnit} = ${ratio % 1 === 0 ? ratio : ratio.toFixed(2)} ${baseUnit}`;
}
