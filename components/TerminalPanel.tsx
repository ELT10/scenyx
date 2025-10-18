'use client';

import { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface TerminalPanelProps {
  children: ReactNode;
  className?: string;
  title?: string;
  status?: 'active' | 'warning' | 'error' | null;
  corners?: boolean;
}

export default function TerminalPanel({ 
  children, 
  className = '', 
  title,
  status = null,
  corners = true 
}: TerminalPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`terminal-panel relative ${className}`}
    >
      {corners && (
        <>
          <div className="absolute -top-[2px] -left-[2px] w-4 h-4 border-l-2 border-t-2 border-[var(--border-primary)]"></div>
          <div className="absolute -top-[2px] -right-[2px] w-4 h-4 border-r-2 border-t-2 border-[var(--border-primary)]"></div>
          <div className="absolute -bottom-[2px] -left-[2px] w-4 h-4 border-l-2 border-b-2 border-[var(--border-primary)]"></div>
          <div className="absolute -bottom-[2px] -right-[2px] w-4 h-4 border-r-2 border-b-2 border-[var(--border-primary)]"></div>
        </>
      )}
      
      {title && (
        <div className="border-b border-[var(--border-dim)] px-3 sm:px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-black bg-opacity-60">
          <div className="flex items-center gap-2">
            {status && <span className={`status-dot ${status}`}></span>}
            <span className="text-xs uppercase tracking-widest text-[var(--text-primary)] font-orbitron">
              {title}
            </span>
          </div>
          <div className="flex gap-1 self-end sm:self-auto">
            <div className="w-2 h-2 bg-[var(--accent-red)] opacity-70"></div>
            <div className="w-2 h-2 bg-[var(--accent-amber)] opacity-70"></div>
            <div className="w-2 h-2 bg-[var(--text-primary)] opacity-70"></div>
          </div>
        </div>
      )}
      
      <div className="p-4 sm:p-6">
        {children}
      </div>
    </motion.div>
  );
}

