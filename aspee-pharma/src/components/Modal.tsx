'use client';

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    subtitle?: string;
    children: React.ReactNode;
    width?: number;
    noPadding?: boolean;
    size?: 'sm' | 'md' | 'lg';
    fullCanvas?: boolean;
}

const SIZE_MAP = { sm: 420, md: 560, lg: 720 };

export default function Modal({ isOpen, onClose, title, subtitle, children, width, noPadding = false, size, fullCanvas = true }: ModalProps) {
    const resolvedWidth = width ?? (size ? SIZE_MAP[size] : 500);
    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            window.addEventListener('keydown', handleEsc);
        }
        return () => {
            document.body.style.overflow = 'unset';
            window.removeEventListener('keydown', handleEsc);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const modalContent = (
        <div className="modal-overlay">
            {/* Backdrop - covers entire viewport including sidebar */}
            <div className="modal-backdrop animate-modal-backdrop" onClick={onClose} />

            {/* Positioning wrapper - offsets for sidebar so modal centers over content area */}
            <div className="modal-positioner">
                <div
                    ref={contentRef}
                    className={`modal-content${fullCanvas ? ' modal-content-canvas' : ''}`}
                    style={fullCanvas ? undefined : { maxWidth: resolvedWidth }}
                >
                    {/* Header */}
                    <div className="modal-header">
                        <div>
                            <h3 className="modal-title">{title}</h3>
                            {subtitle && <p className="modal-subtitle">{subtitle}</p>}
                        </div>
                        <button
                            onClick={onClose}
                            className="modal-close-btn"
                            aria-label="Close modal"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Body */}
                    <div className={`${noPadding ? "modal-body-no-padding" : "modal-body"}${fullCanvas ? ' modal-body-canvas' : ''}`}>{children}</div>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
