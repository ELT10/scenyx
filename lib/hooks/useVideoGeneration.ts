'use client';

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { estimateVideoCredits, estimateChatCredits, formatCredits } from '@/lib/client/pricing';
import { notifyCreditsUpdated } from '@/lib/client/events';
import { SCRIPT_TRANSFER_KEY } from '@/lib/constants/navigation';
import type { ArchiveItem } from '@/lib/types/video';

export function useVideoGeneration() {
  const router = useRouter();
  const { publicKey } = useWallet();

  // Generate video state
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generatedVideoId, setGeneratedVideoId] = useState<string | null>(null);
  const [generationProgress, setGenerationProgress] = useState<number>(0);
  const [generationStatus, setGenerationStatus] = useState<string>('');
  const [videoQuality, setVideoQuality] = useState<'sora-2' | 'sora-2-pro'>('sora-2');
  const [videoDuration, setVideoDuration] = useState<'4' | '8' | '12'>('12');
  const [videoOrientation, setVideoOrientation] = useState<'vertical' | 'horizontal'>('horizontal');
  const [videoResolution, setVideoResolution] = useState<'standard' | 'high'>('standard');
  const [enhancingPrompt, setEnhancingPrompt] = useState(false);
  const generationPollingRef = useRef<NodeJS.Timeout | null>(null);

  // Remix video state
  const [showRemixUI, setShowRemixUI] = useState(false);
  const [remixPrompt, setRemixPrompt] = useState('');
  const [remixing, setRemixing] = useState(false);
  const [currentVideoModel, setCurrentVideoModel] = useState<string | null>(null);
  const [currentVideoSeconds, setCurrentVideoSeconds] = useState<string>('12');
  const [currentVideoSize, setCurrentVideoSize] = useState<string>('1280x720');

  // Cost calculations
  const videoCost = useMemo(() => {
    const seconds = parseInt(videoDuration) || 12;
    return estimateVideoCredits(videoQuality, seconds, videoResolution);
  }, [videoQuality, videoDuration, videoResolution]);

  const remixCost = useMemo(() => {
    if (!currentVideoModel) return 0;
    const seconds = parseInt(currentVideoSeconds) || 12;
    const size = currentVideoSize;
    let resolution = 'standard';
    if (size === '1792x1024' || size === '1024x1792') {
      resolution = 'high';
    }
    return estimateVideoCredits(currentVideoModel, seconds, resolution);
  }, [currentVideoModel, currentVideoSeconds, currentVideoSize]);

  const enhancePromptCredits = useMemo(() => {
    const approxInputTokens = Math.min(4000, Math.max(800, Math.ceil(prompt.length / 4) + 1200));
    const approxOutputTokens = 1200;
    return estimateChatCredits('mini', approxInputTokens, approxOutputTokens);
  }, [prompt]);

  // Handle script transfer from sessionStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const transferRaw = sessionStorage.getItem(SCRIPT_TRANSFER_KEY);
    if (!transferRaw) return;

    try {
      const transfer = JSON.parse(transferRaw) as { 
        prompt?: string; 
        orientation?: 'vertical' | 'horizontal'; 
        duration?: '4' | '8' | '12' 
      };
      if (transfer.prompt) {
        setPrompt(transfer.prompt);
      }
      if (transfer.orientation) {
        setVideoOrientation(transfer.orientation);
      }
      if (transfer.duration) {
        setVideoDuration(transfer.duration);
      }
    } catch (error) {
      console.warn('Failed to restore script transfer payload', error);
    } finally {
      sessionStorage.removeItem(SCRIPT_TRANSFER_KEY);
    }
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (generationPollingRef.current) {
        clearInterval(generationPollingRef.current);
      }
    };
  }, []);

  const saveVideoIdToLocalStorage = useCallback((videoId: string, prompt: string) => {
    try {
      const savedIds = JSON.parse(localStorage.getItem('sora_video_ids') || '[]');
      const newEntry = {
        video_id: videoId,
        prompt: prompt,
        saved_at: Date.now(),
      };
      savedIds.unshift(newEntry);
      localStorage.setItem('sora_video_ids', JSON.stringify(savedIds));
    } catch (error) {
      console.error('Failed to save video ID to localStorage:', error);
    }
  }, []);

  const pollGenerationProgress = useCallback(async (videoId: string, savedPrompt: string) => {
    try {
      const response = await fetch(`/api/check-video?video_id=${encodeURIComponent(videoId)}`);
      const data = await response.json();
      
      // Check if it's a temporary server error - if so, ignore and keep polling
      if (!response.ok && data.error === 'Server error' && data.details?.error?.type === 'server_error') {
        console.log('⚠️ Temporary server error while polling, will retry on next poll...');
        return;
      }
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to check video status');
      }

      setGenerationProgress(data.progress || 0);
      setGenerationStatus(data.status);

      if (data.status === 'completed' && data.video_data) {
        setVideoUrl(data.video_data);
        setLoading(false);
        setGenerationProgress(100);
        setCurrentVideoModel(data.model || null);
        setCurrentVideoSeconds(data.seconds || '12');
        setCurrentVideoSize(data.size || '1280x720');
        notifyCreditsUpdated();

        if (generationPollingRef.current) {
          clearInterval(generationPollingRef.current);
          generationPollingRef.current = null;
        }
      } else if (data.status === 'failed') {
        const errorMessage = data.error?.message || 'Video generation failed';
        const errorCode = data.error?.code || 'unknown_error';
        setError(`${errorCode.toUpperCase()}: ${errorMessage}`);
        setLoading(false);
        notifyCreditsUpdated();

        if (generationPollingRef.current) {
          clearInterval(generationPollingRef.current);
          generationPollingRef.current = null;
        }
      }
    } catch (err: any) {
      console.error('Error polling progress:', err);
      console.log('⚠️ Network error while polling, will retry on next poll...');
    }
  }, []);

  const generateVideo = useCallback(async () => {
    if (!publicKey) {
      setError('WALLET NOT CONNECTED: Please connect your wallet to generate videos');
      return;
    }

    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setLoading(true);
    setError(null);
    setVideoUrl(null);
    setGeneratedVideoId(null);
    setGenerationProgress(0);
    setGenerationStatus('queued');
    setShowRemixUI(false);
    setRemixPrompt('');
    setCurrentVideoModel(null);
    setCurrentVideoSeconds('12');
    setCurrentVideoSize('1280x720');

    try {
      const response = await fetch('/api/generate-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          pollForCompletion: false,
          model: videoQuality,
          seconds: videoDuration,
          orientation: videoOrientation,
          resolution: videoResolution,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.errorCode 
          ? `${data.errorCode.toUpperCase()}: ${data.error}` 
          : (data.error || 'Failed to generate video');
        throw new Error(errorMsg);
      }

      setGeneratedVideoId(data.video_id);

      if (data.video_id) {
        saveVideoIdToLocalStorage(data.video_id, prompt);
      }

      const savedPrompt = prompt;
      pollGenerationProgress(data.video_id, savedPrompt);

      generationPollingRef.current = setInterval(() => {
        pollGenerationProgress(data.video_id, savedPrompt);
      }, 6000);

    } catch (err: any) {
      setError(err.message || 'An error occurred while generating the video');
      setLoading(false);
    }
  }, [publicKey, prompt, videoQuality, videoDuration, videoOrientation, videoResolution, pollGenerationProgress, saveVideoIdToLocalStorage]);

  const enhancePrompt = useCallback(async () => {
    if (!prompt.trim() || enhancingPrompt) return;
    
    try {
      setEnhancingPrompt(true);
      const res = await fetch('/api/enhance-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          seconds: videoDuration,
          orientation: videoOrientation,
          quality: 'mini',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.enhancedPrompt) {
        throw new Error(data?.error || 'Failed to enhance prompt');
      }
      setPrompt(data.enhancedPrompt);
    } catch (e: any) {
      setError(e?.message || 'Failed to enhance prompt');
    } finally {
      setEnhancingPrompt(false);
    }
  }, [prompt, videoDuration, videoOrientation, enhancingPrompt]);

  const remixVideo = useCallback(async () => {
    if (!publicKey) {
      setError('WALLET NOT CONNECTED: Please connect your wallet to remix videos');
      return;
    }

    if (!generatedVideoId) {
      setError('No video ID available for remix');
      return;
    }

    if (!remixPrompt.trim()) {
      setError('Please enter a remix prompt describing the change you want');
      return;
    }

    setRemixing(true);
    setError(null);

    try {
      const response = await fetch('/api/remix-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          video_id: generatedVideoId,
          prompt: remixPrompt,
          pollForCompletion: false,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.errorCode 
          ? `${data.errorCode.toUpperCase()}: ${data.error}` 
          : (data.error || 'Failed to remix video');
        throw new Error(errorMsg);
      }

      const newVideoId = data.video_id;
      if (newVideoId) {
        saveVideoIdToLocalStorage(newVideoId, `REMIX: ${remixPrompt}`);
      }

      setShowRemixUI(false);
      setRemixPrompt('');
      setRemixing(false);
      notifyCreditsUpdated();

      // Navigate to archive
      router.push('/archive');

    } catch (err: any) {
      setError(err.message || 'An error occurred while remixing the video');
      setRemixing(false);
    }
  }, [publicKey, generatedVideoId, remixPrompt, saveVideoIdToLocalStorage, router]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (prompt.trim() && !loading) {
        generateVideo();
      }
    }
  }, [prompt, loading, generateVideo]);

  return {
    // State
    prompt,
    setPrompt,
    loading,
    videoUrl,
    setVideoUrl,
    error,
    setError,
    generatedVideoId,
    generationProgress,
    generationStatus,
    videoQuality,
    setVideoQuality,
    videoDuration,
    setVideoDuration,
    videoOrientation,
    setVideoOrientation,
    videoResolution,
    setVideoResolution,
    enhancingPrompt,
    showRemixUI,
    setShowRemixUI,
    remixPrompt,
    setRemixPrompt,
    remixing,
    currentVideoModel,
    currentVideoSeconds,
    currentVideoSize,
    // Costs
    videoCost,
    remixCost,
    enhancePromptCredits,
    // Functions
    generateVideo,
    enhancePrompt,
    remixVideo,
    handleKeyDown,
  };
}

