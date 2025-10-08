import type { Metadata } from "next";
import "./globals.css";
import DeviceDetector from "@/components/DeviceDetector";

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
        {/* System Status Bar */}
        <div className="fixed top-0 left-0 right-0 z-50 bg-black border-b border-[var(--border-primary)] px-4 py-2 flex items-center justify-between text-[10px] tracking-wider uppercase opacity-90">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-2">
              <span className="status-dot active"></span>
              <span>SCENYX</span>
            </span>
            <span className="text-[var(--text-muted)]">|</span>
            <span className="text-[var(--accent-cyan)]">AI STUDIO</span>
            <span className="text-[var(--text-muted)]">|</span>
            <span className="text-[var(--text-muted)]">
              {new Date().toLocaleTimeString('en-US', { hour12: false })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-muted)]">DEVICE:</span>
            <DeviceDetector />
          </div>
        </div>

        {/* Main content with top padding for status bar */}
        <div className="pt-10">
          {children}
        </div>

        {/* System Footer */}
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-black border-t border-[var(--border-dim)] px-4 py-1 flex items-center justify-between text-[9px] tracking-wider uppercase opacity-80">
          <span className="text-[var(--text-muted)]">
            SCENYX AI VIDEO GENERATION PLATFORM v1.0.0
          </span>
          <span className="text-[var(--text-muted)]">
            POWERED BY SORA2
          </span>
        </div>
      </body>
    </html>
  );
}
