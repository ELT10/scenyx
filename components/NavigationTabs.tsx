'use client';

import { useRef, useEffect, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { TAB_TO_PATH, resolveTabFromPath, type TabKey } from '@/lib/constants/navigation';

export default function NavigationTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const activeTab = useMemo(() => resolveTabFromPath(pathname), [pathname]);
  
  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURN
  const tabScrollRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = {
    script: useRef<HTMLButtonElement | null>(null),
    generate: useRef<HTMLButtonElement | null>(null),
    lipsync: useRef<HTMLButtonElement | null>(null),
    view: useRef<HTMLButtonElement | null>(null),
  } as const;

  const switchTab = (tab: TabKey) => {
    const targetPath = TAB_TO_PATH[tab];
    if (pathname !== targetPath) {
      router.push(targetPath);
    }
  };

  // Auto-scroll to active tab
  useEffect(() => {
    const scrollContainer = tabScrollRef.current;
    if (!scrollContainer) return;

    const activeEl = tabRefs[activeTab].current;
    if (!activeEl) return;

    const containerRect = scrollContainer.getBoundingClientRect();
    const activeRect = activeEl.getBoundingClientRect();
    const offset = activeRect.left - containerRect.left;
    const scroll = offset - (containerRect.width / 2 - activeRect.width / 2);

    scrollContainer.scrollTo({
      left: scrollContainer.scrollLeft + scroll,
      behavior: 'smooth',
    });
  }, [activeTab]);

  // Hide navigation tabs on certain pages (AFTER all hooks are called)
  const shouldHideNavigation = useMemo(() => {
    return pathname?.startsWith('/credits') || pathname?.startsWith('/archive/');
  }, [pathname]);
  
  if (shouldHideNavigation) {
    return null;
  }

  return (
    <>
      {/* Platform Title */}
      <div className="mb-4 sm:mb-7 sm:mt-4 flex items-center justify-center gap-2 text-[12px] sm:text-sm uppercase tracking-[0.3em]">
        <span className="text-[var(--accent-cyan)] hidden sm:block">AI POWERED</span>
        <span className="text-[var(--text-muted)] hidden sm:block">//</span>
        <span className="text-[var(--text-primary)]">VIDEO GENERATION PLATFORM</span>
      </div>

      {/* Tabs */}
      <div className="relative mb-8">
        <div className="tab-fade tab-fade-left"></div>
        <div className="tab-fade tab-fade-right"></div>
        <div className="tab-scroll" ref={tabScrollRef}>
          <button
            onClick={() => switchTab('script')}
            ref={tabRefs.script}
            className={`tab-button ${activeTab === 'script' ? 'active' : ''}`}
          >
            [ AD SCRIPT GEN ]
          </button>
          <button
            onClick={() => switchTab('generate')}
            ref={tabRefs.generate}
            className={`tab-button ${activeTab === 'generate' ? 'active' : ''}`}
          >
            [ VIDEO GEN ]
          </button>
          <button
            onClick={() => switchTab('lipsync')}
            ref={tabRefs.lipsync}
            className={`tab-button ${activeTab === 'lipsync' ? 'active' : ''}`}
          >
            [ LIP SYNC ]
          </button>
          <button
            onClick={() => switchTab('view')}
            ref={tabRefs.view}
            className={`tab-button ${activeTab === 'view' ? 'active' : ''}`}
          >
            [ ARCHIVE ]
          </button>
        </div>
      </div>
    </>
  );
}


