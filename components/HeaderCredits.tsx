'use client';

import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';

export default function HeaderCredits() {
  const [balance, setBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null); // null = unknown, true = authed, false = not authed

  const fetchBalance = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/credits/balance', { credentials: 'include' });
      if (!res.ok) {
        // Delay hiding to allow smooth transition
        setTimeout(() => {
          setBalance(null);
          setIsAuthenticated(false);
          setLoading(false);
        }, 300);
        return;
      }
      const data = await res.json();

      setIsAuthenticated(true);
      if (typeof data.balance === 'string') {
        setBalance(data.balance);
      } else if (typeof data.balance_microcredits === 'number') {
        setBalance((Number(data.balance_microcredits) / 1_000_000).toFixed(2));
      } else {
        setBalance(null);
      }
      setLoading(false);
    } catch {
      // Delay hiding to allow smooth transition
      setTimeout(() => {
        setBalance(null);
        setIsAuthenticated(false);
        setLoading(false);
      }, 300);
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

    // Listen for auth changes (logout, wallet change)
    const handleAuthChange = () => {
      void fetchBalance();
    };

    window.addEventListener('creditsUpdated', handleCreditUpdate);
    window.addEventListener('auth-changed', handleAuthChange);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('creditsUpdated', handleCreditUpdate);
      window.removeEventListener('auth-changed', handleAuthChange);
    };
  }, [fetchBalance]);

  // Don't render anything if confirmed not authenticated and not loading
  if (isAuthenticated === false && !loading) {
    return null;
  }

  // Show minimal loader while checking authentication initially (on first load)
  if (loading && isAuthenticated === null) {
    return (
      <>
        <span className="hidden sm:inline text-[var(--text-muted)]">|</span>
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="hidden sm:inline text-[var(--text-muted)] uppercase tracking-widest text-[9px]">Credits</span>
          <span className="text-[var(--text-muted)] text-xs font-semibold animate-pulse">…</span>
        </div>
      </>
    );
  }

  // Show fading loader when logging out (loading after being authenticated)
  if (loading && isAuthenticated === false) {
    return (
      <>
        <span className="hidden sm:inline text-[var(--text-muted)] opacity-50 transition-opacity duration-300">|</span>
        <div className="flex items-center gap-2 sm:gap-3 opacity-50 transition-opacity duration-300">
          <span className="hidden sm:inline text-[var(--text-muted)] uppercase tracking-widest text-[9px]">Credits</span>
          <span className="text-[var(--text-muted)] text-xs font-semibold animate-pulse">…</span>
        </div>
      </>
    );
  }

  const display = loading ? '…' : balance ? `${Number(balance).toFixed(2)} cr` : '—';

  return (
    <>
      <div className="flex items-center gap-1.5 sm:gap-3 bg-black/60 border border-[var(--border-dim)] px-2 sm:px-3 py-2 rounded">
        <span className="hidden sm:inline text-[var(--text-muted)] uppercase tracking-widest text-[9px]">Credits</span>
        <span className="text-[var(--accent-cyan)] text-xs font-semibold min-w-[52px] text-right tracking-wide">{display}</span>
        <Link
          href="/credits"
          className="border border-[var(--border-dim)] px-2 py-1 text-[8px] sm:text-[9px] uppercase tracking-widest text-[var(--text-muted)] hover:border-[var(--accent-cyan)] hover:text-[var(--accent-cyan)] transition"
        >
          Manage
        </Link>
      </div>
    </>
  );
}


