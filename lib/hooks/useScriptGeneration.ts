'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { estimateChatCredits } from '@/lib/client/pricing';
import { notifyCreditsUpdated } from '@/lib/client/events';
import { SCRIPT_TRANSFER_KEY } from '@/lib/constants/navigation';
import type { Thread } from '@/lib/types/video';

export function useScriptGeneration() {
  const router = useRouter();
  const { publicKey } = useWallet();

  // Script generator state
  const [companyName, setCompanyName] = useState('');
  const [companyType, setCompanyType] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [customThread, setCustomThread] = useState('');
  const [scriptQuality, setScriptQuality] = useState<'nano' | 'mini' | 'high'>('mini');
  const [orientation, setOrientation] = useState<'vertical' | 'horizontal'>('horizontal');
  const [scriptDuration, setScriptDuration] = useState<'4' | '8' | '12'>('12');
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [generatedScript, setGeneratedScript] = useState('');
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [loadingScript, setLoadingScript] = useState(false);
  const [scriptError, setScriptError] = useState<string | null>(null);

  // Cost calculations
  const threadsCost = useMemo(() => {
    return estimateChatCredits(scriptQuality, 1000, 1500);
  }, [scriptQuality]);

  const scriptCost = useMemo(() => {
    return estimateChatCredits(scriptQuality, 1500, 2000);
  }, [scriptQuality]);

  const generateThreads = useCallback(async () => {
    if (!publicKey) {
      setScriptError('WALLET NOT CONNECTED: Please connect your wallet to generate threads');
      return;
    }

    if (!companyName.trim() || !companyType.trim()) {
      setScriptError('Please fill in Company/Product Name and Product/Company Type');
      return;
    }

    setLoadingThreads(true);
    setScriptError(null);
    setThreads([]);
    setSelectedThread(null);

    try {
      const response = await fetch('/api/generate-threads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyName,
          companyType,
          product: productDescription,
          quality: scriptQuality,
          orientation,
          duration: scriptDuration,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate threads');
      }

      setThreads(data.threads);
      notifyCreditsUpdated();
    } catch (err: any) {
      setScriptError(err.message || 'An error occurred while generating threads');
      notifyCreditsUpdated();
    } finally {
      setLoadingThreads(false);
    }
  }, [publicKey, companyName, companyType, productDescription, scriptQuality, orientation, scriptDuration]);

  const generateScript = useCallback(async (thread: Thread | string) => {
    if (!publicKey) {
      setScriptError('WALLET NOT CONNECTED: Please connect your wallet to generate scripts');
      return;
    }

    const threadText = typeof thread === 'string' ? thread : thread.description;

    setLoadingScript(true);
    setScriptError(null);
    setGeneratedScript('');

    try {
      const response = await fetch('/api/generate-script', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyName,
          companyType,
          product: productDescription,
          thread: threadText,
          quality: scriptQuality,
          orientation,
          duration: scriptDuration,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate script');
      }

      setGeneratedScript(data.script);
      notifyCreditsUpdated();
    } catch (err: any) {
      setScriptError(err.message || 'An error occurred while generating script');
      notifyCreditsUpdated();
    } finally {
      setLoadingScript(false);
    }
  }, [publicKey, companyName, companyType, productDescription, scriptQuality, orientation, scriptDuration]);

  const handleThreadSelect = useCallback((thread: Thread) => {
    setSelectedThread(thread);
    generateScript(thread);
  }, [generateScript]);

  const handleCustomThreadSubmit = useCallback(() => {
    if (!customThread.trim()) {
      setScriptError('Please enter a custom thread');
      return;
    }
    generateScript(customThread);
  }, [customThread, generateScript]);

  const generateVideoFromScript = useCallback(() => {
    if (typeof window !== 'undefined') {
      const payload = {
        prompt: generatedScript,
        orientation,
        duration: scriptDuration,
      };
      sessionStorage.setItem(SCRIPT_TRANSFER_KEY, JSON.stringify(payload));
    }
    router.push('/video-gen');
  }, [generatedScript, orientation, scriptDuration, router]);

  return {
    // State
    companyName,
    setCompanyName,
    companyType,
    setCompanyType,
    productDescription,
    setProductDescription,
    customThread,
    setCustomThread,
    scriptQuality,
    setScriptQuality,
    orientation,
    setOrientation,
    scriptDuration,
    setScriptDuration,
    threads,
    selectedThread,
    generatedScript,
    loadingThreads,
    loadingScript,
    scriptError,
    // Costs
    threadsCost,
    scriptCost,
    // Functions
    generateThreads,
    generateScript,
    handleThreadSelect,
    handleCustomThreadSubmit,
    generateVideoFromScript,
  };
}


