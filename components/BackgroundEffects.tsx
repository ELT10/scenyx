'use client';

export default function BackgroundEffects() {
  return (
    <>
      {/* Grid background */}
      <div className="grid-background"></div>
      
      {/* Scan line effect */}
      <div className="scan-line"></div>
      
      {/* Noise overlay */}
      <div className="noise-overlay"></div>
      
      {/* Corner accents */}
      <div className="fixed top-0 left-0 w-32 h-32 border-l-2 border-t-2 border-[var(--border-dim)] pointer-events-none z-50 opacity-50"></div>
      <div className="fixed top-0 right-0 w-32 h-32 border-r-2 border-t-2 border-[var(--border-dim)] pointer-events-none z-50 opacity-50"></div>
      <div className="fixed bottom-0 left-0 w-32 h-32 border-l-2 border-b-2 border-[var(--border-dim)] pointer-events-none z-50 opacity-50"></div>
      <div className="fixed bottom-0 right-0 w-32 h-32 border-r-2 border-b-2 border-[var(--border-dim)] pointer-events-none z-50 opacity-50"></div>
    </>
  );
}

