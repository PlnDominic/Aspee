import React from 'react';
import { ChevronRight } from 'lucide-react';

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    breadcrumbs?: { label: string; href?: string }[];
    actions?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, breadcrumbs, actions }: PageHeaderProps) {
    return (
        <div
            style={{
                marginBottom: 28,
            }}
        >
            {breadcrumbs && breadcrumbs.length > 0 && (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginBottom: 10,
                        fontSize: 11,
                        color: 'var(--slate-400)',
                    }}
                >
                    {breadcrumbs.map((crumb, i) => (
                        <React.Fragment key={i}>
                            {i > 0 && <ChevronRight size={14} />}
                            {crumb.href ? (
                                <a
                                    href={crumb.href}
                                    style={{
                                        color: 'var(--slate-400)',
                                        textDecoration: 'none',
                                        transition: 'color 0.15s',
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.color = 'var(--primary-500)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.color = 'var(--slate-400)';
                                    }}
                                >
                                    {crumb.label}
                                </a>
                            ) : (
                                <span style={{ color: 'var(--slate-600)', fontWeight: 500 }}>{crumb.label}</span>
                            )}
                        </React.Fragment>
                    ))}
                </div>
            )}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px',
                    flexWrap: 'wrap',
                }}
            >
                <div>
                    <h2 style={{ fontSize: 11, fontWeight: 700, color: 'var(--slate-900)' }}>{title}</h2>
                    {subtitle && (
                        <p style={{ fontSize: 11, color: 'var(--slate-500)', marginTop: 4 }}>{subtitle}</p>
                    )}
                </div>
                {actions && <div style={{ display: 'flex', gap: '10px' }}>{actions}</div>}
            </div>
        </div>
    );
}
