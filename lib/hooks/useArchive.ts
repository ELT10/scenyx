'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { estimateVideoCredits } from '@/lib/client/pricing';
import { notifyCreditsUpdated } from '@/lib/client/events';
import type { ArchiveItem } from '@/lib/types/video';

export function useArchive() {
  const router = useRouter();
  const { publicKey } = useWallet();

  // Archive state
  const [archiveItems, setArchiveItems] = useState<ArchiveItem[]>([]);
  const [loadingArchive, setLoadingArchive] = useState(false);
  const [previews, setPreviews] = useState<Record<string, { url?: string; loading?: boolean; error?: string }>>({});
  const [archiveFetching, setArchiveFetching] = useState<Record<string, boolean>>({});
  const [copiedVideoId, setCopiedVideoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const archivePollingRef = useRef<NodeJS.Timeout | null>(null);
  const archiveItemsRef = useRef<ArchiveItem[]>([]);

  // Archive remix state
  const [archiveRemixVideoId, setArchiveRemixVideoId] = useState<string | null>(null);
  const [archiveRemixPrompt, setArchiveRemixPrompt] = useState('');
  const [archiveRemixing, setArchiveRemixing] = useState(false);
  const [archiveRemixCost, setArchiveRemixCost] = useState<number>(0);
  const [archiveRemixModel, setArchiveRemixModel] = useState<string>('');

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

  const loadArchive = useCallback(async () => {
    setLoadingArchive(true);
    try {
      const res = await fetch('/api/archive/recent?hours=20');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load archive');
      const items: ArchiveItem[] = data.items || [];
      setArchiveItems(items);
      archiveItemsRef.current = items;

      // Immediately refresh each item status
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
          
          // Ignore temporary server errors
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
    } catch (e: any) {
      console.error('Archive load failed:', e);
    } finally {
      setLoadingArchive(false);
    }
  }, []);

  const pollArchiveStatuses = useCallback(async () => {
    const current = archiveItemsRef.current;
    if (current.length === 0) return;
    const toPoll = current.filter((i) => i.status === 'queued' || i.status === 'in_progress');
    if (toPoll.length === 0) return;
    
    toPoll.forEach((i) => setArchiveFetching((prev) => ({ ...prev, [i.video_id]: true })));
    
    await Promise.all(
      toPoll.map(async (item) => {
        try {
          const url = item.source === 'replicate'
            ? `/api/check-lipsync?prediction_id=${encodeURIComponent(item.video_id)}`
            : `/api/check-video?video_id=${encodeURIComponent(item.video_id)}`;
          const res = await fetch(url);
          const data = await res.json();
          
          // Ignore temporary server errors
          if (!res.ok && data.error === 'Server error' && data.details?.error?.type === 'server_error') {
            console.log(`⚠️ Temporary server error for ${item.video_id}, will retry...`);
            return;
          }
          
          if (!res.ok) return;
          
          const rawStatus: string = data.status || item.status;
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
          
          const finalUrl = data.video_data || data.video_url || data.output || undefined;
          if (finalUrl) {
            setPreviews((p) => ({ ...p, [item.video_id]: { ...(p[item.video_id] || {}), url: finalUrl } }));
          }
        } catch (e) {
          console.error(`Poll failed for ${item.video_id}:`, e);
        } finally {
          setArchiveFetching((prev) => ({ ...prev, [item.video_id]: false }));
        }
      })
    );
  }, []);

  const remixArchiveVideo = useCallback(async () => {
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

      const newVideoId = data.video_id;
      if (newVideoId) {
        saveVideoIdToLocalStorage(newVideoId, `REMIX: ${archiveRemixPrompt}`);
      }

      setArchiveRemixVideoId(null);
      setArchiveRemixPrompt('');
      setArchiveRemixing(false);
      notifyCreditsUpdated();
      
      // Reload archive
      await loadArchive();

    } catch (err: any) {
      setError(err.message || 'An error occurred while remixing the video');
      setArchiveRemixing(false);
    }
  }, [publicKey, archiveRemixVideoId, archiveRemixPrompt, saveVideoIdToLocalStorage, loadArchive]);

  // Load archive on mount
  useEffect(() => {
    loadArchive();
  }, [loadArchive]);

  // Start polling when archive loads
  useEffect(() => {
    // Initial poll soon after load
    const initialTimer = setTimeout(() => {
      pollArchiveStatuses();
    }, 3000);

    // Regular polling
    const interval = setInterval(() => {
      pollArchiveStatuses();
    }, 10000);

    archivePollingRef.current = interval;

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
      if (archivePollingRef.current) {
        clearInterval(archivePollingRef.current);
      }
    };
  }, [pollArchiveStatuses]);

  return {
    // State
    archiveItems,
    loadingArchive,
    previews,
    setPreviews,
    archiveFetching,
    setArchiveFetching,
    copiedVideoId,
    setCopiedVideoId,
    error,
    setError,
    archiveRemixVideoId,
    setArchiveRemixVideoId,
    archiveRemixPrompt,
    setArchiveRemixPrompt,
    archiveRemixing,
    archiveRemixCost,
    setArchiveRemixCost,
    archiveRemixModel,
    setArchiveRemixModel,
    // Functions
    loadArchive,
    remixArchiveVideo,
    estimateVideoCredits,
  };
}


