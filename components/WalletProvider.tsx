'use client';

import { FC, ReactNode, useEffect, useMemo, useState } from 'react';
import { ConnectionProvider, WalletProvider as SAProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';
import type { WalletAdapter } from '@solana/wallet-adapter-base';
import '@solana/wallet-adapter-react-ui/styles.css';

const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

export const WalletProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SAProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </SAProvider>
    </ConnectionProvider>
  );
};

export default WalletProvider;


