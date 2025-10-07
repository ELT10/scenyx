'use client';

import { ReactNode, ButtonHTMLAttributes } from 'react';
import { motion } from 'framer-motion';

interface GlowButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'danger' | 'warning';
  loading?: boolean;
}

export default function GlowButton({ 
  children, 
  variant = 'primary',
  loading = false,
  className = '',
  disabled,
  ...props 
}: GlowButtonProps) {
  const colors = {
    primary: {
      border: 'border-[var(--border-primary)]',
      text: 'text-[var(--text-secondary)]',
      glow: 'hover:shadow-[0_0_20px_rgba(255,255,255,0.5)]'
    },
    danger: {
      border: 'border-[var(--accent-red)]',
      text: 'text-[var(--accent-red)]',
      glow: 'hover:shadow-[0_0_20px_rgba(255,51,51,0.5)]'
    },
    warning: {
      border: 'border-[var(--accent-amber)]',
      text: 'text-[var(--accent-amber)]',
      glow: 'hover:shadow-[0_0_20px_rgba(255,165,0,0.5)]'
    }
  };

  const colorClasses = colors[variant];

  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      className={`
        btn-primary
        relative
        ${colorClasses.border}
        ${colorClasses.text}
        ${!disabled && colorClasses.glow}
        ${className}
      `}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
          <span>PROCESSING...</span>
        </span>
      ) : (
        children
      )}
    </motion.button>
  );
}

