'use client';

import { motion } from 'framer-motion';

interface GlitchTextProps {
  children: string;
  className?: string;
}

export default function GlitchText({ children, className = '' }: GlitchTextProps) {
  return (
    <motion.h1
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`relative font-orbitron ${className}`}
      style={{
        textShadow: '0 0 10px rgba(255, 255, 255, 0.5), 0 0 20px rgba(255, 255, 255, 0.3)'
      }}
    >
      {children}
    </motion.h1>
  );
}

