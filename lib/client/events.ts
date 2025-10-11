// Client-side event utilities for cross-component communication

/**
 * Dispatch a custom event to notify that credits have been updated
 * This triggers HeaderCredits to refresh the balance display
 */
export function notifyCreditsUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('creditsUpdated'));
  }
}

/**
 * Listen for credit updates
 */
export function onCreditsUpdated(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  
  window.addEventListener('creditsUpdated', callback);
  return () => window.removeEventListener('creditsUpdated', callback);
}

