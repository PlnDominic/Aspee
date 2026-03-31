import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { QueryProvider } from "@/components/QueryProvider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Aspee Pharmaceuticals — Stock & Inventory Management",
  description: "Comprehensive stock and inventory management system for Aspee Pharmaceuticals. Manage purchasing, stores, production, sales, and accounting.",
  keywords: "pharmaceutical, inventory, stock management, ERP",
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
  openGraph: {
    title: "Aspee Pharmaceuticals",
    description: "Comprehensive stock and inventory management system",
    images: [
      {
        url: '/logo.png',
        width: 800,
        height: 600,
        alt: 'Aspee Pharmaceuticals Logo',
      },
    ],
  },
};

import { Toaster } from 'sonner';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${geistMono.variable}`}>
        <ThemeProvider>
          <QueryProvider>
            {children}
            <Toaster position="top-right" richColors />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
