'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import HeaderCredits from '@/components/HeaderCredits';
import WalletControls from '@/components/WalletControls';

export default function HeaderRight() {
  const { publicKey } = useWallet();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = () => window.matchMedia('(max-width: 639px)').matches; // Tailwind sm breakpoint
    const update = () => setIsMobile(mq());
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  const alignmentClass = isMobile
    ? (!publicKey ? 'justify-center' : 'justify-between')
    : 'justify-end';

  return (
    <div className={`flex items-center ${alignmentClass} w-full sm:w-auto gap-2 sm:gap-4`}>
      <HeaderCredits />
      <WalletControls />
    </div>
  );
}


