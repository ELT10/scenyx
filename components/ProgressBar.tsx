'use client';

import { motion } from 'framer-motion';

interface ProgressBarProps {
  progress: number;
  label?: string;
  showPercentage?: boolean;
}

export default function ProgressBar({ 
  progress, 
  label,
  showPercentage = true 
}: ProgressBarProps) {
  return (
    <div className="w-full">
      {label && (
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs uppercase tracking-wider text-[var(--text-primary)]">
            {label}
          </span>
          {showPercentage && (
            <span className="text-xs font-mono text-[var(--text-primary)] glow-text">
              {progress}%
            </span>
          )}
        </div>
      )}
      <div className="progress-bar">
        <motion.div
          className="progress-fill"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] font-mono text-black mix-blend-difference">
              {progress > 10 && `${progress}%`}
            </span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

