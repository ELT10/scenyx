'use client';

import { useEffect, useRef, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import bs58 from 'bs58';

export default function WalletControls() {
  const { publicKey, signMessage, disconnect } = useWallet();
  const [status, setStatus] = useState<string | null>(null);
  const verifyingRef = useRef(false);
  const previousWalletRef = useRef<string | null>(null);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      previousWalletRef.current = null;
      setStatus(null);
      // Trigger a refresh of balance display
      window.dispatchEvent(new Event('auth-changed'));
    } catch (e) {
      console.error('Logout failed:', e);
    }
  };

  const ensureSession = async () => {
    if (!publicKey || !signMessage || verifyingRef.current) return;
    
    const currentWallet = publicKey.toBase58();
    
    try {
      verifyingRef.current = true;
      
      // Check if we have an existing session and if it matches current wallet
      const sessionCheck = await fetch('/api/auth/session');
      if (sessionCheck.ok) {
        const sessionData = await sessionCheck.json();
        
        // If session exists but wallet address doesn't match, logout and require re-verification
        if (sessionData.authenticated && sessionData.walletAddress !== currentWallet) {
          setStatus('Wallet changed. Please reconnect...');
          await handleLogout();
          // Don't auto-verify, require manual reconnection
          return;
        }
        
        // Session exists and matches current wallet
        if (sessionData.authenticated && sessionData.walletAddress === currentWallet) {
          previousWalletRef.current = currentWallet;
          setStatus(null);
          return;
        }
      }

      // No valid session, need to verify
      setStatus('Verifying wallet...');
      const resNonce = await fetch('/api/auth/nonce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: currentWallet }),
      });
      
      if (!resNonce.ok) {
        throw new Error('Failed to get nonce');
      }
      
      const { nonce } = await resNonce.json();
      const msg = new TextEncoder().encode(`scenyx login: ${nonce}`);
      const signature = await signMessage(msg);
      const sigB58 = bs58.encode(signature);
      
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: currentWallet, signature: sigB58, nonce }),
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Wallet verification failed');
      }
      
      // Verification successful
      previousWalletRef.current = currentWallet;
      setStatus(null);
      window.dispatchEvent(new Event('auth-changed'));
      
    } catch (e: any) {
      console.error('Verification error:', e);
      setStatus(e.message || 'Verification failed');
      
      // On verification failure, disconnect the wallet
      try {
        await handleLogout();
        await disconnect();
      } catch (disconnectError) {
        console.error('Failed to disconnect wallet:', disconnectError);
      }
    } finally {
      verifyingRef.current = false;
    }
  };

  // Handle wallet connection changes
  useEffect(() => {
    if (publicKey) {
      void ensureSession();
    } else {
      // Wallet disconnected - clear session
      if (previousWalletRef.current) {
        void handleLogout();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicKey, signMessage]);

  return (
    <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end bg-black/60 py-1 rounded">
       {status && <span className="text-[var(--text-muted)] text-[11px] sm:text-xs uppercase tracking-wider max-w-[180px] text-right sm:text-left leading-tight">{status}</span>}
       <WalletMultiButton />
      </div>
  );
}


