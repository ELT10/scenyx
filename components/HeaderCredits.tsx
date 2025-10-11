'use client';

import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';

export default function HeaderCredits() {
  const [balance, setBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBalance = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/credits/balance', { credentials: 'include' });
      if (!res.ok) throw new Error('failed');
      const data = await res.json();

      if (typeof data.balance === 'string') {
        setBalance(data.balance);
      } else if (typeof data.balance_microcredits === 'number') {
        setBalance((Number(data.balance_microcredits) / 1_000_000).toFixed(2));
      } else {
        setBalance(null);
      }
    } catch {
      setBalance(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    void fetchBalance();

    // Poll every 10 seconds to catch credit changes
    const pollInterval = setInterval(() => {
      void fetchBalance();
    }, 100000);

    // Listen for custom credit update events
    const handleCreditUpdate = () => {
      void fetchBalance();
    };

    window.addEventListener('creditsUpdated', handleCreditUpdate);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('creditsUpdated', handleCreditUpdate);
    };
  }, [fetchBalance]);

  const display = loading ? '…' : balance ? `${Number(balance).toFixed(2)} cr` : '—';

  return (
    <div className="flex items-center gap-3">
      <span className="text-[var(--text-muted)] uppercase tracking-widest text-[9px]">Credits</span>
      <span className="text-[var(--accent-cyan)] text-xs font-semibold">{display}</span>
      <Link
        href="/credits"
        className="border border-[var(--border-dim)] px-3 py-1 text-[9px] uppercase tracking-widest text-[var(--text-muted)] hover:border-[var(--accent-cyan)] hover:text-[var(--accent-cyan)] transition"
      >
        Manage
      </Link>
    </div>
  );
}


