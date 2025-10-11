'use client';

import { useEffect, useRef, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import bs58 from 'bs58';

export default function WalletControls() {
  const { publicKey, signMessage } = useWallet();
  const [status, setStatus] = useState<string | null>(null);
  const verifyingRef = useRef(false);

  const ensureSession = async () => {
    if (!publicKey || !signMessage || verifyingRef.current) return;
    try {
      verifyingRef.current = true;
      // Check if we already have a valid session
      const check = await fetch('/api/credits/balance');
      if (check.ok) {
        setStatus(null);
        return;
      }

      setStatus('Verifying wallet...');
      const resNonce = await fetch('/api/auth/nonce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: publicKey.toBase58() }),
      });
      const { nonce } = await resNonce.json();
      const msg = new TextEncoder().encode(`scenyx login: ${nonce}`);
      const signature = await signMessage(msg);
      const sigB58 = bs58.encode(signature);
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: publicKey.toBase58(), signature: sigB58, nonce }),
      });
      if (!res.ok) throw new Error('Wallet verification failed');
      setStatus(null);
    } catch (e: any) {
      setStatus(e.message || 'Verification failed');
    } finally {
      verifyingRef.current = false;
    }
  };

  useEffect(() => {
    if (publicKey) {
      void ensureSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicKey, signMessage]);

  return (
    <div className="flex items-center gap-3">
      <WalletMultiButton className="!bg-black !border !border-[var(--border-dim)] !text-[var(--text-primary)] !font-mono !uppercase !tracking-widest" />
      {status && <span className="text-[var(--text-muted)] text-xs">{status}</span>}
    </div>
  );
}


