'use client';

import { motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useArchive } from '@/lib/hooks/useArchive';
import { formatCredits } from '@/lib/client/pricing';
import TerminalPanel from '@/components/TerminalPanel';
import GlowButton from '@/components/GlowButton';
import StatusBadge from '@/components/StatusBadge';
import BackgroundEffects from '@/components/BackgroundEffects';
import TerminalInput from '@/components/TerminalInput';
import CostEstimate from '@/components/CostEstimate';

export default function ArchivePage() {
  const archive = useArchive();

  return (
    <div className="min-h-screen relative pb-24 sm:pb-20">
      <BackgroundEffects />

      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          className="space-y-6"
        >
          <TerminalPanel title="VIDEO ARCHIVE" status="active">
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide">
                  Recent video generations (last 20 hours)
                </p>
                <button
                  onClick={archive.loadArchive}
                  disabled={archive.loadingArchive}
                  className="border border-[var(--border-dim)] text-[var(--text-muted)] px-3 py-2 text-xs uppercase tracking-wider hover:border-[var(--accent-cyan)] hover:text-[var(--accent-cyan)] transition-colors"
                >
                  {archive.loadingArchive ? 'LOADING...' : '[ REFRESH ]'}
                </button>
              </div>

              {archive.loadingArchive && archive.archiveItems.length === 0 ? (
                <div className="text-center py-8">
                  <div className="loading-bar w-48 mx-auto mb-4"></div>
                  <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
                    LOADING ARCHIVE...
                  </p>
                </div>
              ) : archive.archiveItems.length === 0 ? (
                <div className="border border-[var(--border-dim)] p-8 text-center">
                  <p className="text-sm text-[var(--text-muted)] uppercase tracking-wider">
                    No videos found in archive
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {archive.archiveItems.map((item) => {
                    const preview = archive.previews[item.video_id] || {};
                    const nowMs = Date.now();
                    const expMs = Date.parse(item.expiresAt);
                    const isExpired = expMs <= nowMs;
                    const timeLeftH = Math.max(0, Math.floor((expMs - nowMs) / 3600_000));
                    
                    return (
                      <div 
                        key={item.video_id} 
                        className={`border ${isExpired ? 'border-[var(--border-dim)] opacity-70' : 'border-[var(--border-dim)] hover:border-[var(--border-primary)]'} bg-black bg-opacity-60 p-4 transition-all`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <StatusBadge status={(archive.archiveFetching[item.video_id] ? 'fetching' : item.status) as any} />
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
                            <div className="p-6 text-center text-[var(--text-muted)] text-xs">
                              {archive.archiveFetching[item.video_id] ? 'Fetching…' : (item.status === 'completed' ? 'Preview not loaded' : 'Generating...')}
                            </div>
                          )}
                          {item.status !== 'completed' && !preview.url && (
                            <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
                              <div className="loading-bar w-40"></div>
                            </div>
                          )}
                        </div>

                        <div className="mt-3 flex gap-2 flex-wrap">
                          <button
                            onClick={async () => {
                              if (isExpired) return;
                              archive.setPreviews((p) => ({ ...p, [item.video_id]: { ...p[item.video_id], loading: true, error: undefined } }));
                              try {
                                const url = item.source === 'replicate'
                                  ? `/api/check-lipsync?prediction_id=${encodeURIComponent(item.video_id)}`
                                  : `/api/check-video?video_id=${encodeURIComponent(item.video_id)}`;
                                const res = await fetch(url);
                                const data = await res.json();
                                if (!res.ok) throw new Error(data.error || 'Failed to fetch preview');
                                const finalUrl = data.video_data || data.video_url || data.output || undefined;
                                archive.setPreviews((p) => ({ ...p, [item.video_id]: { url: finalUrl, loading: false } }));
                              } catch (e: any) {
                                archive.setPreviews((p) => ({ ...p, [item.video_id]: { loading: false, error: e.message || 'Failed to load' } }));
                              }
                            }}
                            disabled={((item.status !== 'completed' && !preview.url) || (isExpired && !preview.url) || preview.loading)}
                            className="flex-1 text-center border border-[var(--border-dim)] text-[var(--text-muted)] px-2.5 sm:px-3 py-2 text-[10px] uppercase tracking-wider hover:border-[var(--text-primary)] hover:text-[var(--text-primary)] disabled:opacity-40"
                          >
                            {preview.loading ? 'LOADING…' : '[ VIEW ]'}
                          </button>
                          <button
                            onClick={async () => {
                              const shareUrl = `${window.location.origin}/archive/${item.video_id}`;
                              try {
                                await navigator.clipboard.writeText(shareUrl);
                                archive.setCopiedVideoId(item.video_id);
                                setTimeout(() => archive.setCopiedVideoId(null), 2000);
                              } catch (err) {
                                console.error('Failed to copy:', err);
                              }
                            }}
                            disabled={item.status !== 'completed' || isExpired}
                            className="flex-1 text-center border border-[var(--border-dim)] text-[var(--text-muted)] px-2.5 sm:px-3 py-2 text-[10px] uppercase tracking-wider hover:border-[var(--text-primary)] hover:text-[var(--text-primary)] disabled:opacity-40"
                          >
                            {archive.copiedVideoId === item.video_id ? '[ COPIED! ]' : '[ SHARE ]'}
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
                                archive.setArchiveRemixVideoId(item.video_id);
                                archive.setArchiveRemixPrompt('');
                                archive.setArchiveRemixModel(item.model);
                                
                                const seconds = parseInt(item.seconds || '12');
                                const resolution = 'standard';
                                const cost = archive.estimateVideoCredits(item.model, seconds, resolution);
                                archive.setArchiveRemixCost(cost);
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
              {archive.archiveRemixVideoId && typeof window !== 'undefined' && createPortal(
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center p-4 overflow-y-auto"
                  style={{ zIndex: 2147483647 }}
                  onClick={() => {
                    if (!archive.archiveRemixing) {
                      archive.setArchiveRemixVideoId(null);
                      archive.setArchiveRemixPrompt('');
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
                            <p className="text-xs text-[var(--text-primary)] font-mono break-all">{archive.archiveRemixVideoId}</p>
                          </div>
                          <button
                            onClick={() => {
                              if (archive.archiveRemixVideoId) {
                                navigator.clipboard.writeText(archive.archiveRemixVideoId);
                              }
                            }}
                            className="flex-shrink-0 border border-[var(--border-dim)] text-[var(--text-muted)] px-2 py-1 text-[9px] uppercase tracking-wider hover:border-[var(--accent-cyan)] hover:text-[var(--accent-cyan)] transition-all"
                            title="Copy Video ID"
                          >
                            [ COPY ]
                          </button>
                        </div>
                        <p className="text-xs text-[var(--text-muted)]">
                          Model: <span className="text-[var(--text-primary)] uppercase">{archive.archiveRemixModel}</span>
                        </p>
                      </div>
                      <div className="text-left sm:text-right flex-shrink-0">
                        <p className="text-[10px] uppercase text-[var(--text-muted)]">Estimated Cost</p>
                        <p className="text-lg font-bold text-[var(--accent-cyan)] font-mono">{formatCredits(archive.archiveRemixCost)}</p>
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
                      value={archive.archiveRemixPrompt}
                      onChange={(e) => archive.setArchiveRemixPrompt(e.target.value)}
                      disabled={archive.archiveRemixing}
                    />
                    <div className="border border-[var(--border-dim)] bg-black bg-opacity-60 p-3 mt-4 text-xs text-[var(--text-muted)]">
                      💡 <strong>Best practices:</strong> Use specific, single changes like "change lighting to golden hour", "add falling snow", or "shift colors to cool blue tones". Avoid multiple changes in one remix.
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 mt-4">
                      <GlowButton
                        onClick={archive.remixArchiveVideo}
                        disabled={archive.archiveRemixing || !archive.archiveRemixPrompt.trim()}
                        loading={archive.archiveRemixing}
                        className="flex-1"
                      >
                        {archive.archiveRemixing ? 'REMIXING...' : '[ START REMIX ]'}
                      </GlowButton>
                      <button
                        onClick={() => {
                          archive.setArchiveRemixVideoId(null);
                          archive.setArchiveRemixPrompt('');
                        }}
                        className="flex-1 border border-[var(--border-dim)] text-[var(--text-muted)] px-6 py-3 text-[11px] sm:text-sm uppercase tracking-wider hover:border-[var(--text-primary)] hover:text-[var(--text-primary)] transition-all"
                        disabled={archive.archiveRemixing}
                      >
                        [ CANCEL ]
                      </button>
                    </div>
                    {archive.error && (
                      <div className="mt-4 border border-[var(--accent-red)] bg-[var(--accent-red)] bg-opacity-10 p-3">
                        <div className="text-[#000] text-xs">{archive.error}</div>
                      </div>
                    )}
                  </motion.div>
                </motion.div>,
                document.body
              )}
            </div>
          </TerminalPanel>
        </motion.div>

        {/* Info Panel */}
        <TerminalPanel title="SYSTEM INFORMATION" corners={false} className="mt-8">
          <div className="text-xs space-y-2 text-[var(--text-muted)]">
            <div className="flex items-start gap-2">
              <span className="text-[var(--text-primary)]">{'>'}</span>
              <span>Archive shows all videos generated in the last 20 hours</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[var(--text-primary)]">{'>'}</span>
              <span>Videos expire ~1 hour after generation - download promptly</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[var(--text-primary)]">{'>'}</span>
              <span>Use [ VIEW ] to load video preview, [ SHARE ] to copy link, [ DOWNLOAD ] to save</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[var(--text-primary)]">{'>'}</span>
              <span>Sora-2 videos can be remixed with focused single changes</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[var(--text-primary)]">{'>'}</span>
              <span>Status updates automatically - use [ REFRESH ] to force reload</span>
            </div>
          </div>
        </TerminalPanel>
      </div>
    </div>
  );
}
