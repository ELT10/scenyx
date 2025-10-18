'use client';

import { motion } from 'framer-motion';

interface StatusBadgeProps {
  status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'fetching';
  showDot?: boolean;
}

export default function StatusBadge({ status, showDot = true }: StatusBadgeProps) {
  const config = {
    queued: {
      color: 'text-[var(--accent-amber)]',
      border: 'border-[var(--accent-amber)]',
      bg: 'bg-[var(--accent-amber)]',
      text: 'QUEUED'
    },
    in_progress: {
      color: 'text-[var(--accent-cyan)]',
      border: 'border-[var(--accent-cyan)]',
      bg: 'bg-[var(--accent-cyan)]',
      text: 'IN PROGRESS'
    },
    completed: {
      color: 'text-[var(--text-primary)]',
      border: 'border-[var(--text-primary)]',
      bg: 'bg-[var(--text-primary)]',
      text: 'COMPLETED'
    },
    failed: {
      color: 'text-[var(--accent-red)]',
      border: 'border-[var(--accent-red)]',
      bg: 'bg-[var(--accent-red)]',
      text: 'FAILED'
    },
    fetching: {
      color: 'text-[var(--accent-cyan)]',
      border: 'border-[var(--accent-cyan)]',
      bg: 'bg-[var(--accent-cyan)]',
      text: 'FETCHING'
    }
  };

  const { color, border, bg, text } = config[status];

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 border ${border} ${color} text-[10px] sm:text-xs uppercase tracking-wider font-mono bg-[#292929]`}
    >
      {showDot && (
        <span className={`w-2 h-2 ${bg} rounded-full animate-pulse`}></span>
      )}
      <span>{text}</span>
    </motion.div>
  );
}

