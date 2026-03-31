'use client';

import React from 'react';
import Link from 'next/link';

interface EntityLinkProps {
    href: string;
    children: React.ReactNode;
    style?: React.CSSProperties;
    title?: string;
    /** If true, uses monospace font (for reference numbers) */
    mono?: boolean;
    /** If true, renders as subtle/secondary link (for foreign key refs) */
    subtle?: boolean;
}

/**
 * Clickable cross-module link for entity references in DataTable columns.
 * Navigates to the related module page with a search query pre-filled.
 */
export default function EntityLink({ href, children, style, title, mono, subtle }: EntityLinkProps) {
    return (
        <Link
            href={href}
            onClick={(e) => e.stopPropagation()}
            title={title || `Go to ${children}`}
            style={{
                color: subtle ? 'var(--slate-500)' : 'var(--primary-600)',
                fontWeight: subtle ? 400 : 600,
                fontFamily: mono ? 'var(--font-mono)' : undefined,
                fontSize: subtle ? 11 : undefined,
                textDecoration: 'none',
                borderBottom: '1px dashed transparent',
                transition: 'border-color 0.15s, color 0.15s',
                cursor: 'pointer',
                ...style,
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.borderBottomColor = subtle ? 'var(--slate-400)' : 'var(--primary-400)';
                if (!subtle) e.currentTarget.style.color = 'var(--primary-700)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.borderBottomColor = 'transparent';
                if (!subtle) e.currentTarget.style.color = 'var(--primary-600)';
            }}
        >
            {children}
        </Link>
    );
}
