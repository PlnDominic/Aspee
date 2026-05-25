'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';

interface Column {
    key: string;
    label: string;
    render?: (value: any, row: Record<string, any>) => React.ReactNode;
    width?: string;
    wrap?: boolean;
}

interface DataTableProps {
    columns: Column[];
    data: Record<string, unknown>[];
    searchPlaceholder?: string;
    pageSize?: number;
    loading?: boolean;
    onRowClick?: (row: any) => void;
    emptyMessage?: string;
    actions?: React.ReactNode;
    // Server-side props
    serverSide?: boolean;
    total?: number;
    page?: number;
    onPageChange?: (page: number) => void;
    onSearchChange?: (query: string) => void;
    onSortChange?: (key: string, dir: 'asc' | 'desc') => void;
    currentSearch?: string;
    currentSortKey?: string;
    currentSortDir?: 'asc' | 'desc';
}

function DataTableInner({
    columns,
    data,
    searchPlaceholder = 'Search...',
    pageSize = 10,
    loading = false,
    onRowClick,
    emptyMessage = 'No records found',
    actions,
    serverSide = false,
    total,
    page: externalPage,
    onPageChange,
    onSearchChange,
    onSortChange,
    currentSearch,
    currentSortKey,
    currentSortDir,
}: DataTableProps) {
    const searchParams = useSearchParams();
    const [internalSearch, setInternalSearch] = useState('');
    const [internalPage, setInternalPage] = useState(1);
    const [internalSortKey, setInternalSortKey] = useState<string | null>(null);
    const [internalSortDir, setInternalSortDir] = useState<'asc' | 'desc'>('asc');

    // Use external or internal state
    const search = serverSide ? (currentSearch ?? '') : internalSearch;
    const page = serverSide ? (externalPage ?? 1) : internalPage;
    const sortKey = serverSide ? currentSortKey : internalSortKey;
    const sortDir = serverSide ? (currentSortDir ?? 'asc') : internalSortDir;

    // Pre-fill search from URL ?search= param (for cross-module linking)
    useEffect(() => {
        const q = searchParams.get('search');
        if (q) {
            if (serverSide) onSearchChange?.(q);
            else setInternalSearch(q);
        }
    }, [searchParams, serverSide, onSearchChange]);

    const filtered = serverSide 
        ? data 
        : data.filter((row) =>
            columns.some((col) => {
                const val = row[col.key];
                return val?.toString().toLowerCase().includes(search.toLowerCase());
            })
        );

    const sorted = serverSide 
        ? filtered 
        : sortKey
            ? [...filtered].sort((a, b) => {
                const aVal = a[sortKey] as string;
                const bVal = b[sortKey] as string;
                const cmp = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
                return sortDir === 'asc' ? cmp : -cmp;
            })
            : filtered;

    const totalPages = serverSide ? Math.ceil((total ?? 0) / pageSize) : Math.ceil(sorted.length / pageSize);
    const paged = serverSide ? sorted : sorted.slice((page - 1) * pageSize, page * pageSize);

    const handleSearch = (value: string) => {
        if (serverSide) {
            onSearchChange?.(value);
            return;
        }

        setInternalSearch(value);
        setInternalPage(1);
    };

    const handlePageChange = (nextPage: number) => {
        if (serverSide) {
            onPageChange?.(nextPage);
            return;
        }

        setInternalPage(nextPage);
    };

    const handleSort = (key: string) => {
        const newDir = sortKey === key && sortDir === 'asc' ? 'desc' : 'asc';
        if (serverSide) {
            onSortChange?.(key, newDir);
        } else {
            if (internalSortKey === key) {
                setInternalSortDir(newDir);
            } else {
                setInternalSortKey(key);
                setInternalSortDir('asc');
            }
        }
    };

    return (
        <div
            style={{
                background: 'var(--card-bg)',
                borderRadius: 12,
                border: '1px solid var(--slate-200)',
                overflow: 'hidden',
            }}
        >
            {/* Search bar */}
            <div
                style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid var(--slate-100)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        flex: 1,
                        maxWidth: 320,
                        padding: '8px 12px',
                        background: 'var(--slate-50)',
                        borderRadius: 8,
                        border: '1px solid var(--slate-200)',
                    }}
                >
                    <Search size={16} color="var(--slate-400)" />
                    <input
                        type="text"
                        placeholder={searchPlaceholder}
                        value={search}
                        onChange={(e) => handleSearch(e.target.value)}
                        style={{
                            flex: 1,
                            border: 'none',
                            outline: 'none',
                            background: 'transparent',
                            fontSize: 11,
                            color: 'var(--slate-800)',
                        }}
                    />
                </div>
                <span style={{ fontSize: 11, color: 'var(--slate-400)' }}>
                    {serverSide ? (total ?? 0) : filtered.length} records
                </span>
                {actions && <div style={{ marginLeft: 'auto' }}>{actions}</div>}
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--slate-100)' }}>
                            {columns.map((col) => (
                                <th
                                    key={col.key}
                                    onClick={() => handleSort(col.key)}
                                    style={{
                                        textAlign: 'left',
                                        padding: '12px 20px',
                                        fontWeight: 600,
                                        color: 'var(--slate-500)',
                                        fontSize: 11,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                        cursor: 'pointer',
                                        userSelect: 'none',
                                        whiteSpace: 'nowrap',
                                        width: col.width,
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        {col.label}
                                        {sortKey === col.key && (
                                            <ChevronDown
                                                size={14}
                                                style={{
                                                    transform: sortDir === 'desc' ? 'rotate(180deg)' : 'none',
                                                    transition: 'transform 0.15s',
                                                }}
                                            />
                                        )}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td
                                    colSpan={columns.length}
                                    style={{
                                        padding: '40px 20px',
                                        textAlign: 'center',
                                        color: 'var(--slate-400)',
                                    }}
                                >
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                        <div className="table-loader animate-spin" />
                                        <span>Loading records...</span>
                                    </div>
                                </td>
                            </tr>
                        ) : paged.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={columns.length}
                                    style={{
                                        padding: '40px 20px',
                                        textAlign: 'center',
                                        color: 'var(--slate-400)',
                                    }}
                                >
                                    {emptyMessage}
                                </td>
                            </tr>
                        ) : (
                            paged.map((row, i) => (
                                <tr
                                    key={i}
                                    onClick={() => onRowClick && onRowClick(row)}
                                    style={{
                                        borderBottom: '1px solid var(--slate-50)',
                                        transition: 'background 0.1s',
                                        cursor: onRowClick ? 'pointer' : 'default',
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = 'var(--slate-50)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'transparent';
                                    }}
                                >
                                    {columns.map((col) => (
                                        <td
                                            key={col.key}
                                            style={{
                                                padding: '14px 20px',
                                                color: 'var(--slate-700)',
                                                whiteSpace: col.wrap ? 'normal' : 'nowrap',
                                                minWidth: col.width,
                                                maxWidth: col.wrap ? (col.width || '300px') : 'none',
                                            }}
                                        >
                                            {col.render ? col.render(row[col.key], row) : (row[col.key] as React.ReactNode)}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 20px',
                        borderTop: '1px solid var(--slate-100)',
                    }}
                >
                    <span style={{ fontSize: 11, color: 'var(--slate-500)' }}>
                        Page {page} of {totalPages}
                    </span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                            disabled={page <= 1}
                            onClick={() => handlePageChange(page - 1)}
                            style={{
                                padding: '6px 10px',
                                borderRadius: 6,
                                border: '1px solid var(--slate-200)',
                                background: 'var(--card-bg)',
                                cursor: page <= 1 ? 'not-allowed' : 'pointer',
                                opacity: page <= 1 ? 0.5 : 1,
                                display: 'flex',
                                alignItems: 'center',
                            }}
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <button
                            disabled={page >= totalPages}
                            onClick={() => handlePageChange(page + 1)}
                            style={{
                                padding: '6px 10px',
                                borderRadius: 6,
                                border: '1px solid var(--slate-200)',
                                background: 'var(--card-bg)',
                                cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                                opacity: page >= totalPages ? 0.5 : 1,
                                display: 'flex',
                                alignItems: 'center',
                            }}
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function DataTable(props: DataTableProps) {
    return (
        <Suspense fallback={<div style={{ padding: 24, textAlign: 'center', color: 'var(--slate-400)', fontSize: 11 }}>Loading...</div>}>
            <DataTableInner {...props} />
        </Suspense>
    );
}
