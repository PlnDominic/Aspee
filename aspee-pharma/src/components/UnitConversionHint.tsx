'use client';

import React from 'react';
import { ArrowRight, RefreshCw } from 'lucide-react';
import { convertUnit, formatConvertedValue, getAbbreviation, areUnitsConvertible } from '@/lib/unitConversions';

interface UnitConversionHintProps {
    value: number;
    fromUnit: string;
    toUnit: string;       // product base unit
    showIcon?: boolean;
    compact?: boolean;
}

/**
 * Inline component to display unit conversion hints.
 * Shows: "5 kg → 5,000 g (base)" wherever cross-unit operations occur.
 */
export default function UnitConversionHint({ value, fromUnit, toUnit, showIcon = true, compact = false }: UnitConversionHintProps) {
    if (!fromUnit || !toUnit || fromUnit === toUnit) return null;
    if (!areUnitsConvertible(fromUnit, toUnit)) {
        return (
            <span className="uom-hint uom-hint--warning">
                {showIcon && <RefreshCw size={11} />}
                <span>⚠ {fromUnit} → {toUnit} not convertible</span>
                <style>{hintStyles}</style>
            </span>
        );
    }

    const converted = convertUnit(value, fromUnit, toUnit);
    if (converted === null) return null;

    const fromAbbr = getAbbreviation(fromUnit);
    const toAbbr = getAbbreviation(toUnit);

    if (compact) {
        return (
            <span className="uom-hint uom-hint--compact">
                {showIcon && <ArrowRight size={10} />}
                <span>{formatConvertedValue(converted)} {toAbbr}</span>
                <style>{hintStyles}</style>
            </span>
        );
    }

    return (
        <span className="uom-hint">
            {showIcon && <ArrowRight size={11} />}
            <span>{formatConvertedValue(value)} {fromAbbr} = <strong>{formatConvertedValue(converted)} {toAbbr}</strong> <em>(base)</em></span>
            <style>{hintStyles}</style>
        </span>
    );
}

const hintStyles = `
    .uom-hint {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 3px 8px;
        border-radius: 6px;
        background: #ecfdf5;
        border: 1px solid #a7f3d0;
        color: #065f46;
        font-size: 11px;
        font-weight: 500;
        white-space: nowrap;
    }
    .uom-hint strong {
        font-weight: 700;
    }
    .uom-hint em {
        font-style: italic;
        opacity: 0.7;
        font-size: 10px;
    }
    .uom-hint--compact {
        padding: 2px 6px;
        font-size: 10px;
        background: #f0fdf4;
        border-color: #bbf7d0;
    }
    .uom-hint--warning {
        background: #fffbeb;
        border-color: #fde68a;
        color: #92400e;
    }
`;
