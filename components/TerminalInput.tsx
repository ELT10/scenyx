'use client';

import { InputHTMLAttributes } from 'react';

interface TerminalInputProps extends InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> {
  label?: string;
  multiline?: boolean;
  rows?: number;
}

export default function TerminalInput({ 
  label, 
  multiline = false,
  rows = 4,
  className = '',
  ...props 
}: TerminalInputProps) {
  const inputClasses = `
    w-full
    bg-black bg-opacity-60
    border border-[var(--border-dim)]
    text-[var(--text-primary)]
    px-3 sm:px-4 py-3
    text-sm
    font-mono
    focus:border-[var(--border-primary)]
    focus:outline-none
    focus:shadow-[0_0_10px_rgba(255,255,255,0.3),inset_0_0_5px_rgba(255,255,255,0.1)]
    transition-all
    duration-300
    placeholder:text-[var(--text-muted)]
    placeholder:opacity-60
    ${className}
  `;

  return (
    <div className="w-full">
      {label && (
        <label className="block text-xs uppercase tracking-widest text-[var(--text-primary)] mb-2 font-mono">
          {'>'} {label}
        </label>
      )}
      {multiline ? (
        <textarea
          className={`${inputClasses} resize-none`}
          rows={rows}
          {...(props as InputHTMLAttributes<HTMLTextAreaElement>)}
        />
      ) : (
        <input
          type="text"
          className={inputClasses}
          {...(props as InputHTMLAttributes<HTMLInputElement>)}
        />
      )}
    </div>
  );
}

