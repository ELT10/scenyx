'use client';

import { formatCredits } from '@/lib/client/pricing';

interface CostEstimateProps {
  credits: number;
  operation: string;
  className?: string;
}

export default function CostEstimate({ credits, operation, className = '' }: CostEstimateProps) {
  if (credits === 0) return null;

  return (
    <div className={`border border-[#1c4a5d] bg-[#0b0722] px-3 sm:px-4 py-4 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-2">
          <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-[#b1b1b1]">
            Estimated Cost
          </span>
          <span className="text-[11px] sm:text-xs text-[#b1b1b1]">({operation})</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[13px] sm:text-[15px] font-mono text-[var(--accent-cyan)] font-semibold">
            ~ {formatCredits(credits)}
          </span>
          <span className="text-[10px] sm:text-[12px] uppercase tracking-widest text-[#b1b1b1]">
            credits
          </span>
        </div>
      </div>
    </div>
  );
}

