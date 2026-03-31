'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export default function LandingPage() {
    return (
        <div style={{
            position: 'relative',
            height: '100vh',
            width: '100%',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
        }}>
            {/* Hero background image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src="/hero.png"
                alt="Aspee Pharmaceuticals"
                style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: 'center',
                }}
            />

            {/* Dark gradient overlay */}
            <div style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to bottom, rgba(2,6,23,0.55) 0%, rgba(2,6,23,0.72) 60%, rgba(2,6,23,0.92) 100%)',
            }} />

            {/* Content */}
            <div style={{
                position: 'relative',
                zIndex: 10,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                padding: '0 24px',
                gap: 28,
            }}>
                {/* Logo */}
                <div style={{
                    width: 100,
                    height: 100,
                    borderRadius: 24,
                    overflow: 'hidden',
                    background: 'rgba(255,255,255,0.08)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
                }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/logo.png"
                        alt="Aspee Pharma Logo"
                        width={80}
                        height={80}
                        style={{ objectFit: 'contain' }}
                    />
                </div>

                {/* Company name */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
                    <p style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'rgba(6,182,212,0.9)',
                        letterSpacing: '0.2em',
                        textTransform: 'uppercase',
                    }}>
                        Aspee Pharmaceuticals Limited
                    </p>
                    <h1 style={{
                        fontSize: 'clamp(32px, 5vw, 60px)',
                        fontWeight: 900,
                        color: '#ffffff',
                        lineHeight: 1.1,
                        letterSpacing: '-0.03em',
                        margin: 0,
                    }}>
                        Factory Management{' '}
                        <span style={{
                            background: 'linear-gradient(135deg, #22d3ee, #14b8a6)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                        }}>
                            System
                        </span>
                    </h1>
                </div>

                {/* CTA */}
                <Link
                    href="/login"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '14px 36px',
                        borderRadius: 100,
                        background: 'linear-gradient(135deg, #06b6d4, #0d9488)',
                        color: '#fff',
                        fontSize: 14,
                        fontWeight: 700,
                        textDecoration: 'none',
                        boxShadow: '0 8px 32px rgba(6,182,212,0.4)',
                        transition: 'all 0.25s ease',
                        letterSpacing: '0.01em',
                    }}
                    onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                        (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 40px rgba(6,182,212,0.5)';
                    }}
                    onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                        (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 32px rgba(6,182,212,0.4)';
                    }}
                >
                    Open Dashboard <ArrowRight size={16} />
                </Link>
            </div>

            {/* Footer credit */}
            <div style={{
                position: 'absolute',
                bottom: 28,
                zIndex: 10,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
            }}>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.1em' }}>
                    &copy; 2026 ASPEE PHARMACEUTICALS LIMITED
                </span>
                <a
                    href="https://wa.me/233542855399"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                        color: 'rgba(255,255,255,0.3)',
                        textDecoration: 'none',
                        fontSize: 10,
                        letterSpacing: '0.05em',
                        transition: 'color 0.2s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#22d3ee')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
                >
                    DEVELOPED BY <span style={{ fontWeight: 700 }}>ECSTASY GEOSPATIAL SERVICES</span>
                </a>
            </div>
        </div>
    );
}
