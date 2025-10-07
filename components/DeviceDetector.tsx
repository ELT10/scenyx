'use client';

import { useEffect, useState } from 'react';

export default function DeviceDetector() {
  const [deviceType, setDeviceType] = useState<'WEB' | 'MOBILE' | 'DESKTOP'>('WEB');

  useEffect(() => {
    const detectDevice = () => {
      const ua = navigator.userAgent;
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
      const isTablet = /iPad|Android(?!.*Mobile)/i.test(ua);
      
      // Check if it's a standalone PWA or mobile browser
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      
      // Determine device type
      if (isMobile && !isTablet) {
        setDeviceType('MOBILE');
      } else if (isTablet) {
        setDeviceType('MOBILE'); // Treat tablets as mobile
      } else {
        setDeviceType('DESKTOP');
      }
    };

    detectDevice();
    
    // Re-detect on resize (for responsive behavior)
    window.addEventListener('resize', detectDevice);
    return () => window.removeEventListener('resize', detectDevice);
  }, []);

  return <span className="text-[var(--text-primary)]">{deviceType}</span>;
}

