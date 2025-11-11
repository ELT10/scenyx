'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type { VideoStatus } from '@/lib/types/video';

export function useVideoStatus() {
  const [videoId, setVideoId] = useState('');
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [videoStatus, setVideoStatus] = useState<VideoStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [autoPolling, setAutoPolling] = useState(false);
  const [savedVideos, setSavedVideos] = useState<VideoStatus[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const getVideoIdsFromLocalStorage = useCallback((): Array<{ video_id: string; prompt: string; saved_at: number }> => {
    try {
      return JSON.parse(localStorage.getItem('sora_video_ids') || '[]');
    } catch (error) {
      console.error('Failed to get video IDs from localStorage:', error);
      return [];
    }
  }, []);

  const checkVideoStatus = useCallback(async () => {
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
  }, [videoId]);

  const stopPolling = useCallback(() => {
    setAutoPolling(false);
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    setAutoPolling(true);
    checkVideoStatus();
    pollingIntervalRef.current = setInterval(() => {
      checkVideoStatus();
    }, 5000);
  }, [checkVideoStatus]);

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
  }, [getVideoIdsFromLocalStorage]);

  // Auto-stop polling when complete/failed
  useEffect(() => {
    if (autoPolling && videoStatus) {
      if (videoStatus.status === 'completed' || videoStatus.status === 'failed') {
        stopPolling();
      }
    }
  }, [videoStatus, autoPolling, stopPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  return {
    videoId,
    setVideoId,
    checkingStatus,
    videoStatus,
    statusError,
    autoPolling,
    savedVideos,
    loadingVideos,
    videoUrl,
    checkVideoStatus,
    startPolling,
    stopPolling,
    loadSavedVideos,
  };
}


