'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { estimateChatCredits } from '@/lib/client/pricing';
import { notifyCreditsUpdated } from '@/lib/client/events';
import { SCRIPT_TRANSFER_KEY } from '@/lib/constants/navigation';
import type { Idea } from '@/lib/types/video';

export function useScriptGeneration() {
  const router = useRouter();
  const { publicKey } = useWallet();

  // Script generator state
  const [companyName, setCompanyName] = useState('');
  const [companyType, setCompanyType] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [customIdea, setCustomIdea] = useState('');
  const [scriptQuality, setScriptQuality] = useState<'nano' | 'mini' | 'high'>('mini');
  const [orientation, setOrientation] = useState<'vertical' | 'horizontal'>('horizontal');
  const [scriptDuration, setScriptDuration] = useState<'4' | '8' | '12'>('12');
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null);
  const [generatedScript, setGeneratedScript] = useState('');
  const [loadingIdeas, setLoadingIdeas] = useState(false);
  const [loadingScript, setLoadingScript] = useState(false);
  const [scriptError, setScriptError] = useState<string | null>(null);

  // Advanced options state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [targetAudience, setTargetAudience] = useState('');
  const [audienceProblem, setAudienceProblem] = useState('');
  const [callToAction, setCallToAction] = useState('');

  // Cost calculations
  const ideasCost = useMemo(() => {
    return estimateChatCredits(scriptQuality, 1000, 1500);
  }, [scriptQuality]);

  const scriptCost = useMemo(() => {
    return estimateChatCredits(scriptQuality, 1500, 2000);
  }, [scriptQuality]);

  const generateIdeas = useCallback(async () => {
    if (!publicKey) {
      setScriptError('WALLET NOT CONNECTED: Please connect your wallet to generate ideas');
      return;
    }

    if (!companyName.trim() || !companyType.trim()) {
      setScriptError('Please fill in Company/Product Name and Product/Company Type');
      return;
    }

    setLoadingIdeas(true);
    setScriptError(null);
    setIdeas([]);
    setSelectedIdea(null);

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
          // Advanced options
          targetAudience: targetAudience.trim() || undefined,
          audienceProblem: audienceProblem.trim() || undefined,
          callToAction: callToAction.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate ideas');
      }

      setIdeas(data.threads);
      notifyCreditsUpdated();
    } catch (err: any) {
      setScriptError(err.message || 'An error occurred while generating ideas');
      notifyCreditsUpdated();
    } finally {
      setLoadingIdeas(false);
    }
  }, [publicKey, companyName, companyType, productDescription, scriptQuality, orientation, scriptDuration, targetAudience, audienceProblem, callToAction]);

  const generateScript = useCallback(async (idea: Idea | string) => {
    if (!publicKey) {
      setScriptError('WALLET NOT CONNECTED: Please connect your wallet to generate scripts');
      return;
    }

    const ideaText = typeof idea === 'string' ? idea : idea.description;

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
          thread: ideaText,
          quality: scriptQuality,
          orientation,
          duration: scriptDuration,
          // Advanced options
          targetAudience: targetAudience.trim() || undefined,
          audienceProblem: audienceProblem.trim() || undefined,
          callToAction: callToAction.trim() || undefined,
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
  }, [publicKey, companyName, companyType, productDescription, scriptQuality, orientation, scriptDuration, targetAudience, audienceProblem, callToAction]);

  const handleIdeaSelect = useCallback((idea: Idea) => {
    setSelectedIdea(idea);
    generateScript(idea);
  }, [generateScript]);

  const handleCustomIdeaSubmit = useCallback(() => {
    if (!customIdea.trim()) {
      setScriptError('Please enter a custom idea');
      return;
    }
    generateScript(customIdea);
  }, [customIdea, generateScript]);

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
    customIdea,
    setCustomIdea,
    scriptQuality,
    setScriptQuality,
    orientation,
    setOrientation,
    scriptDuration,
    setScriptDuration,
    ideas,
    selectedIdea,
    generatedScript,
    loadingIdeas,
    loadingScript,
    scriptError,
    // Advanced options
    showAdvanced,
    setShowAdvanced,
    targetAudience,
    setTargetAudience,
    audienceProblem,
    setAudienceProblem,
    callToAction,
    setCallToAction,
    // Costs
    ideasCost,
    scriptCost,
    // Functions
    generateIdeas,
    generateScript,
    handleIdeaSelect,
    handleCustomIdeaSubmit,
    generateVideoFromScript,
  };
}
