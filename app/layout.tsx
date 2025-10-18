import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import WalletProvider from '@/components/WalletProvider';

import HeaderCredits from '@/components/HeaderCredits';
import WalletControls from '@/components/WalletControls';

export const metadata: Metadata = {
  title: "SCENYX",
  description: "Next-Generation AI Video Generation Platform - Create Stunning Videos with Artificial Intelligence",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="antialiased bg-black text-[var(--text-primary)] font-mono overflow-x-hidden">
        <WalletProvider>
          {/* System Status Bar */}
          <div className="fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur border-b border-[var(--border-primary)]">
            <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-0 sm:justify-between text-[10px] sm:text-[11px] tracking-wider uppercase">
              <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-start">
                <Link href="/" className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
                  <span className="status-dot active"></span>
                  <span className="text-xs sm:text-sm">SCENYX</span>
                </Link>
                <span className="hidden sm:inline text-[var(--text-muted)]">//</span>
                <span className="text-[var(--accent-cyan)] text-xs sm:text-sm">AI STUDIO</span>
              </div>

              <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-2 sm:gap-4">
                <HeaderCredits />
                <WalletControls />
              </div>
            </div>
          </div>

          {/* Main content with top padding for status bar */}
          <div className="pt-20 sm:pt-16 lg:pt-12">
            {children}
          </div>

          {/* System Footer */}
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-black border-t border-[var(--border-dim)] px-3 sm:px-4 py-2 flex flex-col sm:flex-row items-center gap-1 sm:gap-4 justify-between text-[9px] tracking-wider uppercase opacity-80">
            <span className="text-[var(--text-muted)] text-center">
              SCENYX AI VIDEO GENERATION PLATFORM v1.0.0
            </span>
          </div>
        </WalletProvider>
      </body>
    </html>
  );
}
