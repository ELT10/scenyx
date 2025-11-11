'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.push('/video-gen');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
                      <div className="text-center">
        <div className="loading-bar w-48 mx-auto mb-4"></div>
        <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
          LOADING...
                      </p>
                    </div>
                              </div>
  );
}
