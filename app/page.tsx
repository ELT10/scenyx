'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import TerminalPanel from '@/components/TerminalPanel';
import GlowButton from '@/components/GlowButton';
import StatusBadge from '@/components/StatusBadge';
import ProgressBar from '@/components/ProgressBar';
import DataGrid from '@/components/DataGrid';
import BackgroundEffects from '@/components/BackgroundEffects';
import TerminalInput from '@/components/TerminalInput';
import GlitchText from '@/components/GlitchText';

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
  // Tab state
  const [activeTab, setActiveTab] = useState<'generate' | 'view' | 'script'>('generate');
  
  // Generate video state
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generatedVideoId, setGeneratedVideoId] = useState<string | null>(null);
  const [generationProgress, setGenerationProgress] = useState<number>(0);
  const [generationStatus, setGenerationStatus] = useState<string>('');
  const generationPollingRef = useRef<NodeJS.Timeout | null>(null);
  
  // Video status check state
  const [videoId, setVideoId] = useState('');
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [videoStatus, setVideoStatus] = useState<VideoStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [autoPolling, setAutoPolling] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // View videos state
  const [savedVideos, setSavedVideos] = useState<VideoStatus[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);

  // Script generator state
  const [companyName, setCompanyName] = useState('');
  const [companyType, setCompanyType] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [customThread, setCustomThread] = useState('');
  const [scriptQuality, setScriptQuality] = useState<'nano' | 'mini' | 'high'>('mini');
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [generatedScript, setGeneratedScript] = useState('');
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [loadingScript, setLoadingScript] = useState(false);
  const [scriptError, setScriptError] = useState<string | null>(null);

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

  const getVideoIdsFromLocalStorage = (): Array<{video_id: string; prompt: string; saved_at: number}> => {
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
      if (!response.ok) {
        throw new Error('Failed to check video status');
      }

      const data = await response.json();
      setGenerationProgress(data.progress || 0);
      setGenerationStatus(data.status);

      if (data.status === 'completed' && data.video_data) {
        setVideoUrl(data.video_data);
        setLoading(false);
        setGenerationProgress(100);
        
        if (generationPollingRef.current) {
          clearInterval(generationPollingRef.current);
          generationPollingRef.current = null;
        }
      } else if (data.status === 'failed') {
        setError('Video generation failed');
        setLoading(false);
        
        if (generationPollingRef.current) {
          clearInterval(generationPollingRef.current);
          generationPollingRef.current = null;
        }
      }
    } catch (err: any) {
      console.error('Error polling progress:', err);
      setError(err.message || 'Failed to check video progress');
      setLoading(false);
      
      if (generationPollingRef.current) {
        clearInterval(generationPollingRef.current);
        generationPollingRef.current = null;
      }
    }
  }, []);

  const generateVideo = async () => {
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

    try {
      const response = await fetch('/api/generate-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt, pollForCompletion: false }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate video');
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
      loadSavedVideos();
    }
  }, [activeTab, loadSavedVideos]);

  const generateThreads = async () => {
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
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate threads');
      }

      setThreads(data.threads);
    } catch (err: any) {
      setScriptError(err.message || 'An error occurred while generating threads');
    } finally {
      setLoadingThreads(false);
    }
  };

  const generateScript = async (thread: Thread | string) => {
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
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate script');
      }

      setGeneratedScript(data.script);
    } catch (err: any) {
      setScriptError(err.message || 'An error occurred while generating script');
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
  };

  return (
    <div className="min-h-screen relative pb-20">
      <BackgroundEffects />
      
      <div className="relative z-10 container mx-auto px-4 py-8 max-w-7xl">
          {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          {/* <GlitchText className="text-4xl font-black mb-4">
            SCENYX
          </GlitchText> */}
          <div className="flex items-center justify-center gap-2 text-sm uppercase tracking-[0.3em]">
            <span className="text-[var(--accent-cyan)]">AI POWERED</span>
            <span className="text-[var(--text-muted)]">//</span>
            <span className="text-[var(--text-primary)]">VIDEO GENERATION PLATFORM</span>
          </div>
        </motion.div>

          {/* Tabs */}
        <div className="flex gap-2 mb-8 justify-center">
              <button
                onClick={() => setActiveTab('script')}
            className={`tab-button ${activeTab === 'script' ? 'active' : ''}`}
          >
            [ SCRIPT GEN ]
              </button>
              <button
                onClick={() => setActiveTab('generate')}
            className={`tab-button ${activeTab === 'generate' ? 'active' : ''}`}
          >
            [ VIDEO GEN ]
              </button>
              <button
                onClick={() => setActiveTab('view')}
            className={`tab-button ${activeTab === 'view' ? 'active' : ''}`}
          >
            [ ARCHIVE ]
              </button>
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

                <TerminalInput
                  label="CUSTOM THREAD (OPTIONAL)"
                  placeholder="Enter custom narrative thread..."
                  multiline
                  rows={2}
                        value={customThread}
                        onChange={(e) => setCustomThread(e.target.value)}
                        disabled={loadingThreads || loadingScript}
                      />

                <div className="flex gap-3">
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
                      <span className="text-[var(--accent-red)] text-xl">⚠</span>
                        <div>
                        <div className="text-[var(--accent-red)] font-bold text-sm uppercase mb-1">ERROR</div>
                        <div className="text-[var(--accent-red)] text-xs">{scriptError}</div>
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
                              ? 'border-[var(--border-primary)] bg-[var(--text-primary)] bg-opacity-5'
                              : 'border-[var(--border-dim)] hover:border-[var(--text-secondary)]'
                            }
                            disabled:opacity-30 disabled:cursor-not-allowed
                          `}
                        >
                          <h4 className="font-bold text-[var(--text-primary)] text-sm mb-2 uppercase tracking-wide">
                              {thread.title}
                            </h4>
                          <p className="text-[var(--text-muted)] text-xs leading-relaxed">
                              {thread.description}
                            </p>
                          </button>
                        ))}
                    </DataGrid>
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
                <TerminalInput
                  label="VIDEO GENERATION PROMPT"
                  placeholder="Enter detailed video description..."
                  multiline
                  rows={4}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
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
                    <div className="flex items-center justify-between mb-4">
                      <StatusBadge status={generationStatus as any} />
                      <span className="text-[var(--text-primary)] font-mono text-sm">
                    {generationProgress}%
                  </span>
                </div>
                    <ProgressBar progress={generationProgress} label="GENERATION PROGRESS" showPercentage={false} />
                    <div className="mt-3 text-[10px] text-[var(--text-muted)] font-mono">
                      VIDEO ID: {generatedVideoId}
                </div>
              </div>
            )}

            {error && (
                  <div className="border border-[var(--accent-red)] bg-[var(--accent-red)] bg-opacity-10 p-4">
                    <div className="flex items-start gap-3">
                      <span className="text-[var(--accent-red)] text-xl">⚠</span>
                  <div>
                        <div className="text-[var(--accent-red)] font-bold text-sm uppercase mb-1">CRITICAL ERROR</div>
                        <div className="text-[var(--accent-red)] text-xs">{error}</div>
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
                    <div className="flex gap-3 mt-4">
                      <a
                        href={videoUrl}
                        download
                        className="flex-1 text-center border border-[var(--border-primary)] text-[var(--text-primary)] px-6 py-3 text-sm uppercase tracking-wider hover:bg-[var(--text-primary)] hover:bg-opacity-10 transition-all"
                      >
                        [ DOWNLOAD ]
                      </a>
                      <button
                        onClick={() => {
                          setVideoUrl(null);
                          setPrompt('');
                        }}
                        className="flex-1 border border-[var(--border-dim)] text-[var(--text-muted)] px-6 py-3 text-sm uppercase tracking-wider hover:border-[var(--text-primary)] hover:text-[var(--text-primary)] transition-all"
                      >
                        [ NEW GENERATION ]
                      </button>
                    </div>
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

            <div className="flex gap-3">
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
                    <div className="text-[var(--accent-red)] text-xs">{statusError}</div>
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
                    <div className="grid grid-cols-2 gap-3 text-xs">
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

        {activeTab === 'view' && (
          <motion.div
            key="view"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
            <TerminalPanel title="VIDEO ARCHIVE DATABASE" status="active">
                  {loadingVideos ? (
                    <div className="text-center py-12">
                  <div className="loading-bar w-64 mx-auto"></div>
                  <p className="mt-4 text-[var(--text-muted)] text-sm uppercase tracking-wide">
                    LOADING ARCHIVE...
                  </p>
                    </div>
                  ) : savedVideos.length === 0 ? (
                    <div className="text-center py-12">
                  <div className="text-6xl text-[var(--text-muted)] mb-4">⊗</div>
                  <h3 className="text-lg uppercase text-[var(--text-primary)] mb-2 tracking-wider">
                    NO ARCHIVED VIDEOS
                      </h3>
                  <p className="text-[var(--text-muted)] text-sm">
                    Generate a video to populate the archive
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-sm uppercase tracking-widest text-[var(--text-primary)] font-mono">
                      {'>'} ARCHIVE ENTRIES: {savedVideos.length}
                        </h3>
                        <button
                          onClick={loadSavedVideos}
                      className="border border-[var(--border-dim)] text-[var(--text-muted)] px-4 py-2 text-xs uppercase tracking-wider hover:border-[var(--text-primary)] hover:text-[var(--text-primary)] transition-all"
                        >
                      [ REFRESH ]
                        </button>
                      </div>
                      {savedVideos.map((video) => (
                        <div
                          key={video.video_id}
                      className="border border-[var(--border-dim)] bg-black bg-opacity-60 p-6 hover:border-[var(--border-primary)] transition-all"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <StatusBadge status={video.status} />
                                {video.progress !== undefined && (
                          <span className="text-sm font-mono text-[var(--text-primary)]">
                                    {video.progress}%
                                  </span>
                                )}
                              </div>

                      <div className="text-xs font-mono text-[var(--text-muted)] mb-4 break-all">
                        ID: {video.video_id}
                          </div>

                          {video.progress !== undefined && video.status === 'in_progress' && (
                        <ProgressBar progress={video.progress} label="Generation Progress" />
                      )}

                      <div className="grid grid-cols-2 gap-3 text-xs mt-4">
                            {video.model && (
                              <div>
                            <span className="text-[var(--text-muted)]">MODEL:</span>
                            <span className="text-[var(--text-primary)] ml-2">{video.model}</span>
                              </div>
                            )}
                            {video.size && (
                              <div>
                            <span className="text-[var(--text-muted)]">SIZE:</span>
                            <span className="text-[var(--text-primary)] ml-2">{video.size}</span>
                              </div>
                            )}
                            {video.seconds && (
                              <div>
                            <span className="text-[var(--text-muted)]">DURATION:</span>
                            <span className="text-[var(--text-primary)] ml-2">{video.seconds}s</span>
                              </div>
                            )}
                            {video.created_at && (
                              <div>
                            <span className="text-[var(--text-muted)]">CREATED:</span>
                            <span className="text-[var(--text-primary)] ml-2">
                                  {new Date(video.created_at * 1000).toLocaleDateString()}
                                </span>
                              </div>
                            )}
                          </div>

                          {video.status === 'completed' && video.video_data && (
                        <div className="mt-4">
                          <div className="border border-[var(--border-primary)] p-2 bg-black mb-3">
                                <video
                                  src={video.video_data}
                                  controls
                              className="w-full"
                            />
                              </div>
                              <a
                                href={video.video_data}
                                download={`video_${video.video_id}.mp4`}
                            className="block w-full text-center border border-[var(--border-primary)] text-[var(--text-primary)] px-6 py-3 text-sm uppercase tracking-wider hover:bg-[var(--text-primary)] hover:bg-opacity-10 transition-all"
                              >
                            [ DOWNLOAD VIDEO ]
                              </a>
                            </div>
                          )}

                          {video.error && (
                        <div className="mt-4 border border-[var(--accent-red)] bg-[var(--accent-red)] bg-opacity-10 p-3 text-xs">
                          <div className="text-[var(--accent-red)] font-bold mb-1">
                            ERROR: {video.error.code}
                              </div>
                          <div className="text-[var(--accent-red)]">{video.error.message}</div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
            </TerminalPanel>
          </motion.div>
        )}

        {/* Info Panel */}
        <TerminalPanel title="SYSTEM INFORMATION" corners={false} className="mt-8">
          <div className="text-xs space-y-2 text-[var(--text-muted)]">
            <div className="flex items-start gap-2">
              <span className="text-[var(--text-primary)]">{'>'}</span>
              <span>Configure OpenAI API key in .env as OPEN_API_KEY to enable AI features</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[var(--text-primary)]">{'>'}</span>
              <span>Use Script Generator to create professional video ad scripts with AI</span>
          </div>
            <div className="flex items-start gap-2">
              <span className="text-[var(--text-primary)]">{'>'}</span>
              <span>Video generation time varies based on complexity and model selection</span>
          </div>
            <div className="flex items-start gap-2">
              <span className="text-[var(--text-primary)]">{'>'}</span>
              <span>All generated videos are stored locally and accessible via the Archive</span>
        </div>
          </div>
        </TerminalPanel>
      </div>
    </div>
  );
}
