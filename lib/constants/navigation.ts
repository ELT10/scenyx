export type TabKey = 'generate' | 'view' | 'script' | 'lipsync';

export const TAB_TO_PATH: Record<TabKey, string> = {
  script: '/script-gen',
  generate: '/video-gen',
  lipsync: '/lip-sync',
  view: '/archive',
};

export const PATH_TO_TAB: Record<string, TabKey> = {
  '/': 'generate',
  '/script-gen': 'script',
  '/video-gen': 'generate',
  '/lip-sync': 'lipsync',
  '/archive': 'view',
};

export const SCRIPT_TRANSFER_KEY = 'scenyx_script_transfer';

export function resolveTabFromPath(pathname?: string | null): TabKey {
  if (!pathname) return 'generate';
  const trimmed = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  return PATH_TO_TAB[trimmed] ?? 'generate';
}


