'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { useWallet } from '@solana/wallet-adapter-react';
import TerminalPanel from '@/components/TerminalPanel';
import GlowButton from '@/components/GlowButton';
import StatusBadge from '@/components/StatusBadge';
import ProgressBar from '@/components/ProgressBar';
import DataGrid from '@/components/DataGrid';
import BackgroundEffects from '@/components/BackgroundEffects';
import TerminalInput from '@/components/TerminalInput';
import GlitchText from '@/components/GlitchText';
import CostEstimate from '@/components/CostEstimate';
import { estimateVideoCredits, estimateChatCredits, estimateLipSyncCredits, estimateTTSCredits, estimateAvatarCredits, estimateVoiceoverScriptCredits, formatCredits, LIPSYNC_PRICING_PER_SECOND_USD_MICROS } from '@/lib/client/pricing';
import { type ModelStatus } from '@/lib/replicate/modelStatus';
import { notifyCreditsUpdated } from '@/lib/client/events';

interface VideoStatus {
  video_id: string;
  status: 'queued' | 'in_progress' | 'completed' | 'failed';
  progress?: number;
  model?: string;
  created_at?: number;
  seconds?: string;
  size?: string;
  video_data?: string;
  error?: {
    code: string;
    message: string;
  };
}

interface Thread {
  id: number;
  title: string;
  description: string;
}

