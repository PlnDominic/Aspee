import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: React.ReactNode;
    trend?: { value: number; label: string };
    color?: 'blue' | 'teal' | 'amber' | 'red' | 'green' | 'purple';
}

const colorMap = {
    blue:   { line: 'var(--primary-500)',  text: 'var(--primary-600)'  },
    teal:   { line: 'var(--accent-500)',   text: 'var(--accent-600)'   },
    amber:  { line: 'var(--warning)',      text: '#92400e'             },
    red:    { line: 'var(--danger)',       text: '#b91c1c'             },
    green:  { line: 'var(--success)',      text: '#065f46'             },
    purple: { line: '#8b5cf6',             text: '#6d28d9'             },
};

export default function StatCard({ title, value, subtitle, icon, trend, color = 'blue' }: StatCardProps) {
    const { line, text } = colorMap[color];
    const isLong = typeof value === 'string' && value.length > 10;

    return (
        <div
            style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--slate-200)',
                borderRadius: 8,
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                transition: 'border-color 0.15s, box-shadow 0.15s',
                cursor: 'default',
            }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)'; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
        >
            {/* Icon */}
            <div style={{ color: text, flexShrink: 0, opacity: 0.85 }}>
                {icon}
            </div>

            {/* Divider */}
            <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--slate-100)', flexShrink: 0 }} />

            {/* Text */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--slate-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>
                    {title}
                </p>
                <p style={{ fontSize: isLong ? 14 : 18, fontWeight: 700, color: 'var(--slate-900)', lineHeight: 1, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {value}
                </p>
                {(subtitle || trend) && (
                    <p style={{ fontSize: 10, color: 'var(--slate-400)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 3 }}>
                        {trend && (
                            <span style={{ color: trend.value >= 0 ? 'var(--success)' : 'var(--danger)', display: 'inline-flex', alignItems: 'center', gap: 2, fontWeight: 600 }}>
                                {trend.value >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                                {Math.abs(trend.value)}%
                            </span>
                        )}
                        {trend?.label || subtitle}
                    </p>
                )}
            </div>
        </div>
    );
}
