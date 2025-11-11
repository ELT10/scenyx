'use client';

import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { estimateLipSyncCredits, estimateTTSCredits, estimateAvatarCredits, estimateVoiceoverScriptCredits, LIPSYNC_PRICING_PER_SECOND_USD_MICROS } from '@/lib/client/pricing';
import { notifyCreditsUpdated } from '@/lib/client/events';
import type { ModelStatus as ModelStatusType } from '@/lib/replicate/modelStatus';

type ModelStatus = 'online' | 'offline' | 'unknown';

export function useLipSync() {
  const { publicKey } = useWallet();

  // Lip sync state
  const [lipSyncScript, setLipSyncScript] = useState('');
  const [generatingVoiceoverScript, setGeneratingVoiceoverScript] = useState(false);
  const [voiceoverScriptError, setVoiceoverScriptError] = useState<string | null>(null);
  const [lipSyncVoice, setLipSyncVoice] = useState<'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'>('nova');
  const [lipSyncModel, setLipSyncModel] = useState<string>('bytedance/omni-human');
  const [lipSyncPrompt, setLipSyncPrompt] = useState('');
  const [lipSyncImageFile, setLipSyncImageFile] = useState<File | null>(null);
  const [lipSyncImagePreview, setLipSyncImagePreview] = useState<string | null>(null);
  const [lipSyncAudioFile, setLipSyncAudioFile] = useState<File | null>(null);
  const [lipSyncAudioUrl, setLipSyncAudioUrl] = useState<string | null>(null);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
  const [loadingTTS, setLoadingTTS] = useState(false);
  const [loadingLipSync, setLoadingLipSync] = useState(false);
  const [lipSyncResult, setLipSyncResult] = useState<string | null>(null);
  const [lipSyncError, setLipSyncError] = useState<string | null>(null);
  const [lipSyncPredictionId, setLipSyncPredictionId] = useState<string | null>(null);
  const [lipSyncProgress, setLipSyncProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState<number>(10);
  const lipSyncPollingRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isModelModalOpen, setIsModelModalOpen] = useState(false);
  const [modelStatuses, setModelStatuses] = useState<Record<string, ModelStatus>>({});

  // Avatar generation state
  const [imageSource, setImageSource] = useState<'upload' | 'ai'>('upload');
  const [audioSource, setAudioSource] = useState<'tts' | 'upload'>('tts');
  const [avatarType, setAvatarType] = useState<'face' | 'full-body'>('face');
  const [avatarPrompt, setAvatarPrompt] = useState('');
  const [enhancingAvatarPrompt, setEnhancingAvatarPrompt] = useState(false);
  const [avatarEnhanceError, setAvatarEnhanceError] = useState<string | null>(null);
  const [generatingAvatar, setGeneratingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [generatedAvatarUrl, setGeneratedAvatarUrl] = useState<string | null>(null);

  const supportedLipSyncModels = useMemo(() => {
    const knownModels = Object.keys(LIPSYNC_PRICING_PER_SECOND_USD_MICROS);
    if (!knownModels.includes('wan-video/wan-2.2-s2v')) {
      knownModels.unshift('wan-video/wan-2.2-s2v');
    }
    return Array.from(new Set(knownModels));
  }, []);

  const lipSyncModelLabels = useMemo<Record<string, string>>(() => ({
    'wan-video/wan-2.2-s2v': '[ BEST VALUE ] WAN-Video 2.2',
    'bytedance/omni-human': '[ HIGH QUALITY ] Omni-Human by ByteDance',
  }), []);

  const statusStyles = useMemo<Record<ModelStatus, { backgroundColor: string; color: string }>>(() => ({
    online: {
      backgroundColor: 'rgba(16,185,129,0.15)',
      color: '#10B981',
    },
    offline: {
      backgroundColor: 'rgba(239,68,68,0.15)',
      color: '#EF4444',
    },
    unknown: {
      backgroundColor: 'rgba(99,102,241,0.15)',
      color: '#6366F1',
    },
  }), []);

  const statusLabels = useMemo<Record<ModelStatus, string>>(() => ({
    online: 'ONLINE',
    offline: 'OFFLINE',
    unknown: 'UNKNOWN',
  }), []);

  const fetchLipSyncModelStatuses = useCallback(async () => {
    if (!supportedLipSyncModels.length) return;
    try {
      const query = encodeURIComponent(supportedLipSyncModels.join(','));
      const response = await fetch(`/api/replicate/status?models=${query}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('Failed to fetch model statuses');
      const data = await response.json();
      setModelStatuses(data?.statuses || {});
    } catch (error) {
      console.warn('Failed to fetch lip sync model statuses:', error);
      setModelStatuses({});
    }
  }, [supportedLipSyncModels]);

  // Cost calculations
  const lipSyncCost = useMemo(() => {
    return estimateLipSyncCredits(lipSyncModel, Math.ceil(audioDuration));
  }, [lipSyncModel, audioDuration]);

  const ttsCost = useMemo(() => {
    return estimateTTSCredits(lipSyncScript.length);
  }, [lipSyncScript]);

  const avatarCost = useMemo(() => {
    return estimateAvatarCredits();
  }, []);

  const voiceoverScriptCost = useMemo(() => {
    return estimateVoiceoverScriptCredits();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (lipSyncPollingRef.current) {
        clearInterval(lipSyncPollingRef.current);
      }
    };
  }, []);

  const handleImageFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLipSyncImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLipSyncImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      // Clear the image when null is passed
      setLipSyncImageFile(null);
      setLipSyncImagePreview(null);
    }
  }, []);

  const handleAudioFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLipSyncAudioFile(file);
      const url = URL.createObjectURL(file);
      setLipSyncAudioUrl(url);
      setGeneratedAudioUrl(null);
      setAudioDuration(10);
    } else {
      // Clear the audio when null is passed
      setLipSyncAudioFile(null);
      setLipSyncAudioUrl(null);
    }
  }, []);

  const handleAudioLoaded = useCallback((e: React.SyntheticEvent<HTMLAudioElement>) => {
    const audio = e.currentTarget;
    if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
      const durationInSeconds = Math.ceil(audio.duration);
      setAudioDuration(durationInSeconds);
      if (process.env.NODE_ENV === 'development') {
        console.log('Audio duration detected:', durationInSeconds, 'seconds');
      }
    }
  }, []);

  const generateAvatar = useCallback(async () => {
    if (!publicKey) {
      setAvatarError('WALLET NOT CONNECTED: Please connect your wallet');
      return;
    }

    if (!avatarPrompt.trim()) {
      setAvatarError('Please enter a description for your avatar');
      return;
    }

    setGeneratingAvatar(true);
    setAvatarError(null);

    try {
      const response = await fetch('/api/generate-avatar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: avatarPrompt,
          aspect_ratio: '4:3',
          avatar_type: avatarType,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        if (data.image_url) {
          setGeneratedAvatarUrl(data.image_url);
          setAvatarError(null);
          if (process.env.NODE_ENV === 'development') {
            console.log('Avatar generated successfully');
          }
        } else {
          throw new Error('No image URL in response');
        }
      } else {
        throw new Error(data.error || 'Generation failed');
      }
    } catch (error) {
      console.error('Avatar generation failed:', error);
      setAvatarError(error instanceof Error ? error.message : 'Failed to generate avatar');
    } finally {
      setGeneratingAvatar(false);
    }
  }, [publicKey, avatarPrompt, avatarType]);

  const enhanceAvatarPrompt = useCallback(async () => {
    if (!avatarPrompt.trim()) {
      setAvatarEnhanceError('Please enter a description to enhance');
      return;
    }

    if (!publicKey) {
      setAvatarEnhanceError('Wallet not connected');
      return;
    }

    try {
      setEnhancingAvatarPrompt(true);
      setAvatarEnhanceError(null);

      const response = await fetch('/api/enhance-avatar-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: avatarPrompt }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to enhance prompt');
      }

      setAvatarPrompt(data.enhanced_prompt);
      if (process.env.NODE_ENV === 'development') {
        console.log('Avatar prompt enhanced:', data.enhanced_prompt);
      }
    } catch (error) {
      console.error('Enhance avatar prompt failed:', error);
      setAvatarEnhanceError(error instanceof Error ? error.message : 'Failed to enhance');
    } finally {
      setEnhancingAvatarPrompt(false);
    }
  }, [publicKey, avatarPrompt]);

  const clearAvatar = useCallback(() => {
    setGeneratedAvatarUrl(null);
    setAvatarError(null);
    setAvatarEnhanceError(null);
  }, []);

  const generateVoiceoverScript = useCallback(async () => {
    if (!lipSyncScript.trim()) {
      setVoiceoverScriptError('Please enter a rough idea or description');
      return;
    }

    if (!publicKey) {
      setVoiceoverScriptError('Wallet not connected');
      return;
    }

    try {
      setGeneratingVoiceoverScript(true);
      setVoiceoverScriptError(null);

      const response = await fetch('/api/generate-voiceover-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          idea: lipSyncScript,
          duration: 30
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate script');
      }

      setLipSyncScript(data.script);
      if (process.env.NODE_ENV === 'development') {
        console.log('Voiceover script generated:', data.script);
        console.log('Estimated duration:', data.estimated_duration, 'seconds');
      }
    } catch (error) {
      console.error('Generate voiceover script failed:', error);
      setVoiceoverScriptError(error instanceof Error ? error.message : 'Failed to generate script');
    } finally {
      setGeneratingVoiceoverScript(false);
    }
  }, [publicKey, lipSyncScript]);

  const generateTTS = useCallback(async () => {
    if (!publicKey) {
      setLipSyncError('WALLET NOT CONNECTED: Please connect your wallet');
      return;
    }

    if (!lipSyncScript.trim()) {
      setLipSyncError('Please enter a script');
      return;
    }

    setLoadingTTS(true);
    setLipSyncError(null);

    try {
      const response = await fetch('/api/generate-tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: lipSyncScript,
          voice: lipSyncVoice,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate audio');
      }

      setGeneratedAudioUrl(data.audio_data);
      setLipSyncAudioUrl(data.audio_data);
      setLipSyncAudioFile(null);
      notifyCreditsUpdated();
    } catch (err: any) {
      setLipSyncError(err.message || 'Failed to generate audio');
    } finally {
      setLoadingTTS(false);
    }
  }, [publicKey, lipSyncScript, lipSyncVoice]);

  const pollLipSyncProgress = useCallback(async (predictionId: string) => {
    try {
      const response = await fetch(`/api/check-lipsync?prediction_id=${encodeURIComponent(predictionId)}`);
      if (!response.ok) {
        throw new Error('Failed to check status');
      }

      const data = await response.json();
      
      if (data.status === 'succeeded') {
        setLipSyncResult(data.video_data || data.video_url || data.output);
        setLoadingLipSync(false);
        setLipSyncProgress(100);
        notifyCreditsUpdated();

        if (lipSyncPollingRef.current) {
          clearInterval(lipSyncPollingRef.current);
          lipSyncPollingRef.current = null;
        }
      } else if (data.status === 'failed') {
        setLipSyncError(data.error || 'Lip sync generation failed');
        setLoadingLipSync(false);
        notifyCreditsUpdated();

        if (lipSyncPollingRef.current) {
          clearInterval(lipSyncPollingRef.current);
          lipSyncPollingRef.current = null;
        }
      } else if (data.status === 'processing') {
        setLipSyncProgress(50);
      }
    } catch (err: any) {
      console.error('Error polling lip sync:', err);
    }
  }, []);

  const generateLipSync = useCallback(async () => {
    if (!publicKey) {
      setLipSyncError('WALLET NOT CONNECTED: Please connect your wallet');
      return;
    }

    const currentStatus = modelStatuses[lipSyncModel];
    if (currentStatus === 'offline') {
      setLipSyncError('Selected model is offline. Please choose a different model or try again later.');
      return;
    }

    const imageUrl = generatedAvatarUrl || lipSyncImagePreview;
    if (!imageUrl) {
      setLipSyncError('Please upload an image or generate an avatar');
      return;
    }

    if (!lipSyncAudioUrl) {
      setLipSyncError('Please generate or upload audio');
      return;
    }

    setLoadingLipSync(true);
    setLipSyncError(null);
    setLipSyncResult(null);
    setLipSyncProgress(0);

    try {
      const requestBody: any = {
        imageUrl: imageUrl,
        audioUrl: lipSyncAudioUrl,
        model: lipSyncModel,
        audioDuration: Math.ceil(audioDuration),
        pollForCompletion: false,
      };
      
      if (lipSyncModel === 'wan-video/wan-2.2-s2v' && lipSyncPrompt.trim()) {
        requestBody.prompt = lipSyncPrompt;
      }
      
      const response = await fetch('/api/generate-lipsync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start lip sync');
      }

      setLipSyncPredictionId(data.prediction_id);
      
      if (data.status === 'succeeded' && (data.video_data || data.video_url)) {
        if (process.env.NODE_ENV === 'development') {
          console.log('Lip sync completed immediately!');
        }
        setLipSyncResult(data.video_data || data.video_url);
        setLipSyncProgress(100);
        setLoadingLipSync(false);
        notifyCreditsUpdated();
      } else {
        setLipSyncProgress(10);
        pollLipSyncProgress(data.prediction_id);
        lipSyncPollingRef.current = setInterval(() => {
          pollLipSyncProgress(data.prediction_id);
        }, 5000);
      }

    } catch (err: any) {
      setLipSyncError(err.message || 'Failed to generate lip sync video');
      setLoadingLipSync(false);
    }
  }, [publicKey, modelStatuses, lipSyncModel, generatedAvatarUrl, lipSyncImagePreview, lipSyncAudioUrl, audioDuration, lipSyncPrompt, pollLipSyncProgress]);

  return {
    // State
    lipSyncScript,
    setLipSyncScript,
    generatingVoiceoverScript,
    voiceoverScriptError,
    lipSyncVoice,
    setLipSyncVoice,
    lipSyncModel,
    setLipSyncModel,
    lipSyncPrompt,
    setLipSyncPrompt,
    lipSyncImageFile,
    lipSyncImagePreview,
    lipSyncAudioFile,
    lipSyncAudioUrl,
    generatedAudioUrl,
    loadingTTS,
    loadingLipSync,
    lipSyncResult,
    lipSyncError,
    setLipSyncError,
    lipSyncPredictionId,
    lipSyncProgress,
    audioDuration,
    audioRef,
    isModelModalOpen,
    setIsModelModalOpen,
    modelStatuses,
    imageSource,
    setImageSource,
    audioSource,
    setAudioSource,
    avatarType,
    setAvatarType,
    avatarPrompt,
    setAvatarPrompt,
    enhancingAvatarPrompt,
    avatarEnhanceError,
    generatingAvatar,
    avatarError,
    setAvatarError,
    generatedAvatarUrl,
    // Memos
    supportedLipSyncModels,
    lipSyncModelLabels,
    statusStyles,
    statusLabels,
    // Costs
    lipSyncCost,
    ttsCost,
    avatarCost,
    voiceoverScriptCost,
    // Functions
    fetchLipSyncModelStatuses,
    handleImageFileChange,
    handleAudioFileChange,
    handleAudioLoaded,
    generateAvatar,
    enhanceAvatarPrompt,
    clearAvatar,
    generateVoiceoverScript,
    generateTTS,
    generateLipSync,
  };
}

