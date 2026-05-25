'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search } from 'lucide-react';

interface ProductOption {
    id: string;
    name: string;
    sku: string;
}

interface ProductSearchDropdownProps {
    products: ProductOption[];
    value: string;
    onChange: (id: string) => void;
    disabled?: boolean;
    placeholder?: string;
    style?: React.CSSProperties;
    className?: string;
}

export default function ProductSearchDropdown({
    products,
    value,
    onChange,
    disabled = false,
    placeholder = '— Select product —',
    style,
    className,
}: ProductSearchDropdownProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [panelPos, setPanelPos] = useState<React.CSSProperties>({});
    const triggerRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            const t = e.target as Node;
            if (!triggerRef.current?.contains(t) && !panelRef.current?.contains(t)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const selected = products.find(p => p.id === value);
    const filtered = products.filter(p =>
        `${p.name} ${p.sku}`.toLowerCase().includes(search.toLowerCase())
    );

    const handleToggle = () => {
        if (disabled) return;
        if (!open && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setPanelPos({
                position: 'fixed',
                top: rect.bottom + 4,
                left: rect.left,
                width: Math.max(rect.width, 240),
                zIndex: 99999,
            });
        }
        setOpen(v => !v);
        setSearch('');
    };

    const triggerStyle: React.CSSProperties = {
        width: '100%',
        textAlign: 'left',
        cursor: disabled ? 'default' : 'pointer',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 10px',
        border: '1px solid var(--slate-200)',
        borderRadius: 8,
        background: disabled ? 'var(--slate-50)' : 'white',
        fontSize: 11,
        outline: 'none',
        color: selected ? 'var(--slate-800)' : 'var(--slate-400)',
        boxSizing: 'border-box',
        ...style,
    };

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                onClick={handleToggle}
                style={triggerStyle}
                className={className}
            >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                    {selected ? `${selected.name} (${selected.sku})` : placeholder}
                </span>
                {!disabled && (
                    <ChevronDown
                        size={12}
                        style={{
                            color: 'var(--slate-400)',
                            flexShrink: 0,
                            marginLeft: 4,
                            transform: open ? 'rotate(180deg)' : 'none',
                            transition: 'transform 0.15s',
                        }}
                    />
                )}
            </button>

            {open && typeof document !== 'undefined' && createPortal(
                <div
                    ref={panelRef}
                    style={{
                        ...panelPos,
                        background: 'white',
                        border: '1px solid var(--slate-200)',
                        borderRadius: 8,
                        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                        overflow: 'hidden',
                    }}
                >
                    <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--slate-100)', position: 'relative' }}>
                        <Search
                            size={12}
                            style={{
                                position: 'absolute',
                                left: 16,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: 'var(--slate-400)',
                                pointerEvents: 'none',
                            }}
                        />
                        <input
                            autoFocus
                            type="text"
                            placeholder="Search products…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '7px 8px 7px 28px',
                                boxSizing: 'border-box',
                                border: '1px solid var(--slate-200)',
                                borderRadius: 6,
                                fontSize: 11,
                                background: 'var(--slate-50)',
                                outline: 'none',
                                color: 'var(--slate-800)',
                            }}
                        />
                    </div>
                    <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                        {filtered.length === 0 ? (
                            <div style={{ padding: '10px 14px', color: 'var(--slate-400)', fontSize: 11 }}>
                                No products found
                            </div>
                        ) : filtered.map(p => (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => { onChange(p.id); setOpen(false); setSearch(''); }}
                                style={{
                                    display: 'block',
                                    width: '100%',
                                    textAlign: 'left',
                                    padding: '8px 14px',
                                    fontSize: 11,
                                    cursor: 'pointer',
                                    background: p.id === value ? 'var(--primary-50, #eff6ff)' : 'white',
                                    color: p.id === value ? 'var(--primary-700, #1d4ed8)' : 'var(--slate-800)',
                                    border: 'none',
                                    borderBottom: '1px solid var(--slate-50)',
                                    fontWeight: p.id === value ? 600 : 400,
                                }}
                            >
                                {p.name} ({p.sku})
                            </button>
                        ))}
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