export default function Home() {
  // Wallet connection
  const { publicKey } = useWallet();
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'generate' | 'view' | 'script' | 'lipsync'>('generate');
  const tabScrollRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = {
    script: useRef<HTMLButtonElement | null>(null),
    generate: useRef<HTMLButtonElement | null>(null),
    lipsync: useRef<HTMLButtonElement | null>(null),
    view: useRef<HTMLButtonElement | null>(null),
  } as const;

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

  // Video status check state
  const [videoId, setVideoId] = useState('');
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [videoStatus, setVideoStatus] = useState<VideoStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [autoPolling, setAutoPolling] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // View videos state
  const [savedVideos, setSavedVideos] = useState<VideoStatus[]>([]); // legacy local archive (kept for status module)
  const [loadingVideos, setLoadingVideos] = useState(false);

  // DB-backed archive state
  interface ArchiveItem {
    video_id: string;
    model: string;
    status: 'queued' | 'in_progress' | 'completed' | 'failed';
    seconds?: string | null;
    created_at: string;
    source: 'replicate' | 'openai';
    expiresAt: string; // ISO
    remainingHours: number;
  }
  const [archiveItems, setArchiveItems] = useState<ArchiveItem[]>([]);
  const [loadingArchive, setLoadingArchive] = useState(false);
  const [previews, setPreviews] = useState<Record<string, { url?: string; loading?: boolean; error?: string }>>({});
  const [archiveFetching, setArchiveFetching] = useState<Record<string, boolean>>({});
  const archivePollingRef = useRef<NodeJS.Timeout | null>(null);
  const archiveItemsRef = useRef<ArchiveItem[]>([]);

  // Archive remix state
  const [archiveRemixVideoId, setArchiveRemixVideoId] = useState<string | null>(null);
  const [archiveRemixPrompt, setArchiveRemixPrompt] = useState('');
  const [archiveRemixing, setArchiveRemixing] = useState(false);
  const [archiveRemixCost, setArchiveRemixCost] = useState<number>(0);
  const [archiveRemixModel, setArchiveRemixModel] = useState<string>('');

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

  // Lip sync state
  const [lipSyncScript, setLipSyncScript] = useState('');
  const [generatingVoiceoverScript, setGeneratingVoiceoverScript] = useState(false);
  const [voiceoverScriptError, setVoiceoverScriptError] = useState<string | null>(null);
  const [lipSyncVoice, setLipSyncVoice] = useState<'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'>('nova');
  const [lipSyncModel, setLipSyncModel] = useState<string>('wan-video/wan-2.2-s2v');
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
  const [audioDuration, setAudioDuration] = useState<number>(10); // Default 10 seconds
  const lipSyncPollingRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  type ModelStatus = 'online' | 'offline' | 'unknown';
  const [isModelModalOpen, setIsModelModalOpen] = useState(false);
  const [modelStatuses, setModelStatuses] = useState<Record<string, ModelStatus>>({});

  const supportedLipSyncModels = useMemo(() => {
    const knownModels = Object.keys(LIPSYNC_PRICING_PER_SECOND_USD_MICROS);
    if (!knownModels.includes('wan-video/wan-2.2-s2v')) {
      knownModels.unshift('wan-video/wan-2.2-s2v');
    }
    return Array.from(new Set(knownModels));
  }, []);

  const lipSyncModelLabels = useMemo<Record<string, string>>(() => ({
    'wan-video/wan-2.2-s2v': '[ RECOMMENDED ] WAN-Video 2.2 (Best Value!) 💰',
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

  useEffect(() => {
    if (activeTab === 'lipsync') {
      fetchLipSyncModelStatuses();
    }
  }, [activeTab, fetchLipSyncModelStatuses]);

  useEffect(() => {
    if (isModelModalOpen) {
      fetchLipSyncModelStatuses();
    }
  }, [isModelModalOpen, fetchLipSyncModelStatuses]);
  
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

  // Cost estimates
  const videoCost = useMemo(() => {
    const seconds = parseInt(videoDuration) || 12;
    return estimateVideoCredits(videoQuality, seconds, videoResolution);
  }, [videoQuality, videoDuration, videoResolution]);

  // Remix cost based on the actual generated video's properties
  const remixCost = useMemo(() => {
    if (!currentVideoModel) return 0;
    const seconds = parseInt(currentVideoSeconds) || 12;
    // Determine resolution from size
    const size = currentVideoSize;
    let resolution = 'standard';
    if (size === '1792x1024' || size === '1024x1792') {
      resolution = 'high';
    }
    return estimateVideoCredits(currentVideoModel, seconds, resolution);
  }, [currentVideoModel, currentVideoSeconds, currentVideoSize]);

  const threadsCost = useMemo(() => {
    return estimateChatCredits(scriptQuality, 1000, 1500);
  }, [scriptQuality]);

  const scriptCost = useMemo(() => {
    return estimateChatCredits(scriptQuality, 1500, 2000);
  }, [scriptQuality]);

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

  // Enhance Prompt estimated credits (mirrors server-side rough token estimate)
  const enhancePromptCredits = useMemo(() => {
    const approxInputTokens = Math.min(4000, Math.max(800, Math.ceil(prompt.length / 4) + 1200));
    const approxOutputTokens = 1200;
    return estimateChatCredits('mini', approxInputTokens, approxOutputTokens);
  }, [prompt]);

  // LocalStorage functions
  const saveVideoIdToLocalStorage = (videoId: string, prompt: string) => {
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
  };

  const getVideoIdsFromLocalStorage = (): Array<{ video_id: string; prompt: string; saved_at: number }> => {
    try {
      return JSON.parse(localStorage.getItem('sora_video_ids') || '[]');
    } catch (error) {
      console.error('Failed to get video IDs from localStorage:', error);
      return [];
    }
  };

  const pollGenerationProgress = useCallback(async (videoId: string, savedPrompt: string) => {
    try {
      const response = await fetch(`/api/check-video?video_id=${encodeURIComponent(videoId)}`);
      
      // Handle response
      const data = await response.json();
      
      // Check if it's a temporary server error - if so, ignore and keep polling
      if (!response.ok && data.error === 'Server error' && data.details?.error?.type === 'server_error') {
        console.log('⚠️ Temporary server error while polling, will retry on next poll...');
        return; // Don't stop polling, just skip this iteration
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
        setCurrentVideoModel(data.model || null); // Store the model for remix capability check
        setCurrentVideoSeconds(data.seconds || '12');
        setCurrentVideoSize(data.size || '1280x720');
        notifyCreditsUpdated(); // Credits were deducted, update header

        if (generationPollingRef.current) {
          clearInterval(generationPollingRef.current);
          generationPollingRef.current = null;
        }
      } else if (data.status === 'failed') {
        // Show detailed error information
        const errorMessage = data.error?.message || 'Video generation failed';
        const errorCode = data.error?.code || 'unknown_error';
        setError(`${errorCode.toUpperCase()}: ${errorMessage}`);
        setLoading(false);
        notifyCreditsUpdated(); // Credits were not charged for failed videos

        if (generationPollingRef.current) {
          clearInterval(generationPollingRef.current);
          generationPollingRef.current = null;
        }
      }
    } catch (err: any) {
      console.error('Error polling progress:', err);
      // Don't show error to user or stop polling for network errors
      // The video might still be generating, just keep trying
      console.log('⚠️ Network error while polling, will retry on next poll...');
    }
  }, []);

  const generateVideo = async () => {
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
        // Show detailed error if available
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
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (prompt.trim() && !loading) {
        generateVideo();
      }
    }
  };

  const remixVideo = async () => {
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

      // Store the new video ID for tracking
      const newVideoId = data.video_id;
      if (newVideoId) {
        saveVideoIdToLocalStorage(newVideoId, `REMIX: ${remixPrompt}`);
      }

      // Reset remix state
      setShowRemixUI(false);
      setRemixPrompt('');
      setRemixing(false);

      // Update credits
      notifyCreditsUpdated();

      // Switch to archive tab to show the new remix being generated
      setActiveTab('view');

      // Reload archive to show the new remix immediately
      setLoadingArchive(true);
      try {
        const res = await fetch('/api/archive/recent?hours=20');
        const archiveData = await res.json();
        if (res.ok) {
          const items: ArchiveItem[] = archiveData.items || [];
          setArchiveItems(items);
          archiveItemsRef.current = items;
          
          // Fetch status for all items including the new one
          const fetchingMap: Record<string, boolean> = {};
          items.forEach((it) => { fetchingMap[it.video_id] = true; });
          setArchiveFetching(fetchingMap);

          items.forEach(async (item) => {
            try {
              const url = item.source === 'replicate'
                ? `/api/check-lipsync?prediction_id=${encodeURIComponent(item.video_id)}`
                : `/api/check-video?video_id=${encodeURIComponent(item.video_id)}`;
              const resp = await fetch(url);
              const payload = await resp.json();
              
              // Ignore temporary server errors, will retry on next poll
              if (!resp.ok && payload.error === 'Server error' && payload.details?.error?.type === 'server_error') {
                console.log(`⚠️ Temporary server error for ${item.video_id}, will retry on next poll...`);
                setArchiveFetching((prev) => ({ ...prev, [item.video_id]: false }));
                return;
              }
              
              if (!resp.ok) throw new Error(payload.error || 'Failed to refresh');
              const rawStatus: string = payload.status || item.status;
              let mapped: ArchiveItem['status'] = item.status;
              switch (rawStatus) {
                case 'queued': mapped = 'queued'; break;
                case 'in_progress':
                case 'processing':
                case 'starting': mapped = 'in_progress'; break;
                case 'completed':
                case 'succeeded': mapped = 'completed'; break;
                case 'failed': mapped = 'failed'; break;
                default: mapped = item.status;
              }
              setArchiveItems((prev) => {
                const next = prev.map((it) => it.video_id === item.video_id ? { ...it, status: mapped } : it);
                archiveItemsRef.current = next;
                return next;
              });
              const finalUrl = payload.video_data || payload.video_url || payload.output || undefined;
              if (finalUrl) {
                setPreviews((p) => ({ ...p, [item.video_id]: { ...(p[item.video_id] || {}), url: finalUrl } }));
              }
            } catch (_) {
              // ignore single-item refresh errors
            } finally {
              setArchiveFetching((prev) => ({ ...prev, [item.video_id]: false }));
            }
          });
        }
      } catch (e: any) {
        console.error('Archive refresh failed:', e);
      } finally {
        setLoadingArchive(false);
      }

    } catch (err: any) {
      setError(err.message || 'An error occurred while remixing the video');
      setRemixing(false);
    }
  };

  const checkVideoStatus = async () => {
    if (!videoId.trim()) {
      setStatusError('Please enter a video ID');
      return;
    }

    setCheckingStatus(true);
    setStatusError(null);
    setVideoStatus(null);

    try {
      const response = await fetch(`/api/check-video?video_id=${encodeURIComponent(videoId)}`);
      const data = await response.json();

      // Check if it's a temporary server error - show a gentle warning but don't fail
      if (!response.ok && data.error === 'Server error' && data.details?.error?.type === 'server_error') {
        setStatusError('Temporary server error. If polling is enabled, it will keep trying...');
        setCheckingStatus(false);
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to check video status');
      }

      setVideoStatus(data);

      if (data.status === 'completed' && data.video_data) {
        setVideoUrl(data.video_data);
      }
    } catch (err: any) {
      setStatusError(err.message || 'An error occurred while checking video status');
    } finally {
      setCheckingStatus(false);
    }
  };

  const stopPolling = useCallback(() => {
    setAutoPolling(false);
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  const startPolling = () => {
    setAutoPolling(true);
    checkVideoStatus();
    pollingIntervalRef.current = setInterval(() => {
      checkVideoStatus();
    }, 5000);
  };

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

  useEffect(() => {
    if (autoPolling && videoStatus) {
      if (videoStatus.status === 'completed' || videoStatus.status === 'failed') {
        stopPolling();
      }
    }
  }, [videoStatus, autoPolling, stopPolling]);

  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (generationPollingRef.current) {
        clearInterval(generationPollingRef.current);
      }
      if (lipSyncPollingRef.current) {
        clearInterval(lipSyncPollingRef.current);
      }
    };
  }, []);

  const loadSavedVideos = useCallback(async () => {
    setLoadingVideos(true);
    const videoIds = getVideoIdsFromLocalStorage();
    const videosWithStatus: VideoStatus[] = [];

    for (const entry of videoIds) {
      try {
        const response = await fetch(`/api/check-video?video_id=${encodeURIComponent(entry.video_id)}`);
        if (response.ok) {
          const data = await response.json();
          videosWithStatus.push(data);
        }
      } catch (error) {
        console.error(`Failed to fetch video ${entry.video_id}:`, error);
      }
    }

    setSavedVideos(videosWithStatus);
    setLoadingVideos(false);
  }, []);

  useEffect(() => {
    if (activeTab === 'view') {
      // Load DB-backed archive
      (async () => {
        setLoadingArchive(true);
        try {
          const res = await fetch('/api/archive/recent?hours=20');
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to load archive');
          const items: ArchiveItem[] = data.items || [];
          setArchiveItems(items);
          archiveItemsRef.current = items;
          // Immediately refresh each item status without blocking page load
          const fetchingMap: Record<string, boolean> = {};
          items.forEach((it) => { fetchingMap[it.video_id] = true; });
          setArchiveFetching(fetchingMap);

          items.forEach(async (item) => {
            try {
              const url = item.source === 'replicate'
                ? `/api/check-lipsync?prediction_id=${encodeURIComponent(item.video_id)}`
                : `/api/check-video?video_id=${encodeURIComponent(item.video_id)}`;
              const resp = await fetch(url);
              const payload = await resp.json();
              
              // Ignore temporary server errors, will retry on next poll
              if (!resp.ok && payload.error === 'Server error' && payload.details?.error?.type === 'server_error') {
                console.log(`⚠️ Temporary server error for ${item.video_id}, will retry on next poll...`);
                setArchiveFetching((prev) => ({ ...prev, [item.video_id]: false }));
                return;
              }
              
              if (!resp.ok) throw new Error(payload.error || 'Failed to refresh');
              const rawStatus: string = payload.status || item.status;
              let mapped: ArchiveItem['status'] = item.status;
              switch (rawStatus) {
                case 'queued': mapped = 'queued'; break;
                case 'in_progress':
                case 'processing':
                case 'starting': mapped = 'in_progress'; break;
                case 'completed':
                case 'succeeded': mapped = 'completed'; break;
                case 'failed': mapped = 'failed'; break;
                default: mapped = item.status;
              }
              setArchiveItems((prev) => {
                const next = prev.map((it) => it.video_id === item.video_id ? { ...it, status: mapped } : it);
                archiveItemsRef.current = next;
                return next;
              });
              // Store preview URL if available so expired items can still be shown
              const finalUrl = payload.video_data || payload.video_url || payload.output || undefined;
              if (finalUrl) {
                setPreviews((p) => ({ ...p, [item.video_id]: { ...(p[item.video_id] || {}), url: finalUrl } }));
              }
            } catch (_) {
              // ignore single-item refresh errors
            } finally {
              setArchiveFetching((prev) => ({ ...prev, [item.video_id]: false }));
            }
          });
        } catch (e: any) {
          console.error('Archive load failed:', e);
        } finally {
          setLoadingArchive(false);
        }
      })();
    }
  }, [activeTab]);

  // Poll archive items that are still generating to update their status
  const pollArchiveStatuses = useCallback(async () => {
    const current = archiveItemsRef.current;
    if (current.length === 0) return;
    const toPoll = current.filter((i) => i.status === 'queued' || i.status === 'in_progress');
    if (toPoll.length === 0) return;
    const updates: Record<string, Partial<ArchiveItem>> = {};
    // mark fetching
    toPoll.forEach((i) => setArchiveFetching((prev) => ({ ...prev, [i.video_id]: true })));
    await Promise.all(
      toPoll.map(async (item) => {
        try {
          const url = item.source === 'replicate'
            ? `/api/check-lipsync?prediction_id=${encodeURIComponent(item.video_id)}`
            : `/api/check-video?video_id=${encodeURIComponent(item.video_id)}`;
          const res = await fetch(url);
          const data = await res.json();
          
          // Ignore temporary server errors, will retry on next poll
          if (!res.ok && data.error === 'Server error' && data.details?.error?.type === 'server_error') {
            console.log(`⚠️ Temporary server error for ${item.video_id}, will retry...`);
            return;
          }
          
          if (!res.ok) return;
          // Normalize status values to our UI set
          const rawStatus: string = data.status || item.status;
          let mapped: ArchiveItem['status'] = item.status;
          switch (rawStatus) {
            case 'queued':
              mapped = 'queued';
              break;
            case 'in_progress':
            case 'processing':
            case 'starting':
              mapped = 'in_progress';
              break;
            case 'completed':
            case 'succeeded':
              mapped = 'completed';
              break;
            case 'failed':
              mapped = 'failed';
              break;
            default:
              // leave as-is to avoid breaking StatusBadge
              mapped = item.status;
          }
          updates[item.video_id] = { status: mapped };
          // Keep preview url if available
          const finalUrl = data.video_data || data.video_url || data.output || undefined;
          if (finalUrl) {
            setPreviews((p) => ({ ...p, [item.video_id]: { ...(p[item.video_id] || {}), url: finalUrl } }));
          }
        } catch (e) {
          // ignore polling error for single item
        } finally {
          setArchiveFetching((prev) => ({ ...prev, [item.video_id]: false }));
        }
      })
    );
    if (Object.keys(updates).length > 0) {
      setArchiveItems((prev) => {
        const next = prev.map((it) => ({ ...it, ...(updates[it.video_id] || {}) }));
        archiveItemsRef.current = next;
        return next;
      });
    }
  }, []);

  useEffect(() => {
    if (activeTab !== 'view') return;
    // Initial poll soon after load
    const t = setTimeout(() => {
      pollArchiveStatuses();
    }, 1000);
    // Interval polling
    archivePollingRef.current = setInterval(() => {
      pollArchiveStatuses();
    }, 7000);
    return () => {
      clearTimeout(t);
      if (archivePollingRef.current) clearInterval(archivePollingRef.current);
      archivePollingRef.current = null;
    };
  }, [activeTab, pollArchiveStatuses]);

  const generateThreads = async () => {
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
      notifyCreditsUpdated(); // Credits deducted, update header
    } catch (err: any) {
      setScriptError(err.message || 'An error occurred while generating threads');
      notifyCreditsUpdated(); // Credits may have been refunded on error
    } finally {
      setLoadingThreads(false);
    }
  };

  const generateScript = async (thread: Thread | string) => {
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
      notifyCreditsUpdated(); // Credits deducted, update header
    } catch (err: any) {
      setScriptError(err.message || 'An error occurred while generating script');
      notifyCreditsUpdated(); // Credits may have been refunded on error
    } finally {
      setLoadingScript(false);
    }
  };

  const handleThreadSelect = (thread: Thread) => {
    setSelectedThread(thread);
    generateScript(thread);
  };

  const handleCustomThreadSubmit = () => {
    if (!customThread.trim()) {
      setScriptError('Please enter a custom thread');
      return;
    }
    generateScript(customThread);
  };

  const generateVideoFromScript = () => {
    setActiveTab('generate');
    setPrompt(generatedScript);
    // Transfer orientation and duration settings from script to video generation
    setVideoOrientation(orientation);
    setVideoDuration(scriptDuration);
  };

  // Handle image file selection
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLipSyncImageFile(file);
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setLipSyncImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle audio file selection
  const handleAudioFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLipSyncAudioFile(file);
      // Create preview URL
      const url = URL.createObjectURL(file);
      setLipSyncAudioUrl(url);
      setGeneratedAudioUrl(null); // Clear generated audio
      setAudioDuration(10); // Reset to default until we detect actual duration
    }
  };

  // Detect audio duration when audio is loaded
  const handleAudioLoaded = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    const audio = e.currentTarget;
    if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
      const durationInSeconds = Math.ceil(audio.duration);
      setAudioDuration(durationInSeconds);
      console.log('Audio duration detected:', durationInSeconds, 'seconds');
    }
  };

  // Generate AI Avatar
  const generateAvatar = async () => {
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
          console.log('Avatar generated successfully');
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
  };

  const enhanceAvatarPrompt = async () => {
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
      console.log('Avatar prompt enhanced:', data.enhanced_prompt);
    } catch (error) {
      console.error('Enhance avatar prompt failed:', error);
      setAvatarEnhanceError(error instanceof Error ? error.message : 'Failed to enhance');
    } finally {
      setEnhancingAvatarPrompt(false);
    }
  };

  const clearAvatar = () => {
    setGeneratedAvatarUrl(null);
    // Optionally clear prompt: setAvatarPrompt('');
    setAvatarError(null);
    setAvatarEnhanceError(null);
  };

  const generateVoiceoverScript = async () => {
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
          duration: 30 // default 30 seconds
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate script');
      }

      setLipSyncScript(data.script);
      console.log('Voiceover script generated:', data.script);
      console.log('Estimated duration:', data.estimated_duration, 'seconds');
    } catch (error) {
      console.error('Generate voiceover script failed:', error);
      setVoiceoverScriptError(error instanceof Error ? error.message : 'Failed to generate script');
    } finally {
      setGeneratingVoiceoverScript(false);
    }
  };

  // Generate TTS audio
  const generateTTS = async () => {
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
      setLipSyncAudioFile(null); // Clear uploaded audio
      notifyCreditsUpdated();
    } catch (err: any) {
      setLipSyncError(err.message || 'Failed to generate audio');
    } finally {
      setLoadingTTS(false);
    }
  };

  // Poll lip sync progress
  const pollLipSyncProgress = useCallback(async (predictionId: string) => {
    try {
      const response = await fetch(`/api/check-lipsync?prediction_id=${encodeURIComponent(predictionId)}`);
      if (!response.ok) {
        throw new Error('Failed to check status');
      }

      const data = await response.json();
      
      if (data.status === 'succeeded') {
        // Use video_data (base64) for proper downloading, fallback to video_url
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
        setLipSyncProgress(50); // Approximate progress
      }
    } catch (err: any) {
      console.error('Error polling lip sync:', err);
    }
  }, []);

  // Generate lip sync video
  const remixArchiveVideo = async () => {
    if (!publicKey) {
      setError('WALLET NOT CONNECTED: Please connect your wallet to remix videos');
      return;
    }

    if (!archiveRemixVideoId) {
      setError('No video ID selected for remix');
      return;
    }

    if (!archiveRemixPrompt.trim()) {
      setError('Please enter a remix prompt describing the change you want');
      return;
    }

    setArchiveRemixing(true);
    setError(null);

    try {
      const response = await fetch('/api/remix-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          video_id: archiveRemixVideoId,
          prompt: archiveRemixPrompt,
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

      // Store the new video ID for tracking
      const newVideoId = data.video_id;
      if (newVideoId) {
        saveVideoIdToLocalStorage(newVideoId, `REMIX: ${archiveRemixPrompt}`);
      }

      // Close remix dialog
      setArchiveRemixVideoId(null);
      setArchiveRemixPrompt('');
      setArchiveRemixing(false);

      // Refresh archive to show new item immediately
      notifyCreditsUpdated();
      
      // Reload archive items
      setLoadingArchive(true);
      try {
        const res = await fetch('/api/archive/recent?hours=20');
        const archiveData = await res.json();
        if (res.ok) {
          const items: ArchiveItem[] = archiveData.items || [];
          setArchiveItems(items);
          archiveItemsRef.current = items;
          
          // Fetch status for all items including the new one
          const fetchingMap: Record<string, boolean> = {};
          items.forEach((it) => { fetchingMap[it.video_id] = true; });
          setArchiveFetching(fetchingMap);

          items.forEach(async (item) => {
            try {
              const url = item.source === 'replicate'
                ? `/api/check-lipsync?prediction_id=${encodeURIComponent(item.video_id)}`
                : `/api/check-video?video_id=${encodeURIComponent(item.video_id)}`;
              const resp = await fetch(url);
              const payload = await resp.json();
              
              // Ignore temporary server errors, will retry on next poll
              if (!resp.ok && payload.error === 'Server error' && payload.details?.error?.type === 'server_error') {
                console.log(`⚠️ Temporary server error for ${item.video_id}, will retry on next poll...`);
                setArchiveFetching((prev) => ({ ...prev, [item.video_id]: false }));
                return;
              }
              
              if (!resp.ok) throw new Error(payload.error || 'Failed to refresh');
              const rawStatus: string = payload.status || item.status;
              let mapped: ArchiveItem['status'] = item.status;
              switch (rawStatus) {
                case 'queued': mapped = 'queued'; break;
                case 'in_progress':
                case 'processing':
                case 'starting': mapped = 'in_progress'; break;
                case 'completed':
                case 'succeeded': mapped = 'completed'; break;
                case 'failed': mapped = 'failed'; break;
                default: mapped = item.status;
              }
              setArchiveItems((prev) => {
                const next = prev.map((it) => it.video_id === item.video_id ? { ...it, status: mapped } : it);
                archiveItemsRef.current = next;
                return next;
              });
              const finalUrl = payload.video_data || payload.video_url || payload.output || undefined;
              if (finalUrl) {
                setPreviews((p) => ({ ...p, [item.video_id]: { ...(p[item.video_id] || {}), url: finalUrl } }));
              }
            } catch (_) {
              // ignore single-item refresh errors
            } finally {
              setArchiveFetching((prev) => ({ ...prev, [item.video_id]: false }));
            }
          });
        }
      } catch (e: any) {
        console.error('Archive refresh failed:', e);
      } finally {
        setLoadingArchive(false);
      }

    } catch (err: any) {
      setError(err.message || 'An error occurred while remixing the video');
      setArchiveRemixing(false);
    }
  };

  const generateLipSync = async () => {
    if (!publicKey) {
      setLipSyncError('WALLET NOT CONNECTED: Please connect your wallet');
      return;
    }

    const currentStatus = modelStatuses[lipSyncModel];
    if (currentStatus === 'offline') {
      setLipSyncError('Selected model is offline. Please choose a different model or try again later.');
      return;
    }

    // Use generated avatar if available, otherwise use uploaded image
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
        audioDuration: Math.ceil(audioDuration), // Send actual audio duration for accurate pricing
        pollForCompletion: false,
      };
      
      // Add prompt for WAN-Video model
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
      
      // Check if video is already completed
      if (data.status === 'succeeded' && (data.video_data || data.video_url)) {
        console.log('Lip sync completed immediately!');
        setLipSyncResult(data.video_data || data.video_url);
        setLipSyncProgress(100);
        setLoadingLipSync(false);
        notifyCreditsUpdated();
      } else {
        // Start polling for models that use async processing
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
  };

  return (
    <div className="min-h-screen relative pb-24 sm:pb-20">
      <BackgroundEffects />

      <div className="relative z-10 container mx-auto px-3 sm:px-4 py-8 max-w-5xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-4 sm:mb-7 sm:mt-4"
        >
          {/* <GlitchText className="text-4xl font-black mb-4">
            SCENYX
          </GlitchText> */}
          <div className="flex items-center justify-center gap-2 text-[12px] sm:text-sm uppercase tracking-[0.3em]">
            <span className="text-[var(--accent-cyan)] hidden sm:block">AI POWERED</span>
            <span className="text-[var(--text-muted)] hidden sm:block">//</span>
            <span className="text-[var(--text-primary)]">VIDEO GENERATION PLATFORM</span>
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="relative mb-8">
          <div className="tab-fade tab-fade-left"></div>
          <div className="tab-fade tab-fade-right"></div>
          <div className="tab-scroll" ref={tabScrollRef}>
            <button
              onClick={() => setActiveTab('script')}
              ref={tabRefs.script}
              className={`tab-button ${activeTab === 'script' ? 'active' : ''}`}
            >
              [ SCRIPT GEN ]
            </button>
            <button
              onClick={() => setActiveTab('generate')}
              ref={tabRefs.generate}
              className={`tab-button ${activeTab === 'generate' ? 'active' : ''}`}
            >
              [ VIDEO GEN ]
            </button>
            <button
              onClick={() => setActiveTab('lipsync')}
              ref={tabRefs.lipsync}
              className={`tab-button ${activeTab === 'lipsync' ? 'active' : ''}`}
            >
              [ LIP SYNC ]
            </button>
            <button
              onClick={() => setActiveTab('view')}
              ref={tabRefs.view}
              className={`tab-button ${activeTab === 'view' ? 'active' : ''}`}
            >
              [ ARCHIVE ]
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'script' && (
          <motion.div
            key="script"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
            <TerminalPanel title="SCRIPT GENERATION MODULE" status="active">
              <div className="space-y-6">
                <DataGrid columns={2} gap="md">
                  <TerminalInput
                    label="COMPANY/PRODUCT NAME"
                    placeholder="Enter company or product name..."
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    disabled={loadingThreads || loadingScript}
                  />

                  <TerminalInput
                    label="PRODUCT/COMPANY TYPE"
                    placeholder="Enter product or company type..."
                    value={companyType}
                    onChange={(e) => setCompanyType(e.target.value)}
                    disabled={loadingThreads || loadingScript}
                  />
                </DataGrid>

                <TerminalInput
                  label="PRODUCT SPECIFICATIONS (OPTIONAL)"
                  placeholder="Enter detailed product description..."
                  multiline
                  rows={3}
                  value={productDescription}
                  onChange={(e) => setProductDescription(e.target.value)}
                  disabled={loadingThreads || loadingScript}
                />

                <div className="space-y-4">
                  <DataGrid columns={2} gap="md">
                    <div>
                      <label className="block text-xs uppercase tracking-widest text-[var(--text-primary)] mb-2 font-mono">
                        {'>'} GENERATION QUALITY LEVEL
                      </label>
                      <select
                        value={scriptQuality}
                        onChange={(e) => setScriptQuality(e.target.value as 'nano' | 'mini' | 'high')}
                        disabled={loadingThreads || loadingScript}
                        className="w-full bg-black bg-opacity-60 border border-[var(--border-dim)] text-[var(--text-primary)] px-4 py-3 text-sm font-mono focus:border-[var(--border-primary)] focus:outline-none transition-all"
                      >
                        <option value="nano">[ FAST ] GPT-5 NANO</option>
                        <option value="mini">[ BALANCED ] GPT-5 MINI</option>
                        <option value="high">[ PREMIUM ] GPT-5</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs uppercase tracking-widest text-[var(--text-primary)] mb-2 font-mono">
                        {'>'} VIDEO DURATION
                      </label>
                      <select
                        value={scriptDuration}
                        onChange={(e) => setScriptDuration(e.target.value as '4' | '8' | '12')}
                        disabled={loadingThreads || loadingScript}
                        className="w-full bg-black bg-opacity-60 border border-[var(--border-dim)] text-[var(--text-primary)] px-4 py-3 text-sm font-mono focus:border-[var(--border-primary)] focus:outline-none transition-all"
                      >
                        <option value="4">[ SHORT ] 4 SECONDS</option>
                        <option value="8">[ MEDIUM ] 8 SECONDS</option>
                        <option value="12">[ LONG ] 12 SECONDS</option>
                      </select>
                    </div>
                  </DataGrid>

                  <div>
                    <label className="block text-xs uppercase tracking-widest text-[var(--text-primary)] mb-2 font-mono">
                      {'>'} VIDEO ORIENTATION
                    </label>
                    <select
                      value={orientation}
                      onChange={(e) => setOrientation(e.target.value as 'vertical' | 'horizontal')}
                      disabled={loadingThreads || loadingScript}
                      className="w-full bg-black bg-opacity-60 border border-[var(--border-dim)] text-[var(--text-primary)] px-4 py-3 text-sm font-mono focus:border-[var(--border-primary)] focus:outline-none transition-all"
                    >
                      <option value="horizontal">[ HORIZONTAL ] 1280x720</option>
                      <option value="vertical">[ VERTICAL ] 720x1280</option>
                    </select>
                  </div>
                </div>

                <TerminalInput
                  label="CUSTOM THREAD (OPTIONAL)"
                  placeholder="Enter custom narrative thread..."
                  multiline
                  rows={2}
                  value={customThread}
                  onChange={(e) => setCustomThread(e.target.value)}
                  disabled={loadingThreads || loadingScript}
                />

                {!customThread.trim() ? (
                  <CostEstimate 
                    credits={threadsCost} 
                    operation="Thread Generation" 
                  />
                ) : (
                  <CostEstimate 
                    credits={scriptCost} 
                    operation="Script Generation" 
                  />
                )}

                <div className="flex flex-col sm:flex-row gap-3">
                  {!customThread.trim() ? (
                    <GlowButton
                      onClick={generateThreads}
                      disabled={loadingThreads || !companyName.trim() || !companyType.trim()}
                      loading={loadingThreads}
                      className="flex-1"
                    >
                      {loadingThreads ? 'GENERATING...' : '[ GENERATE THREADS ]'}
                    </GlowButton>
                  ) : (
                    <GlowButton
                      onClick={handleCustomThreadSubmit}
                      disabled={loadingScript || !companyName.trim() || !companyType.trim()}
                      loading={loadingScript}
                      className="flex-1"
                    >
                      {loadingScript ? 'PROCESSING...' : '[ GENERATE SCRIPT ]'}
                    </GlowButton>
                  )}
                </div>

                {scriptError && (
                  <div className="border border-[var(--accent-red)] bg-[var(--accent-red)] bg-opacity-10 p-4">
                    <div className="flex items-start gap-3">
                      <span className="text-[#000] text-xl">⚠</span>
                      <div>
                        <div className="text-[#000] font-bold text-sm uppercase mb-1">ERROR</div>
                        <div className="text-[#000] text-xs">{scriptError}</div>
                      </div>
                    </div>
                  </div>
                )}

                {threads.length > 0 && !customThread && (
                  <div>
                    <h3 className="text-sm uppercase tracking-widest text-[var(--text-primary)] mb-4 font-mono">
                      {'>'} SELECT THREAD CONCEPT
                    </h3>
                    <DataGrid columns={2} gap="md">
                      {threads.map((thread) => (
                        <button
                          key={thread.id}
                          onClick={() => handleThreadSelect(thread)}
                          disabled={loadingScript}
                          className={`
                            p-4 border text-left transition-all
                            ${selectedThread?.id === thread.id
                              ? 'border-[var(--border-primary)] bg-[var(--text-primary)] bg-opacity-5 '
                              : 'border-[var(--border-dim)] hover:border-[var(--text-secondary)] '
                            }
                            disabled:opacity-30 disabled:cursor-not-allowed
                          `}
                        >
                          <h4 className={`font-bold text-sm mb-2 uppercase tracking-wide ${selectedThread?.id === thread.id ? 'text-[#000000]' : 'text-[var(--text-primary)]'}`}>
                            {thread.title}
                          </h4>
                          <p className="text-[var(--text-muted)] text-xs leading-relaxed">
                            {thread.description}
                          </p>
                        </button>
                      ))}
                    </DataGrid>
                    <CostEstimate 
                      credits={scriptCost} 
                      operation="Script Generation" 
                      className="mt-4"
                    />
                  </div>
                )}

                {loadingScript && (
                  <div className="border border-[var(--accent-cyan)] bg-[var(--accent-cyan)] bg-opacity-5 p-4">
                    <div className="flex items-center gap-3">
                      <div className="loading-bar w-full"></div>
                    </div>
                    <div className="text-[var(--accent-cyan)] text-xs uppercase mt-2 tracking-wider">
                      PROCESSING SCRIPT GENERATION...
                    </div>
                  </div>
                )}

                {generatedScript && (
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-sm uppercase tracking-widest text-[var(--text-primary)] font-mono">
                        {'>'} GENERATED SCRIPT OUTPUT
                      </h3>
                      <GlowButton
                        onClick={generateVideoFromScript}
                        variant="primary"
                      >
                        [ GENERATE VIDEO ]
                      </GlowButton>
                    </div>
                    <div className="border border-[var(--border-primary)] bg-black bg-opacity-60 p-6">
                      <pre className="whitespace-pre-wrap font-mono text-xs text-[var(--text-primary)] leading-relaxed">
                        {generatedScript}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </TerminalPanel>
          </motion.div>
        )}

        {activeTab === 'generate' && (
          <motion.div
            key="generate"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            <TerminalPanel title="VIDEO GENERATION INTERFACE" status="active">
              <div className="space-y-6">
                <div className="space-y-4">
                  <DataGrid columns={2} gap="md">
                    <div>
                      <label className="block text-xs uppercase tracking-widest text-[var(--text-primary)] mb-2 font-mono">
                        {'>'} VIDEO QUALITY MODEL
                      </label>
                      <select
                        value={videoQuality}
                        onChange={(e) => setVideoQuality(e.target.value as 'sora-2' | 'sora-2-pro')}
                        disabled={loading}
                        className="w-full bg-black bg-opacity-60 border border-[var(--border-dim)] text-[var(--text-primary)] px-4 py-3 text-sm font-mono focus:border-[var(--border-primary)] focus:outline-none transition-all"
                      >
                        <option value="sora-2">[ STANDARD ] SORA-2</option>
                        <option value="sora-2-pro">[ PREMIUM ] SORA-2-PRO</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs uppercase tracking-widest text-[var(--text-primary)] mb-2 font-mono">
                        {'>'} VIDEO DURATION
                      </label>
                      <select
                        value={videoDuration}
                        onChange={(e) => setVideoDuration(e.target.value as '4' | '8' | '12')}
                        disabled={loading}
                        className="w-full bg-black bg-opacity-60 border border-[var(--border-dim)] text-[var(--text-primary)] px-4 py-3 text-sm font-mono focus:border-[var(--border-primary)] focus:outline-none transition-all"
                      >
                        <option value="4">[ SHORT ] 4 SECONDS</option>
                        <option value="8">[ MEDIUM ] 8 SECONDS</option>
                        <option value="12">[ LONG ] 12 SECONDS</option>
                      </select>
                    </div>
                  </DataGrid>

                  <div>
                    <label className="block text-xs uppercase tracking-widest text-[var(--text-primary)] mb-2 font-mono">
                      {'>'} VIDEO ORIENTATION
                    </label>
                    <select
                      value={videoOrientation}
                      onChange={(e) => setVideoOrientation(e.target.value as 'vertical' | 'horizontal')}
                      disabled={loading}
                      className="w-full bg-black bg-opacity-60 border border-[var(--border-dim)] text-[var(--text-primary)] px-4 py-3 text-sm font-mono focus:border-[var(--border-primary)] focus:outline-none transition-all"
                    >
                      <option value="horizontal">[ HORIZONTAL ] Landscape</option>
                      <option value="vertical">[ VERTICAL ] Portrait</option>
                    </select>
                  </div>
                </div>

                {videoQuality === 'sora-2-pro' && (
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-[var(--text-primary)] mb-2 font-mono">
                      {'>'} VIDEO RESOLUTION (PRO ONLY)
                    </label>
                    <select
                      value={videoResolution}
                      onChange={(e) => setVideoResolution(e.target.value as 'standard' | 'high')}
                      disabled={loading}
                      className="w-full bg-black bg-opacity-60 border border-[var(--border-dim)] text-[var(--text-primary)] px-4 py-3 text-sm font-mono focus:border-[var(--border-primary)] focus:outline-none transition-all"
                    >
                      <option value="standard">[ STANDARD ] {videoOrientation === 'vertical' ? '720x1280' : '1280x720'}</option>
                      <option value="high">[ HIGH ] {videoOrientation === 'vertical' ? '1024x1792' : '1792x1024'}</option>
                    </select>
                  </div>
                )}

                <TerminalInput
                  label="VIDEO GENERATION PROMPT"
                  labelRight={
                    <button
                      onClick={async () => {
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
                      }}
                      disabled={enhancingPrompt || !prompt.trim() || loading}
                      className="text-[10px] uppercase tracking-wider px-2 py-1 border border-[var(--border-dim)] text-[var(--text-muted)] hover:border-[var(--accent-cyan)] hover:text-[var(--accent-cyan)] transition-colors flex items-center gap-2"
                      title="Enhance your prompt using best-practice structure"
                    >
                      <span>{enhancingPrompt ? '[ ENHANCING ... ]' : '[ ENHANCE PROMPT ]'}</span>
                      <span className="text-[9px] opacity-80 tracking-[0.1px]"> {formatCredits(enhancePromptCredits)} CR</span>
                    </button>
                  }
                  placeholder="Enter detailed video description..."
                  multiline
                  rows={4}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={loading}
                />

                <CostEstimate 
                  credits={videoCost} 
                  operation="Video Generation" 
                />

                <GlowButton
                  onClick={generateVideo}
                  disabled={loading || !prompt.trim()}
                  loading={loading}
                  className="w-full"
                >
                  {loading ? `GENERATING... ${generationProgress}%` : '[ INITIATE VIDEO GENERATION ]'}
                </GlowButton>

                {loading && generatedVideoId && (
                  <div className="border border-[var(--border-primary)] bg-[var(--text-primary)] bg-opacity-5 p-6">
                    <div className="flex items-center justify-between mb-2">
                      <StatusBadge status={generationStatus as any} />
                      <span className="text-[#000000] font-mono text-sm">
                        {generationProgress}%
                      </span>
                    </div>
                    <ProgressBar progress={generationProgress} label="GENERATION PROGRESS" showPercentage={false} />
                    <div className="mt-3 flex items-center justify-between">
                      <div className="text-[12px] text-[#222222] font-mono">
                        VIDEO ID: {generatedVideoId}
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(generatedVideoId);
                        }}
                        className="border border-[var(--border-dim)] text-[var(--text-muted)] px-3 py-1 text-[10px] uppercase tracking-wider hover:border-[var(--accent-cyan)] hover:text-[var(--accent-cyan)] transition-all"
                        title="Copy Video ID"
                      >
                        [ COPY ]
                      </button>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="border border-[var(--accent-red)] bg-[var(--accent-red)] bg-opacity-10 p-4">
                    <div className="flex items-start gap-3">
                      <span className="text-[#000] text-xl">⚠</span>
                      <div>
                        <div className="text-[#000] font-bold text-sm uppercase mb-1">CRITICAL ERROR</div>
                        <div className="text-[#000] text-xs">{error}</div>
                      </div>
                    </div>
                  </div>
                )}

                {videoUrl && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <h3 className="text-sm uppercase tracking-widest text-[var(--text-primary)] mb-4 font-mono">
                      {'>'} GENERATED OUTPUT
                    </h3>
                    <div className="border border-[var(--border-primary)] p-2 bg-black">
                      <video
                        src={videoUrl}
                        controls
                        className="w-full"
                        autoPlay
                      />
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 mt-4">
                      <a
                        href={videoUrl}
                        download
                        className="flex-1 text-center border border-[var(--border-primary)] text-[var(--text-primary)] px-4 sm:px-6 py-3 text-sm uppercase tracking-wider hover:bg-[var(--accent-cyan)] hover:bg-opacity-10 hover:border-[var(--accent-cyan)] hover:text-[#000000] transition-all"
                      >
                        [ DOWNLOAD ]
                      </a>
                      {currentVideoModel && currentVideoModel.startsWith('sora-2') && (
                        <button
                          onClick={() => {
                            setShowRemixUI(!showRemixUI);
                            if (!showRemixUI) {
                              setRemixPrompt('');
                            }
                          }}
                          className="flex-1 border border-[var(--accent-cyan)] text-[var(--accent-cyan)] px-4 sm:px-6 py-3 text-sm uppercase tracking-wider hover:bg-[var(--accent-cyan)] hover:text-[#000000] hover:bg-opacity-10 transition-all"
                        >
                          [ REMIX VIDEO ]
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setVideoUrl(null);
                          setPrompt('');
                          setShowRemixUI(false);
                          setRemixPrompt('');
                          setCurrentVideoModel(null);
                          setCurrentVideoSeconds('12');
                          setCurrentVideoSize('1280x720');
                        }}
                        className="flex-1 border border-[var(--border-dim)] text-[var(--text-muted)] px-4 sm:px-6 py-3 text-sm uppercase tracking-wider hover:border-[var(--text-primary)] hover:text-[var(--text-primary)] transition-all"
                      >
                        [ NEW GENERATION ]
                      </button>
                    </div>

                    {/* Remix UI */}
                    {showRemixUI && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-6 border border-[#444c53] bg-[#0a131a] bg-opacity-5 p-4"
                      >
                        <h4 className="text-sm uppercase tracking-widest text-[#ffffff] mb-3 font-mono">
                          {'>'} REMIX VIDEO
                        </h4>
                        <p className="text-xs text-[var(--text-muted)] mb-4">
                          Describe a single, focused change to make to the video (e.g., "Shift the color palette to warm tones", "Change time from day to night", "Add falling snow").
                        </p>
                        <TerminalInput
                          label="REMIX PROMPT"
                          placeholder="Describe the change you want to make..."
                          multiline
                          rows={3}
                          value={remixPrompt}
                          onChange={(e) => setRemixPrompt(e.target.value)}
                          disabled={remixing}
                        />
                        <CostEstimate 
                          credits={remixCost} 
                          operation="Video Remix" 
                          className="mt-3"
                        />
                        <div className="flex gap-3 mt-4">
                          <GlowButton
                            onClick={remixVideo}
                            disabled={remixing || !remixPrompt.trim()}
                            loading={remixing}
                            className="flex-1"
                          >
                            {remixing ? 'REMIXING...' : '[ START REMIX ]'}
                          </GlowButton>
                          <button
                            onClick={() => {
                              setShowRemixUI(false);
                              setRemixPrompt('');
                            }}
                            className="flex-1 border border-[var(--border-dim)] text-[var(--text-muted)] px-4 py-3 text-sm uppercase tracking-wider hover:border-[var(--text-primary)] hover:text-[var(--text-primary)] transition-all"
                            disabled={remixing}
                          >
                            [ CANCEL ]
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </div>
            </TerminalPanel>

            <TerminalPanel title="STATUS CHECK MODULE" status="active" corners={true}>
              <div className="space-y-4">
                <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide">
                  Enter video ID to retrieve generation status
                </p>

                <TerminalInput
                  label="VIDEO IDENTIFICATION CODE"
                  placeholder="vid_xxxxxxxx..."
                  value={videoId}
                  onChange={(e) => setVideoId(e.target.value)}
                  disabled={checkingStatus || autoPolling}
                />

                <div className="flex flex-col sm:flex-row gap-3">
                  <GlowButton
                    onClick={checkVideoStatus}
                    disabled={checkingStatus || autoPolling || !videoId.trim()}
                    loading={checkingStatus}
                    className="flex-1"
                  >
                    {checkingStatus ? 'CHECKING...' : '[ CHECK STATUS ]'}
                  </GlowButton>

                  {videoStatus && (videoStatus.status === 'in_progress' || videoStatus.status === 'queued') && (
                    <GlowButton
                      onClick={autoPolling ? stopPolling : startPolling}
                      variant={autoPolling ? 'danger' : 'primary'}
                      className="flex-1"
                    >
                      {autoPolling ? '[ STOP POLLING ]' : '[ AUTO-POLL ]'}
                    </GlowButton>
                  )}
                </div>

                {statusError && (
                  <div className="border border-[var(--accent-red)] bg-[var(--accent-red)] bg-opacity-10 p-4">
                    <div className="text-[#000000] text-xs">{statusError}</div>
                  </div>
                )}

                {videoStatus && (
                <div className="border border-[var(--border-dim)] bg-black bg-opacity-60 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[var(--text-muted)] uppercase">Status:</span>
                      <StatusBadge status={videoStatus.status} showDot={true} />
                    </div>
                    {videoStatus.progress !== undefined && (
                      <ProgressBar progress={videoStatus.progress} label="Progress" />
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-[var(--text-muted)]">ID:</span>
                        <span className="text-[var(--text-primary)] ml-2 font-mono break-all">{videoStatus.video_id}</span>
                      </div>
                      {videoStatus.model && (
                        <div>
                          <span className="text-[var(--text-muted)]">Model:</span>
                          <span className="text-[var(--text-primary)] ml-2">{videoStatus.model}</span>
                        </div>
                      )}
                      {videoStatus.seconds && (
                        <div>
                          <span className="text-[var(--text-muted)]">Duration:</span>
                          <span className="text-[var(--text-primary)] ml-2">{videoStatus.seconds}s</span>
                        </div>
                      )}
                      {videoStatus.size && (
                        <div>
                          <span className="text-[var(--text-muted)]">Size:</span>
                          <span className="text-[var(--text-primary)] ml-2">{videoStatus.size}</span>
                        </div>
                      )}
                    </div>
                    {videoStatus.error && (
                      <div className="border border-[var(--accent-red)] bg-[var(--accent-red)] bg-opacity-10 p-3 text-xs">
                        <div className="text-[var(--accent-red)] font-bold">{videoStatus.error.code}</div>
                        <div className="text-[var(--accent-red)]">{videoStatus.error.message}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </TerminalPanel>
          </motion.div>
        )}

        {activeTab === 'lipsync' && (
          <motion.div
            key="lipsync"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            <TerminalPanel title="LIP SYNC GENERATION MODULE" status="active">
              <div className="space-y-6">
                {/* Model Selection */}
                <div>
                  <label className="block text-xs uppercase tracking-widest text-[var(--text-primary)] mb-2 font-mono">
                    {'>'} LIP SYNC MODEL
                  </label>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                    <button
                      type="button"
                      onClick={() => setIsModelModalOpen(true)}
                      disabled={loadingLipSync || loadingTTS}
                      className="w-full bg-black bg-opacity-60 border border-[var(--border-dim)] text-[var(--text-primary)] px-4 py-3 text-sm font-mono focus:border-[var(--border-primary)] focus:outline-none transition-all text-left"
                    >
                    <div className="flex items-center justify-between gap-3">
                        <span className="flex-1 truncate">{lipSyncModelLabels[lipSyncModel] || lipSyncModel}</span>
                        <span
                          className="text-[10px] px-2 py-1 rounded uppercase tracking-wide"
                          style={statusStyles[(modelStatuses[lipSyncModel] || 'unknown') as ModelStatus]}
                        >
                          {statusLabels[(modelStatuses[lipSyncModel] || 'unknown') as ModelStatus]}
                        </span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => fetchLipSyncModelStatuses()}
                      disabled={loadingLipSync || loadingTTS}
                      className="inline-flex items-center justify-center border border-[var(--border-dim)] px-3 py-2 text-xs uppercase tracking-wider text-[var(--text-muted)] hover:border-[var(--accent-cyan)] hover:text-[var(--accent-cyan)] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      title="Refresh model statuses"
                    >
                      Refresh
                    </button>
                  </div>
                </div>

                {/* Prompt for WAN-Video model */}
                {lipSyncModel === 'wan-video/wan-2.2-s2v' && (
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-[var(--text-primary)] mb-2 font-mono">
                      {'>'} VIDEO PROMPT (RECOMMENDED)
                    </label>
                    <input
                      type="text"
                      placeholder="Default: person talking (try: woman singing, man speaking...)"
                      value={lipSyncPrompt}
                      onChange={(e) => setLipSyncPrompt(e.target.value)}
                      disabled={loadingLipSync || loadingTTS}
                      className="w-full bg-black bg-opacity-60 border border-[var(--border-dim)] text-[var(--text-primary)] px-4 py-3 text-sm font-mono focus:border-[var(--border-primary)] focus:outline-none transition-all placeholder:text-[var(--text-muted)]"
                    />
                    <p className="text-xs text-[var(--text-muted)] mt-2">
                      💡 Describe the action for better results: "woman singing", "man talking", "person speaking", etc.
                    </p>
                  </div>
                )}

                {/* Image Source Selection */}
                <div className="border border-[var(--border-dim)] p-4 sm:p-6 bg-[#20192e]">
                  <label className="block text-xs uppercase tracking-widest text-[var(--text-primary)] mb-4 font-mono">
                    {'>'} IMAGE SOURCE
                  </label>
                  
                  {/* Selection Boxes */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <button
                      onClick={() => {
                        setImageSource('upload');
                        setAvatarError(null);
                      }}
                      disabled={loadingLipSync || loadingTTS || generatingAvatar}
                      className={`p-6 border-2 transition-all ${
                        imageSource === 'upload'
                          ? 'border-[var(--border-primary)] bg-[#0a2029]'
                          : 'border-[var(--border-dim)] bg-black bg-opacity-40 hover:border-[var(--text-muted)]'
                      }`}
                    >
                      <div className="text-center">
                        <div className="text-2xl mb-2">📤</div>
                        <div className="text-sm font-mono uppercase tracking-wide text-[var(--text-primary)]">
                          Upload Image
                        </div>
                        <div className="text-xs text-[var(--text-muted)] mt-1">
                          Use your own photo
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setImageSource('ai');
                        setLipSyncError(null);
                      }}
                      disabled={loadingLipSync || loadingTTS || generatingAvatar}
                      className={`p-6 border-2 transition-all ${
                        imageSource === 'ai'
                          ? 'border-[var(--border-primary)] bg-[#0a2029]'
                          : 'border-[var(--border-dim)] bg-black bg-opacity-40 hover:border-[var(--text-muted)]'
                      }`}
                    >
                      <div className="text-center">
                        <div className="text-2xl mb-2">🤖</div>
                        <div className="text-sm font-mono uppercase tracking-wide text-[var(--text-primary)]">
                          AI Avatar
                        </div>
                        <div className="text-xs text-[var(--text-muted)] mt-1">
                          Generate with AI
                        </div>
                      </div>
                    </button>
                  </div>

                  {/* Upload Image Flow */}
                  {imageSource === 'upload' && (
                    <div className="space-y-4">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageFileChange}
                        disabled={loadingLipSync || loadingTTS || generatingAvatar}
                        className="w-full bg-black bg-opacity-60 border border-[var(--border-dim)] text-[var(--text-primary)] px-4 py-3 text-sm font-mono focus:border-[var(--border-primary)] focus:outline-none transition-all file:mr-4 file:py-2 file:px-4 file:border-0 file:text-sm file:font-mono file:bg-[var(--text-primary)] file:text-black hover:file:opacity-80"
                      />
                      <p className="text-xs text-[var(--text-muted)]">
                        💡 Best results: Front-facing portrait with clear facial features
                      </p>
                    </div>
                  )}

                  {/* AI Avatar Flow */}
                  {imageSource === 'ai' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs uppercase tracking-widest text-[var(--text-primary)] mb-2 font-mono">
                          AVATAR TYPE
                        </label>
                        <div className="grid grid-cols-2 gap-3 mb-4">
                          <button
                            onClick={() => setAvatarType('face')}
                            disabled={loadingLipSync || loadingTTS || generatingAvatar}
                            className={`p-3 border-2 transition-all ${
                              avatarType === 'face'
                                ? 'border-[var(--border-primary)] bg-[#0a2029] text-[var(--text-primary)]'
                                : 'border-[var(--border-dim)] bg-black bg-opacity-40 hover:border-[var(--text-muted)] text-[var(--text-muted)]'
                            }`}
                          >
                            <div className="text-center">
                              <div className="text-xl mb-1">👤</div>
                              <div className="text-xs font-mono uppercase tracking-wide">
                                Just Face
                              </div>
                            </div>
                          </button>
                          <button
                            onClick={() => setAvatarType('full-body')}
                            disabled={loadingLipSync || loadingTTS || generatingAvatar}
                            className={`p-3 border-2 transition-all ${
                              avatarType === 'full-body'
                                ? 'border-[var(--border-primary)] bg-[#0a2029] text-[var(--text-primary)]'
                                : 'border-[var(--border-dim)] bg-black bg-opacity-40 hover:border-[var(--text-muted)] text-[var(--text-muted)]'
                            }`}
                          >
                            <div className="text-center">
                              <div className="text-xl mb-1">🧍</div>
                              <div className="text-xs font-mono uppercase tracking-wide">
                                Full Body
                              </div>
                            </div>
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs uppercase tracking-widest text-[var(--text-primary)] mb-2 font-mono">
                          DESCRIBE YOUR AVATAR
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder={avatarType === 'face' 
                              ? "e.g., young woman with brown hair, professional businessman, elderly man with beard..." 
                              : "e.g., athletic woman in yoga outfit, businessman in suit standing confidently, dancer in motion..."}
                            value={avatarPrompt}
                            onChange={(e) => setAvatarPrompt(e.target.value)}
                            disabled={loadingLipSync || loadingTTS || generatingAvatar || enhancingAvatarPrompt}
                            className="flex-1 bg-black bg-opacity-60 border border-[var(--border-dim)] text-[var(--text-primary)] px-4 py-3 text-sm font-mono focus:border-[var(--border-primary)] focus:outline-none transition-all placeholder:text-[var(--text-muted)]"
                          />
                          <button
                            onClick={enhanceAvatarPrompt}
                            disabled={enhancingAvatarPrompt || !avatarPrompt.trim() || generatingAvatar || loadingLipSync || loadingTTS}
                            className="text-[10px] uppercase tracking-wider px-3 py-3 border border-[var(--border-dim)] text-[var(--text-muted)] hover:border-[var(--accent-cyan)] hover:text-[var(--accent-cyan)] transition-colors flex items-center gap-1 min-w-[120px] justify-center disabled:opacity-50"
                            title="Enhance your prompt for better avatar results"
                          >
                            <span>{enhancingAvatarPrompt ? 'ENHANCING...' : 'ENHANCE'}</span>
                            <span className="text-[8px]">~0.001 CR</span>
                          </button>
                        </div>
                        {avatarEnhanceError && (
                          <p className="text-xs text-red-400 mt-1 ml-1">{avatarEnhanceError}</p>
                        )}
                        <p className="text-xs text-[var(--text-muted)] mt-2 ml-1">
                          💡 Be descriptive: {avatarType === 'face' 
                            ? 'age, gender, hair style, facial features, ethnicity, etc.' 
                            : 'age, gender, clothing, pose, body type, setting, etc.'}
                        </p>
                      </div>

                      <CostEstimate 
                        credits={avatarCost} 
                        operation="Avatar Generation" 
                      />

                      <GlowButton
                        onClick={generateAvatar}
                        disabled={generatingAvatar || loadingLipSync || loadingTTS}
                        loading={generatingAvatar}
                        className="w-full"
                      >
                        {generatingAvatar ? (generatedAvatarUrl ? 'REGENERATING...' : 'GENERATING AVATAR...') : 'GENERATE AVATAR'}
                      </GlowButton>

                      {avatarError && (
                        <div className="p-3 bg-red-500 bg-opacity-10 border border-red-500 text-red-400 text-xs font-mono">
                          {avatarError}
                        </div>
                      )}

                      {generatedAvatarUrl && (
                        <div className="space-y-4 mt-4">
                          {/* Generated Avatar Image */}
                          <div className="relative bg-black bg-opacity-20 border border-[var(--border-dim)] rounded-lg overflow-hidden">
                            <img 
                              src={generatedAvatarUrl} 
                              alt="Generated Avatar" 
                              className="w-full max-w-md mx-auto block aspect-square object-cover"
                              onLoad={() => console.log('Avatar image loaded')}
                            />
                            {/* Clear button overlay in corner */}
                            <button
                              onClick={clearAvatar}
                              className="absolute top-2 right-2 p-2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full text-xs transition-all"
                              title="Clear generated avatar"
                            >
                              ×
                            </button>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex flex-col sm:flex-row gap-3">
                            {/* Download Button */}
                            <a
                              href={generatedAvatarUrl}
                              download="scenyx-avatar.png"
                              className="flex-1 flex items-center justify-center text-center py-3 px-4 bg-[var(--accent-cyan)] text-black font-bold hover:bg-opacity-90 transition-colors text-sm uppercase tracking-wide"
                            >
                              DOWNLOAD AVATAR
                            </a>

                            {/* Regenerate Button */}
                            <GlowButton
                              onClick={generateAvatar}
                              disabled={generatingAvatar || loadingLipSync || loadingTTS}
                              loading={generatingAvatar}
                              className="flex-1"
                            >
                              {generatingAvatar ? 'REGENERATING...' : 'REGENERATE'}
                              <span className="text-xs opacity-70 ml-1"> ~{formatCredits(avatarCost)} CR</span>
                            </GlowButton>
                          </div>

                          {/* Cost Note for Regenerate */}
                          <p className="text-xs text-[var(--text-muted)] text-center">
                            Regenerate creates a new avatar from your current prompt (same cost as initial generation)
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Image Preview (shown for both flows) */}
                  {lipSyncImagePreview && (
                    <div className="mt-4 border border-[var(--border-dim)] p-2 bg-black">
                      <img src={lipSyncImagePreview} alt="Preview" className="w-full max-h-64 object-contain" />
                      <button
                        onClick={() => {
                          setLipSyncImagePreview(null);
                          setLipSyncImageFile(null);
                        }}
                        disabled={loadingLipSync || loadingTTS || generatingAvatar}
                        className="w-full mt-2 px-4 py-2 bg-red-500 bg-opacity-20 border border-red-500 text-red-400 text-xs font-mono hover:bg-opacity-30 transition-all"
                      >
                        CLEAR IMAGE
                      </button>
                    </div>
                  )}
                </div>

                {/* Audio Source Selection */}
                <div className="border border-[var(--border-dim)] p-4 sm:p-6 bg-[#3c324d]">
                  <label className="block text-xs uppercase tracking-widest text-[var(--text-primary)] mb-4 font-mono">
                    {'>'} AUDIO SOURCE
                  </label>
                  
                  {/* Selection Boxes */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <button
                      onClick={() => {
                        setAudioSource('tts');
                        setLipSyncError(null);
                      }}
                      disabled={loadingLipSync || loadingTTS}
                      className={`p-6 border-2 transition-all ${
                        audioSource === 'tts'
                          ? 'border-[var(--border-primary)] bg-[#0a2029]'
                          : 'border-[var(--border-dim)] bg-black bg-opacity-40 hover:border-[var(--text-muted)]'
                      }`}
                    >
                      <div className="text-center">
                        <div className="text-2xl mb-2">🎙️</div>
                        <div className="text-sm font-mono uppercase tracking-wide text-[var(--text-primary)]">
                          Generate from Script
                        </div>
                        <div className="text-xs text-[var(--text-muted)] mt-1">
                          AI Text-to-Speech
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setAudioSource('upload');
                        setLipSyncError(null);
                      }}
                      disabled={loadingLipSync || loadingTTS}
                      className={`p-6 border-2 transition-all ${
                        audioSource === 'upload'
                          ? 'border-[var(--border-primary)] bg-[#0a2029]'
                          : 'border-[var(--border-dim)] bg-black bg-opacity-40 hover:border-[var(--text-muted)]'
                      }`}
                    >
                      <div className="text-center">
                        <div className="text-2xl mb-2">📁</div>
                        <div className="text-sm font-mono uppercase tracking-wide text-[var(--text-primary)]">
                          Upload Audio File
                        </div>
                        <div className="text-xs text-[var(--text-muted)] mt-1">
                          MP3, WAV, etc.
                        </div>
                      </div>
                    </button>
                  </div>

                  {/* TTS Flow */}
                  {audioSource === 'tts' && (
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-xs uppercase tracking-widest text-[var(--text-primary)] font-mono">
                            SCRIPT TEXT
                          </label>
                          <button
                            onClick={generateVoiceoverScript}
                            disabled={generatingVoiceoverScript || !lipSyncScript.trim() || loadingLipSync || loadingTTS}
                            className="text-[10px] uppercase tracking-wider px-3 py-2 border border-[#716f6f] text-[#ccc] hover:border-[var(--accent-cyan)] hover:text-[var(--accent-cyan)] transition-colors flex items-center gap-1 disabled:opacity-50"
                            title="Generate a professional voiceover script from your idea"
                          >
                            <span>{generatingVoiceoverScript ? 'GENERATING...' : 'GENERATE SCRIPT'}</span>
                            <span className="text-[8px]">{formatCredits(voiceoverScriptCost)} CR</span>
                          </button>
                        </div>
                        <textarea
                          placeholder="Enter your script here, or add a rough idea and click 'Generate Script'..."
                          value={lipSyncScript}
                          onChange={(e) => setLipSyncScript(e.target.value)}
                          disabled={loadingLipSync || loadingTTS || generatingVoiceoverScript}
                          rows={4}
                          className="w-full bg-black bg-opacity-60 border border-[var(--border-dim)] text-[var(--text-primary)] px-4 py-3 text-sm font-mono focus:border-[var(--border-primary)] focus:outline-none transition-all placeholder:text-[var(--text-muted)] resize-none"
                        />
                        {voiceoverScriptError && (
                          <p className="text-xs text-red-400 mt-1">{voiceoverScriptError}</p>
                        )}
                        <p className="text-xs text-[#989898] mt-2">
                          Tip: Add a rough idea and click "Generate Script" for a professional voiceover, or write your own script directly.
                        </p>
                      </div>
                      
                      <div>
                        <label className="block text-xs uppercase tracking-widest text-[var(--text-primary)] mb-2 font-mono">
                          {'>'} VOICE SELECTION
                        </label>
                        <select
                          value={lipSyncVoice}
                          onChange={(e) => setLipSyncVoice(e.target.value as any)}
                          disabled={loadingLipSync || loadingTTS}
                          className="w-full bg-black bg-opacity-60 border border-[var(--border-dim)] text-[var(--text-primary)] px-4 py-3 text-sm font-mono focus:border-[var(--border-primary)] focus:outline-none transition-all"
                        >
                          <option value="alloy">[ ALLOY ] Neutral</option>
                          <option value="echo">[ ECHO ] Male</option>
                          <option value="fable">[ FABLE ] British Male</option>
                          <option value="onyx">[ ONYX ] Deep Male</option>
                          <option value="nova">[ NOVA ] Female (Default)</option>
                          <option value="shimmer">[ SHIMMER ] Soft Female</option>
                        </select>
                      </div>

                      <CostEstimate 
                        credits={ttsCost} 
                        operation="Text-to-Speech" 
                      />

                      <GlowButton
                        onClick={generateTTS}
                        disabled={loadingTTS || !lipSyncScript.trim() || loadingLipSync}
                        loading={loadingTTS}
                        className="w-full"
                      >
                        {loadingTTS ? 'GENERATING AUDIO...' : '[ GENERATE VOICEOVER ]'}
                      </GlowButton>
                    </div>
                  )}

                  {/* Upload Flow */}
                  {audioSource === 'upload' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs uppercase tracking-widest text-[var(--text-primary)] mb-2 font-mono">
                          UPLOAD AUDIO FILE
                        </label>
                        <input
                          type="file"
                          accept="audio/*"
                          onChange={handleAudioFileChange}
                          disabled={loadingLipSync || loadingTTS}
                          className="w-full bg-black bg-opacity-60 border border-[var(--border-dim)] text-[var(--text-primary)] px-4 py-3 text-sm font-mono focus:border-[var(--border-primary)] focus:outline-none transition-all file:mr-4 file:py-2 file:px-4 file:border-0 file:text-sm file:font-mono file:bg-[var(--text-primary)] file:text-black hover:file:opacity-80"
                        />
                        <p className="text-xs text-[#989898] mt-2">
                           Supported formats: MP3, WAV, M4A, FLAC
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Audio Preview */}
                  {lipSyncAudioUrl && (
                    <div className="mt-4 border border-[var(--border-primary)] p-4 bg-black">
                      <div className="flex justify-between items-center mb-2">
                        <div className="text-xs uppercase tracking-wide text-[var(--text-primary)]">
                          AUDIO PREVIEW:
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-xs text-[var(--accent-cyan)] font-mono">
                            DURATION: {audioDuration}s
                          </div>
                          <a
                            href={lipSyncAudioUrl}
                            download="scenyx-voiceover.mp3"
                            className="text-xs uppercase tracking-wider px-3 py-1 bg-[var(--accent-cyan)] text-black font-bold hover:bg-opacity-80 transition-colors"
                            title="Download audio file"
                          >
                            DOWNLOAD
                          </a>
                        </div>
                      </div>
                      <audio 
                        ref={audioRef}
                        src={lipSyncAudioUrl} 
                        controls 
                        className="w-full"
                        onLoadedMetadata={handleAudioLoaded}
                      />
                    </div>
                  )}
                </div>

                {/* Generate Lip Sync Button */}
                <div className="border border-[var(--border-dim)] p-4 bg-black bg-opacity-40">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <span className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
                      ESTIMATED COST:
                    </span>
                    <span className="text-sm font-bold text-[var(--accent-cyan)] font-mono">
                      {lipSyncCost.toFixed(3)} CREDITS
                    </span>
                  </div>
                </div>

                <GlowButton
                  onClick={generateLipSync}
                  disabled={loadingLipSync || (!lipSyncImagePreview && !generatedAvatarUrl) || !lipSyncAudioUrl}
                  loading={loadingLipSync}
                  className="w-full"
                >
                  {loadingLipSync ? `GENERATING... ${lipSyncProgress}%` : '[ GENERATE LIP SYNC VIDEO ]'}
                </GlowButton>

                {/* Generation Time Notice */}
                <div className="mt-3 p-3 bg-yellow-500 bg-opacity-10 border border-yellow-500 border-opacity-30 rounded">
                  <p className="text-xs text-yellow-200 text-center">
                    ⏱️ Generation time: 5-10 minutes depending on audio length. Please be patient.
                  </p>
                </div>

                {/* Progress Display */}
                {loadingLipSync && lipSyncPredictionId && (
                  <div className="border border-[var(--border-primary)] bg-[var(--text-primary)] bg-opacity-5 p-6">
                    <div className="flex items-center justify-between mb-2">
                      <StatusBadge status="in_progress" />
                      <span className="text-[#000000] font-mono text-sm">
                        {lipSyncProgress}%
                      </span>
                    </div>
                    <ProgressBar progress={lipSyncProgress} label="LIP SYNC PROGRESS" showPercentage={false} />
                    <div className="mt-3 text-[12px] text-[#222222] font-mono">
                      PREDICTION ID: {lipSyncPredictionId}
                    </div>
                  </div>
                )}

                {/* Error Display */}
                {lipSyncError && (
                  <div className="border border-[var(--accent-red)] bg-[var(--accent-red)] bg-opacity-10 p-4">
                    <div className="flex items-start gap-3">
                      <span className="text-[#000] text-xl">⚠</span>
                      <div>
                        <div className="text-[#000] font-bold text-sm uppercase mb-1">ERROR</div>
                        <div className="text-[#000] text-xs">{lipSyncError}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Result Display */}
                {lipSyncResult && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <h3 className="text-sm uppercase tracking-widest text-[var(--text-primary)] mb-4 font-mono">
                      {'>'} GENERATED LIP SYNC VIDEO
                    </h3>
                    <div className="border border-[var(--border-primary)] p-2 bg-black">
                      <video
                        src={lipSyncResult}
                        controls
                        className="w-full"
                        autoPlay
                      />
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 mt-4">
                      <a
                        href={lipSyncResult}
                        download="lipsync-video.mp4"
                        className="flex-1 text-center border border-[var(--border-primary)] text-[var(--text-primary)] px-4 sm:px-6 py-3 text-sm uppercase tracking-wider hover:bg-[var(--accent-cyan)] hover:bg-opacity-10 hover:border-[var(--accent-cyan)] hover:text-[#000000] transition-all"
                      >
                        [ DOWNLOAD ]
                      </a>
                      <button
                        onClick={() => {
                          setLipSyncResult(null);
                          setLipSyncProgress(0);
                        }}
                        className="flex-1 border border-[var(--border-dim)] text-[var(--text-muted)] px-4 sm:px-6 py-3 text-sm uppercase tracking-wider hover:border-[var(--text-primary)] hover:text-[var(--text-primary)] transition-all"
                      >
                        [ NEW GENERATION ]
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            </TerminalPanel>
          </motion.div>
        )}

        {isModelModalOpen && (
          <div
            className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70 px-4"
            onClick={() => setIsModelModalOpen(false)}
          >
            <div
              className="w-full max-w-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-5"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm uppercase tracking-widest text-[var(--text-primary)] font-mono">
                  {'>'} Select Lip Sync Model
                </h3>
                <button
                  type="button"
                  onClick={() => setIsModelModalOpen(false)}
                  className="text-xs uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--accent-cyan)]"
                >
                  Close
                </button>
              </div>
              <div className="space-y-3">
                {supportedLipSyncModels.map((modelSlug) => {
                  const status = (modelStatuses[modelSlug] || 'unknown') as ModelStatus;
                  const offline = status === 'offline';
                  const statusStyle = statusStyles[status];
                  return (
                    <button
                      key={modelSlug}
                      type="button"
                      onClick={() => {
                        if (offline) {
                          setLipSyncError('This model is idle right now and might not be booted up. Could result in loss of funds and major delay.');
                          return;
                        }
                        setLipSyncModel(modelSlug);
                        setIsModelModalOpen(false);
                      }}
                      disabled={offline}
                      className={`w-full border px-4 py-3 text-left transition-all ${
                        offline
                          ? 'border-[var(--border-dim)] opacity-60 cursor-not-allowed'
                          : 'border-[var(--border-dim)] hover:border-[var(--border-primary)]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-mono uppercase text-[var(--text-primary)] truncate">
                            {lipSyncModelLabels[modelSlug] || modelSlug}
                          </p>
                          {offline && (
                            <p className="text-xs text-[var(--text-muted)] mt-1">
                              This model is idle right now and might not be booted up. Could result in loss of funds and major delay.
                            </p>
                          )}
                        </div>
                        <span
                          className="text-[10px] px-2 py-1 rounded uppercase tracking-wide"
                          style={statusStyle}
                        >
                          {statusLabels[status]}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'view' && (
          <motion.div
            key="view"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
            <TerminalPanel title="RECENT GENERATIONS" status="active">
              <div className="space-y-4">
                <div className="border border-[var(--border-dim)] bg-black bg-opacity-60 p-3 text-xs text-[var(--text-muted)]">
                  Lip sync videos are only available for ~1 hour, all other videos for ~24 hours. Download them before they expire.
                </div>
                {loadingArchive ? (
                  <div className="text-center py-12">
                    <div className="loading-bar w-64 mx-auto"></div>
                    <p className="mt-4 text-[var(--text-muted)] text-sm uppercase tracking-wide">
                      LOADING RECENT GENERATIONS...
                    </p>
                  </div>
                ) : archiveItems.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-6xl text-[var(--text-muted)] mb-4">⊗</div>
                    <h3 className="text-lg uppercase text-[var(--text-primary)] mb-2 tracking-wider">
                      NO RECENT GENERATIONS
                    </h3>
                    <p className="text-[var(--text-muted)] text-sm">
                      Generate something to see it here.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {archiveItems.map((item) => {
                      const preview = previews[item.video_id] || {};
                      const nowMs = Date.now();
                      const expMs = Date.parse(item.expiresAt);
                      const isExpired = expMs <= nowMs;
                      const timeLeftH = Math.max(0, Math.floor((expMs - nowMs) / 3600_000));
                      return (
                        <div key={item.video_id} className={`border ${isExpired ? 'border-[var(--border-dim)] opacity-70' : 'border-[var(--border-dim)] hover:border-[var(--border-primary)]'} bg-black bg-opacity-60 p-4 transition-all`}>
                      <div className="flex items-start justify-between mb-2">
                        <StatusBadge status={(archiveFetching[item.video_id] ? 'fetching' : item.status) as any} />
                            <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                              {item.model}
                            </div>
                          </div>

                          <div className="text-[10px] text-[var(--text-muted)] mb-2 flex justify-between">
                            <span>Created: {new Date(item.created_at).toLocaleString()}</span>
                            <span>{isExpired ? 'Expired' : `Expires in ${timeLeftH === 0 ? '<1' : timeLeftH}h`}</span>
                          </div>

                          <div className="relative border border-[var(--border-dim)] bg-black">
                            {preview.url ? (
                              <video src={preview.url} controls className="w-full" />
                            ) : (
                              <div className="p-6 text-center text-[var(--text-muted)] text-xs">{archiveFetching[item.video_id] ? 'Fetching…' : (item.status === 'completed' ? 'Preview not loaded' : 'Generating...')}</div>
                            )}
                            {item.status !== 'completed' && !preview.url && (
                              <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
                                <div className="loading-bar w-40"></div>
                              </div>
                            )}
                          </div>

                          <div className="mt-3 flex gap-2">
                            <button
                              onClick={async () => {
                                if (isExpired) return;
                                setPreviews((p) => ({ ...p, [item.video_id]: { ...p[item.video_id], loading: true, error: undefined } }));
                                try {
                                  const url = item.source === 'replicate'
                                    ? `/api/check-lipsync?prediction_id=${encodeURIComponent(item.video_id)}`
                                    : `/api/check-video?video_id=${encodeURIComponent(item.video_id)}`;
                                  const res = await fetch(url);
                                  const data = await res.json();
                                  if (!res.ok) throw new Error(data.error || 'Failed to fetch preview');
                                  const finalUrl = data.video_data || data.video_url || data.output || undefined;
                                  setPreviews((p) => ({ ...p, [item.video_id]: { url: finalUrl, loading: false } }));
                                } catch (e: any) {
                                  setPreviews((p) => ({ ...p, [item.video_id]: { loading: false, error: e.message || 'Failed to load' } }));
                                }
                              }}
                      disabled={((item.status !== 'completed' && !preview.url) || (isExpired && !preview.url) || preview.loading)}
                      className="flex-1 text-center border border-[var(--border-dim)] text-[var(--text-muted)] px-2.5 sm:px-3 py-2 text-[10px] uppercase tracking-wider hover:border-[var(--text-primary)] hover:text-[var(--text-primary)] disabled:opacity-40"
                            >
                              {preview.loading ? 'LOADING…' : '[ VIEW ]'}
                            </button>
                            <a
                              href={(preview.url || '')}
                              download={preview.url ? `video_${item.video_id}.mp4` : undefined}
                              onClick={(e) => { if (!preview.url) e.preventDefault(); }}
                              className="flex-1 text-center border border-[var(--border-dim)] text-[var(--text-muted)] px-2.5 sm:px-3 py-2 text-[10px] uppercase tracking-wider hover:border-[var(--text-primary)] hover:text-[var(--text-primary)] disabled:opacity-40"
                              aria-disabled={!preview.url}
                            >
                              [ DOWNLOAD ]
                            </a>
                            {item.status === 'completed' && item.source === 'openai' && item.model.startsWith('sora-2') && (
                              <button
                                onClick={() => {
                                  setArchiveRemixVideoId(item.video_id);
                                  setArchiveRemixPrompt('');
                                  setArchiveRemixModel(item.model);
                                  
                                  // Calculate remix cost based on original video parameters
                                  const seconds = parseInt(item.seconds || '12');
                                  // Determine resolution from model - if we don't have size info, assume standard
                                  const resolution = 'standard'; // We can't determine high res from archive data easily
                                  const cost = estimateVideoCredits(item.model, seconds, resolution);
                                  setArchiveRemixCost(cost);
                                }}
                                className="flex-1 text-center border border-[var(--accent-cyan)] text-[var(--accent-cyan)] px-2.5 sm:px-3 py-2 text-[10px] uppercase tracking-wider hover:bg-[var(--accent-cyan)] hover:bg-opacity-10 transition-all"
                              >
                                [ REMIX ]
                              </button>
                            )}
                          </div>
                          {preview.error && (
                            <div className="mt-2 text-[10px] text-[var(--accent-red)]">{preview.error}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Archive Remix Modal */}
                {archiveRemixVideoId && typeof window !== 'undefined' && createPortal(
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center p-4 overflow-y-auto"
                    style={{ zIndex: 2147483647 }}
                    onClick={() => {
                      if (!archiveRemixing) {
                        setArchiveRemixVideoId(null);
                        setArchiveRemixPrompt('');
                      }
                    }}
                  >
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      onClick={(e) => e.stopPropagation()}
                      className="bg-black border-2 border-[var(--accent-cyan)] p-4 sm:p-6 max-w-2xl w-full my-8 max-h-[90vh] overflow-y-auto"
                    >
                      <h3 className="text-lg uppercase tracking-widest text-[var(--accent-cyan)] mb-4 font-mono">
                        {'>'} REMIX VIDEO
                      </h3>
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col mb-[18px] items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] uppercase text-[var(--text-muted)] mb-1">Video ID</p>
                              <p className="text-xs text-[var(--text-primary)] font-mono break-all">{archiveRemixVideoId}</p>
                            </div>
                            <button
                              onClick={() => {
                                if (archiveRemixVideoId) {
                                  navigator.clipboard.writeText(archiveRemixVideoId);
                                }
                              }}
                              className="flex-shrink-0 border border-[var(--border-dim)] text-[var(--text-muted)] px-2 py-1 text-[9px] uppercase tracking-wider hover:border-[var(--accent-cyan)] hover:text-[var(--accent-cyan)] transition-all"
                              title="Copy Video ID"
                            >
                              [ COPY ]
                            </button>
                          </div>
                          <p className="text-xs text-[var(--text-muted)]">
                            Model: <span className="text-[var(--text-primary)] uppercase">{archiveRemixModel}</span>
                          </p>
                        </div>
                        <div className="text-left sm:text-right flex-shrink-0">
                          <p className="text-[10px] uppercase text-[var(--text-muted)]">Estimated Cost</p>
                          <p className="text-lg font-bold text-[var(--accent-cyan)] font-mono">{formatCredits(archiveRemixCost)}</p>
                          <p className="text-[9px] text-[var(--text-muted)]">CREDITS</p>
                        </div>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] mb-4">
                        Describe a single, focused change to make to the video. Keep it simple for best results.
                      </p>
                      <TerminalInput
                        label="REMIX PROMPT"
                        placeholder="e.g., Shift the color palette to warm sunset tones..."
                        multiline
                        rows={4}
                        value={archiveRemixPrompt}
                        onChange={(e) => setArchiveRemixPrompt(e.target.value)}
                        disabled={archiveRemixing}
                      />
                      <div className="border border-[var(--border-dim)] bg-black bg-opacity-60 p-3 mt-4 text-xs text-[var(--text-muted)]">
                        💡 <strong>Best practices:</strong> Use specific, single changes like "change lighting to golden hour", "add falling snow", or "shift colors to cool blue tones". Avoid multiple changes in one remix.
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3 mt-4">
                        <GlowButton
                          onClick={remixArchiveVideo}
                          disabled={archiveRemixing || !archiveRemixPrompt.trim()}
                          loading={archiveRemixing}
                          className="flex-1"
                        >
                          {archiveRemixing ? 'REMIXING...' : '[ START REMIX ]'}
                        </GlowButton>
                        <button
                          onClick={() => {
                            setArchiveRemixVideoId(null);
                            setArchiveRemixPrompt('');
                          }}
                          className="flex-1 border border-[var(--border-dim)] text-[var(--text-muted)] px-6 py-3 text-[11px] sm:text-sm uppercase tracking-wider hover:border-[var(--text-primary)] hover:text-[var(--text-primary)] transition-all"
                          disabled={archiveRemixing}
                        >
                          [ CANCEL ]
                        </button>
                      </div>
                      {error && (
                        <div className="mt-4 border border-[var(--accent-red)] bg-[var(--accent-red)] bg-opacity-10 p-3">
                          <div className="text-[#000] text-xs">{error}</div>
                        </div>
                      )}
                    </motion.div>
                  </motion.div>,
                  document.body
                )}
              </div>
            </TerminalPanel>
          </motion.div>
        )}

        {/* Info Panel */}
        <TerminalPanel title="SYSTEM INFORMATION" corners={false} className="mt-8">
          <div className="text-xs space-y-2 text-[var(--text-muted)]">
            {activeTab === 'script' && (
              <>
                <div className="flex items-start gap-2">
                  <span className="text-[var(--text-primary)]">{'>'}</span>
                  <span>Enter Company/Product Name (eg.CocoGold), Company/Product Type (eg.Hair Oil), and a Description</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[var(--text-primary)]">{'>'}</span>
                  <span>Select Generation Quality, Video Duration, and Video Orientation</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[var(--text-primary)]">{'>'}</span>
                  <span>Leave Custom Thread empty and click [ GENERATE THREADS ] for ideas</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[var(--text-primary)]">{'>'}</span>
                  <span>Select a thread to auto-generate a script, or enter a custom thread and click [ GENERATE SCRIPT ]</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[var(--text-primary)]">{'>'}</span>
                  <span>Review the output and click [ GENERATE VIDEO ] to send it to Video Gen</span>
                </div>
              </>
            )}

            {activeTab === 'generate' && (
              <>
                <div className="flex items-start gap-2">
                  <span className="text-[var(--text-primary)]">{'>'}</span>
                  <span>Choose Video Quality Model (SORA-2 or SORA-2-PRO)</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[var(--text-primary)]">{'>'}</span>
                  <span>Set Video Duration and Orientation; PRO adds Video Resolution</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[var(--text-primary)]">{'>'}</span>
                  <span>Write a detailed prompt; optionally click [ ENHANCE PROMPT ]</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[var(--text-primary)]">{'>'}</span>
                  <span>Click [ INITIATE VIDEO GENERATION ] and monitor progress</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[var(--text-primary)]">{'>'}</span>
                  <span>Use REMIX after completion to make a single targeted change</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[var(--text-primary)]">{'>'}</span>
                  <span>Credits are only deducted on success; time varies by model and complexity</span>
                </div>
              </>
            )}

            {activeTab === 'lipsync' && (
              <>
                <div className="flex items-start gap-2">
                  <span className="text-[var(--text-primary)]">{'>'}</span>
                  <span>Select LIP SYNC MODEL (WAN-Video recommended; Omni-Human higher quality)</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[var(--text-primary)]">{'>'}</span>
                  <span>For WAN-Video, optionally enter a VIDEO PROMPT describing the action</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[var(--text-primary)]">{'>'}</span>
                  <span>Upload a front-facing portrait image with clear facial features</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[var(--text-primary)]">{'>'}</span>
                  <span>Provide audio: type a script and [ GENERATE VOICEOVER ] or upload an audio file of a narration</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[var(--text-primary)]">{'>'}</span>
                  <span>Click [ GENERATE LIP SYNC VIDEO ] to create the video</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[var(--text-primary)]">{'>'}</span>
                  <span>Download promptly: lip sync videos expire in ~1 hour</span>
                </div>
              </>
            )}

            {activeTab === 'view' && (
              <>
                <div className="flex items-start gap-2">
                  <span className="text-[var(--text-primary)]">{'>'}</span>
                  <span>Preview and download results here; lip sync ~1h expiry, others ~24h</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[var(--text-primary)]">{'>'}</span>
                  <span>Use REMIX on completed videos to create a targeted update</span>
                </div>
              </>
            )}
          </div>
        </TerminalPanel>
      </div>
    </div>
  );
}
