import React from 'react';

interface StatusBadgeProps {
    status: string;
    variant?: 'success' | 'warning' | 'danger' | 'info' | 'default';
}

const variantStyles: Record<string, { bg: string; color: string; border: string }> = {
    success: { bg: 'var(--success-light)', color: '#047857', border: '#a7f3d0' },
    warning: { bg: 'var(--warning-light)', color: '#92400e', border: '#fde68a' },
    danger: { bg: 'var(--danger-light)', color: '#b91c1c', border: '#fecaca' },
    info: { bg: 'var(--info-light)', color: '#0e7490', border: '#a5f3fc' },
    default: { bg: 'var(--slate-100)', color: 'var(--slate-600)', border: 'var(--slate-200)' },
};

export default function StatusBadge({ status, variant = 'default' }: StatusBadgeProps) {
    const style = variantStyles[variant] || variantStyles.default;

    return (
        <span
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '3px 10px',
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 600,
                background: style.bg,
                color: style.color,
                border: `1px solid ${style.border}`,
                whiteSpace: 'nowrap',
            }}
        >
            <span
                style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: style.color,
                }}
            />
            {status}
        </span>
    );
}
