'use client';

import { ReactNode } from 'react';

interface DataGridProps {
  children: ReactNode;
  columns?: 1 | 2 | 3 | 4;
  gap?: 'sm' | 'md' | 'lg';
}

export default function DataGrid({ 
  children, 
  columns = 2,
  gap = 'md' 
}: DataGridProps) {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
  };

  const gapSize = {
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6'
  };

  return (
    <div className={`grid ${gridCols[columns]} ${gapSize[gap]}`}>
      {children}
    </div>
  );
}

