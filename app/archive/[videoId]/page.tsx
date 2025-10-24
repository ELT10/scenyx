'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface VideoData {
  success: boolean;
  video_id: string;
  status: string;
  model: string;
  prompt?: string;
  seconds?: string;
  size?: string;
  orientation?: string;
  resolution?: string;
  created_at: string;
  source: 'openai' | 'replicate';
  video_data?: string;
  video_url?: string;
  message?: string;
}

function calculateExpiry(createdAt: string) {
  const created = new Date(createdAt).getTime();
  const ttlMs = 1 * 3600 * 1000; // 1 hour
  const expiresMs = created + ttlMs;
  const now = Date.now();
  const remainingMs = expiresMs - now;
  
  return {
    expiresAt: new Date(expiresMs),
    isExpired: remainingMs <= 0,
    remainingMinutes: Math.max(0, Math.floor(remainingMs / 60000)),
    remainingSeconds: Math.max(0, Math.floor((remainingMs % 60000) / 1000)),
  };
}

export default function VideoPage() {
  const params = useParams();
  const router = useRouter();
  const videoId = params.videoId as string;

  const [videoData, setVideoData] = useState<VideoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expiryInfo, setExpiryInfo] = useState<ReturnType<typeof calculateExpiry> | null>(null);

  useEffect(() => {
    const fetchVideo = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/archive/${videoId}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to load video');
        }

        if (!data.success) {
          // Check if it's an expiry issue
          if (data.status === 'expired' || data.message?.toLowerCase().includes('expired')) {
            setVideoData(data);
            if (data.created_at) {
              setExpiryInfo(calculateExpiry(data.created_at));
            }
          }
          setError(data.message || 'Video not available');
          setLoading(false);
          return;
        }

        setVideoData(data);
        
        // Calculate expiry info
        if (data.created_at) {
          const expiry = calculateExpiry(data.created_at);
          setExpiryInfo(expiry);
          
          // If expired, show error
          if (expiry.isExpired) {
            setError('Video has expired (videos expire after 1 hour)');
          }
        }
        
        setLoading(false);
      } catch (err: any) {
        console.error('Error fetching video:', err);
        setError(err.message || 'Failed to load video');
        setLoading(false);
      }
    };

    if (videoId) {
      fetchVideo();
    }
  }, [videoId]);

  // Update expiry countdown every second
  useEffect(() => {
    if (!videoData?.created_at) return;

    const interval = setInterval(() => {
      const expiry = calculateExpiry(videoData.created_at);
      setExpiryInfo(expiry);

      // If just expired, set error
      if (expiry.isExpired && !error) {
        setError('Video has expired (videos expire after 1 hour)');
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [videoData?.created_at, error]);

  const handleShare = async () => {
    const shareUrl = window.location.href;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDownload = () => {
    if (!videoData?.video_data) return;

    const link = document.createElement('a');
    link.href = videoData.video_data;
    link.download = `scenyx_${videoId}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-black text-white font-mono">
      {/* Header */}
      <header className="px-4 sm:px-6 pt-8 lg:pt-12">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              href="/" 
              className="text-[10px] sm:text-sm text-gray-400 hover:text-white transition-colors border border-gray-700 px-4 py-2 hover:border-gray-500"
            >
              ← BACK TO APP
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {loading && (
          <div className="flex flex-col items-center justify-center min-h-[400px]">
            <div className="text-cyan-400 text-xl mb-4 animate-pulse">
              LOADING VIDEO...
            </div>
            <div className="w-16 h-1 bg-cyan-400 animate-pulse"></div>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center min-h-[400px]">
            <div className="border border-red-500 bg-red-500/10 p-8 max-w-2xl">
              {expiryInfo?.isExpired ? (
                <>
                  <div className="text-red-400 text-2xl sm:text-3xl mb-4 font-bold">VIDEO EXPIRED</div>
                  <div className="text-gray-300 text-lg mb-2">Sorry. Video has expired.</div>
                  <div className="text-gray-400 text-sm mb-6">
                    All videos expire 1 hour after generation. This video expired on{' '}
                    {expiryInfo.expiresAt.toLocaleString()}.
                  </div>
                </>
              ) : (
                <>
                  <div className="text-red-400 text-xl mb-2 font-bold">ERROR</div>
                  <div className="text-gray-300 mb-6">{error}</div>
                </>
              )}
              <Link 
                href="/"
                className="inline-block border border-gray-700 text-gray-300 px-6 py-3 hover:border-white hover:text-white transition-colors"
              >
                {expiryInfo?.isExpired ? 'CREATE NEW VIDEO' : 'RETURN HOME'}
              </Link>
            </div>
          </div>
        )}

        {!loading && !error && videoData && (
          <div className="space-y-6">
            {/* Expiry Warning */}
            {expiryInfo && !expiryInfo.isExpired && expiryInfo.remainingMinutes < 10 && (
              <div className="border border-yellow-500 bg-yellow-500/10 p-4">
                <div className="flex items-center gap-2">
                  <span className="text-yellow-400 text-xl">⚠</span>
                  <div>
                    <div className="text-yellow-400 font-bold text-sm uppercase">Expiring Soon</div>
                    <div className="text-gray-300 text-sm">
                      This video will expire in{' '}
                      <span className="font-bold text-yellow-400">
                        {expiryInfo.remainingMinutes > 0 
                          ? `${expiryInfo.remainingMinutes}m ${expiryInfo.remainingSeconds}s`
                          : `${expiryInfo.remainingSeconds}s`
                        }
                      </span>. Download it now before it's gone!
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Video Player */}
            <div className="border border-gray-800 bg-gray-900/30 overflow-hidden">
              {videoData.video_data ? (
                <video
                  controls
                  autoPlay
                  loop
                  className="w-full h-auto max-h-[70vh] bg-black"
                  src={videoData.video_data}
                >
                  Your browser does not support the video tag.
                </video>
              ) : (
                <div className="aspect-video flex items-center justify-center bg-gray-900">
                  <div className="text-gray-500">Video not available</div>
                </div>
              )}
            </div>

            {/* Video Actions */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleDownload}
                disabled={!videoData.video_data}
                className="flex-1 text-[13px] sm:text-[16px] sm:flex-none border border-gray-700 text-white px-6 py-3 hover:border-cyan-400 hover:text-cyan-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-gray-700 disabled:hover:text-white"
              >
                ↓ DOWNLOAD
              </button>
              <button
                onClick={handleShare}
                className="flex-1 text-[13px] sm:text-[16px] sm:flex-none border border-gray-700 text-white px-6 py-3 hover:border-cyan-400 hover:text-cyan-400 transition-colors"
              >
                {copied ? '✓ COPIED!' : '⎘ COPY LINK'}
              </button>
            </div>

            {/* Video Details */}
            <div className="border border-gray-800 bg-gray-900/30 p-6">
              <h2 className="text-sm uppercase tracking-wider text-gray-500 mb-4">VIDEO DETAILS</h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-gray-500 uppercase text-xs mb-1">ID</div>
                  <div className="text-gray-300 font-mono break-all">{videoData.video_id}</div>
                </div>
                
                <div>
                  <div className="text-gray-500 uppercase text-xs mb-1">Status</div>
                  <div className="text-green-400 uppercase">{videoData.status}</div>
                </div>
                
                <div>
                  <div className="text-gray-500 uppercase text-xs mb-1">Model</div>
                  <div className="text-gray-300">{videoData.model}</div>
                </div>
                
                <div>
                  <div className="text-gray-500 uppercase text-xs mb-1">Source</div>
                  <div className="text-gray-300 uppercase">{videoData.source}</div>
                </div>
                
                {videoData.seconds && (
                  <div>
                    <div className="text-gray-500 uppercase text-xs mb-1">Duration</div>
                    <div className="text-gray-300">{videoData.seconds}s</div>
                  </div>
                )}
                
                {videoData.resolution && (
                  <div>
                    <div className="text-gray-500 uppercase text-xs mb-1">Resolution</div>
                    <div className="text-gray-300">{videoData.resolution}</div>
                  </div>
                )}
                
                <div>
                  <div className="text-gray-500 uppercase text-xs mb-1">Created</div>
                  <div className="text-gray-300">
                    {new Date(videoData.created_at).toLocaleString()}
                  </div>
                </div>
                
                {expiryInfo && (
                  <div>
                    <div className="text-gray-500 uppercase text-xs mb-1">Expiry</div>
                    {expiryInfo.isExpired ? (
                      <div className="text-red-400">Expired</div>
                    ) : (
                      <div className="text-yellow-400">
                        {expiryInfo.remainingMinutes > 0 
                          ? `${expiryInfo.remainingMinutes}m ${expiryInfo.remainingSeconds}s remaining`
                          : `${expiryInfo.remainingSeconds}s remaining`
                        }
                      </div>
                    )}
                  </div>
                )}
              </div>

              {videoData.prompt && (
                <div className="mt-6 pt-6 border-t border-gray-800">
                  <div className="text-gray-500 uppercase text-xs mb-2">Prompt</div>
                  <div className="text-gray-300 leading-relaxed text-[13px] sm:text-[16px]">{videoData.prompt}</div>
                </div>
              )}
            </div>

            {/* Create Your Own */}
            <div className="border border-cyan-400/30 bg-cyan-400/5 p-6 text-center">
              <div className="text-gray-300 mb-4">
                Want to create your own AI-generated videos?
              </div>
              <Link
                href="/"
                className="inline-block border border-cyan-400 text-cyan-400 px-8 py-3 hover:bg-cyan-400 hover:text-black transition-colors"
              >
                GET STARTED
              </Link>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-12 py-6 text-center text-gray-500 text-sm">
        <div className="max-w-6xl mx-auto px-4">
          Powered by <span className="text-cyan-400">SCENYX</span> — AI Video Generation Platform
        </div>
      </footer>
    </div>
  );
}

