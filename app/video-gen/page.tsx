'use client';

import { motion } from 'framer-motion';
import { useVideoGeneration } from '@/lib/hooks/useVideoGeneration';
import { useVideoStatus } from '@/lib/hooks/useVideoStatus';
import { formatCredits } from '@/lib/client/pricing';
import TerminalPanel from '@/components/TerminalPanel';
import GlowButton from '@/components/GlowButton';
import StatusBadge from '@/components/StatusBadge';
import ProgressBar from '@/components/ProgressBar';
import DataGrid from '@/components/DataGrid';
import BackgroundEffects from '@/components/BackgroundEffects';
import TerminalInput from '@/components/TerminalInput';
import CostEstimate from '@/components/CostEstimate';

export default function VideoGenPage() {
  const videoGen = useVideoGeneration();
  const videoStatus = useVideoStatus();

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
          <TerminalPanel title="VIDEO GENERATION INTERFACE" status="active">
            <div className="space-y-6">
              <div className="space-y-4">
                <DataGrid columns={2} gap="md">
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-[var(--text-primary)] mb-2 font-mono">
                      {'>'} VIDEO QUALITY MODEL
                    </label>
                    <select
                      value={videoGen.videoQuality}
                      onChange={(e) => videoGen.setVideoQuality(e.target.value as 'sora-2' | 'sora-2-pro')}
                      disabled={videoGen.loading}
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
                      value={videoGen.videoDuration}
                      onChange={(e) => videoGen.setVideoDuration(e.target.value as '4' | '8' | '12')}
                      disabled={videoGen.loading}
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
                    value={videoGen.videoOrientation}
                    onChange={(e) => videoGen.setVideoOrientation(e.target.value as 'vertical' | 'horizontal')}
                    disabled={videoGen.loading}
                    className="w-full bg-black bg-opacity-60 border border-[var(--border-dim)] text-[var(--text-primary)] px-4 py-3 text-sm font-mono focus:border-[var(--border-primary)] focus:outline-none transition-all"
                  >
                    <option value="horizontal">[ HORIZONTAL ] Landscape</option>
                    <option value="vertical">[ VERTICAL ] Portrait</option>
                  </select>
                </div>
              </div>

              {videoGen.videoQuality === 'sora-2-pro' && (
                <div>
                  <label className="block text-xs uppercase tracking-widest text-[var(--text-primary)] mb-2 font-mono">
                    {'>'} VIDEO RESOLUTION (PRO ONLY)
                  </label>
                  <select
                    value={videoGen.videoResolution}
                    onChange={(e) => videoGen.setVideoResolution(e.target.value as 'standard' | 'high')}
                    disabled={videoGen.loading}
                    className="w-full bg-black bg-opacity-60 border border-[var(--border-dim)] text-[var(--text-primary)] px-4 py-3 text-sm font-mono focus:border-[var(--border-primary)] focus:outline-none transition-all"
                  >
                    <option value="standard">[ STANDARD ] {videoGen.videoOrientation === 'vertical' ? '720x1280' : '1280x720'}</option>
                    <option value="high">[ HIGH ] {videoGen.videoOrientation === 'vertical' ? '1024x1792' : '1792x1024'}</option>
                  </select>
                </div>
              )}

              <TerminalInput
                label="VIDEO GENERATION PROMPT"
                labelRight={
                  <button
                    onClick={videoGen.enhancePrompt}
                    disabled={videoGen.enhancingPrompt || !videoGen.prompt.trim() || videoGen.loading}
                    className="text-[10px] uppercase tracking-wider px-2 py-1 border border-[var(--border-dim)] text-[var(--text-muted)] hover:border-[var(--accent-cyan)] hover:text-[var(--accent-cyan)] transition-colors flex items-center gap-2"
                    title="Enhance your prompt using best-practice structure"
                  >
                    <span>{videoGen.enhancingPrompt ? '[ ENHANCING ... ]' : '[ ENHANCE PROMPT ]'}</span>
                    <span className="text-[9px] opacity-80 tracking-[0.1px]"> {formatCredits(videoGen.enhancePromptCredits)} CR</span>
                  </button>
                }
                placeholder="Enter detailed video description..."
                multiline
                rows={4}
                value={videoGen.prompt}
                onChange={(e) => videoGen.setPrompt(e.target.value)}
                onKeyDown={videoGen.handleKeyDown}
                disabled={videoGen.loading}
              />

              <CostEstimate 
                credits={videoGen.videoCost} 
                operation="Video Generation" 
              />

              <GlowButton
                onClick={videoGen.generateVideo}
                disabled={videoGen.loading || !videoGen.prompt.trim()}
                loading={videoGen.loading}
                className="w-full"
              >
                {videoGen.loading ? `GENERATING... ${videoGen.generationProgress}%` : '[ INITIATE VIDEO GENERATION ]'}
              </GlowButton>

              {videoGen.loading && videoGen.generatedVideoId && (
                <div className="border border-[var(--border-primary)] bg-[var(--text-primary)] bg-opacity-5 p-6">
                  <div className="flex items-center justify-between mb-2">
                    <StatusBadge status={videoGen.generationStatus as any} />
                    <span className="text-[#000000] font-mono text-sm">
                      {videoGen.generationProgress}%
                    </span>
                  </div>
                  <ProgressBar progress={videoGen.generationProgress} label="GENERATION PROGRESS" showPercentage={false} />
                  <div className="mt-3 flex items-center justify-between">
                    <div className="text-[12px] text-[#222222] font-mono">
                      VIDEO ID: {videoGen.generatedVideoId}
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(videoGen.generatedVideoId!);
                      }}
                      className="border border-[var(--border-dim)] text-[var(--text-muted)] px-3 py-1 text-[10px] uppercase tracking-wider hover:border-[var(--accent-cyan)] hover:text-[var(--accent-cyan)] transition-all"
                      title="Copy Video ID"
                    >
                      [ COPY ]
                    </button>
                  </div>
                </div>
              )}

              {videoGen.error && (
                <div className="border border-[var(--accent-red)] bg-[var(--accent-red)] bg-opacity-10 p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-[#000] text-xl">⚠</span>
                    <div>
                      <div className="text-[#000] font-bold text-sm uppercase mb-1">CRITICAL ERROR</div>
                      <div className="text-[#000] text-xs">{videoGen.error}</div>
                    </div>
                  </div>
                </div>
              )}

              {videoGen.videoUrl && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  <h3 className="text-sm uppercase tracking-widest text-[var(--text-primary)] mb-4 font-mono">
                    {'>'} GENERATED OUTPUT
                  </h3>
                  <div className="border border-[var(--border-primary)] p-2 bg-black">
                    <video
                      src={videoGen.videoUrl}
                      controls
                      className="w-full"
                      autoPlay
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 mt-4">
                    <a
                      href={videoGen.videoUrl}
                      download
                      className="flex-1 text-center border border-[var(--border-primary)] text-[var(--text-primary)] px-4 sm:px-6 py-3 text-sm uppercase tracking-wider hover:bg-[var(--accent-cyan)] hover:bg-opacity-10 hover:border-[var(--accent-cyan)] hover:text-[#000000] transition-all"
                    >
                      [ DOWNLOAD ]
                    </a>
                    {videoGen.currentVideoModel && videoGen.currentVideoModel.startsWith('sora-2') && (
                      <button
                        onClick={() => {
                          videoGen.setShowRemixUI(!videoGen.showRemixUI);
                          if (!videoGen.showRemixUI) {
                            videoGen.setRemixPrompt('');
                          }
                        }}
                        className="flex-1 border border-[var(--accent-cyan)] text-[var(--accent-cyan)] px-4 sm:px-6 py-3 text-sm uppercase tracking-wider hover:bg-[var(--accent-cyan)] hover:text-[#000000] hover:bg-opacity-10 transition-all"
                      >
                        [ REMIX VIDEO ]
                      </button>
                    )}
                    <button
                      onClick={() => {
                        videoGen.setVideoUrl(null);
                        videoGen.setPrompt('');
                        videoGen.setShowRemixUI(false);
                        videoGen.setRemixPrompt('');
                      }}
                      className="flex-1 border border-[var(--border-dim)] text-[var(--text-muted)] px-4 sm:px-6 py-3 text-sm uppercase tracking-wider hover:border-[var(--text-primary)] hover:text-[var(--text-primary)] transition-all"
                    >
                      [ NEW GENERATION ]
                    </button>
                  </div>

                  {/* Remix UI */}
                  {videoGen.showRemixUI && (
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
                        value={videoGen.remixPrompt}
                        onChange={(e) => videoGen.setRemixPrompt(e.target.value)}
                        disabled={videoGen.remixing}
                      />
                      <CostEstimate 
                        credits={videoGen.remixCost} 
                        operation="Video Remix" 
                        className="mt-3"
                      />
                      <div className="flex gap-3 mt-4">
                        <GlowButton
                          onClick={videoGen.remixVideo}
                          disabled={videoGen.remixing || !videoGen.remixPrompt.trim()}
                          loading={videoGen.remixing}
                          className="flex-1"
                        >
                          {videoGen.remixing ? 'REMIXING...' : '[ START REMIX ]'}
                        </GlowButton>
                        <button
                          onClick={() => {
                            videoGen.setShowRemixUI(false);
                            videoGen.setRemixPrompt('');
                          }}
                          className="flex-1 border border-[var(--border-dim)] text-[var(--text-muted)] px-4 py-3 text-sm uppercase tracking-wider hover:border-[var(--text-primary)] hover:text-[var(--text-primary)] transition-all"
                          disabled={videoGen.remixing}
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
                value={videoStatus.videoId}
                onChange={(e) => videoStatus.setVideoId(e.target.value)}
                disabled={videoStatus.checkingStatus || videoStatus.autoPolling}
              />

              <div className="flex flex-col sm:flex-row gap-3">
                <GlowButton
                  onClick={videoStatus.checkVideoStatus}
                  disabled={videoStatus.checkingStatus || videoStatus.autoPolling || !videoStatus.videoId.trim()}
                  loading={videoStatus.checkingStatus}
                  className="flex-1"
                >
                  {videoStatus.checkingStatus ? 'CHECKING...' : '[ CHECK STATUS ]'}
                </GlowButton>

                {videoStatus.videoStatus && (videoStatus.videoStatus.status === 'in_progress' || videoStatus.videoStatus.status === 'queued') && (
                  <GlowButton
                    onClick={videoStatus.autoPolling ? videoStatus.stopPolling : videoStatus.startPolling}
                    variant={videoStatus.autoPolling ? 'danger' : 'primary'}
                    className="flex-1"
                  >
                    {videoStatus.autoPolling ? '[ STOP POLLING ]' : '[ AUTO-POLL ]'}
                  </GlowButton>
                )}
              </div>

              {videoStatus.statusError && (
                <div className="border border-[var(--accent-red)] bg-[var(--accent-red)] bg-opacity-10 p-4">
                  <div className="text-[#000000] text-xs">{videoStatus.statusError}</div>
                </div>
              )}

              {videoStatus.videoStatus && (
                <div className="border border-[var(--border-dim)] bg-black bg-opacity-60 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--text-muted)] uppercase">Status:</span>
                    <StatusBadge status={videoStatus.videoStatus.status} showDot={true} />
                  </div>
                  {videoStatus.videoStatus.progress !== undefined && (
                    <ProgressBar progress={videoStatus.videoStatus.progress} label="Progress" />
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[var(--text-muted)]">ID:</span>
                      <span className="text-[var(--text-primary)] ml-2 font-mono break-all">{videoStatus.videoStatus.video_id}</span>
                    </div>
                    {videoStatus.videoStatus.model && (
                      <div>
                        <span className="text-[var(--text-muted)]">Model:</span>
                        <span className="text-[var(--text-primary)] ml-2">{videoStatus.videoStatus.model}</span>
                      </div>
                    )}
                    {videoStatus.videoStatus.seconds && (
                      <div>
                        <span className="text-[var(--text-muted)]">Duration:</span>
                        <span className="text-[var(--text-primary)] ml-2">{videoStatus.videoStatus.seconds}s</span>
                      </div>
                    )}
                    {videoStatus.videoStatus.size && (
                      <div>
                        <span className="text-[var(--text-muted)]">Size:</span>
                        <span className="text-[var(--text-primary)] ml-2">{videoStatus.videoStatus.size}</span>
                      </div>
                    )}
                  </div>
                  {videoStatus.videoStatus.error && (
                    <div className="border border-[var(--accent-red)] bg-[var(--accent-red)] bg-opacity-10 p-3 text-xs">
                      <div className="text-[var(--accent-red)] font-bold">{videoStatus.videoStatus.error.code}</div>
                      <div className="text-[var(--accent-red)]">{videoStatus.videoStatus.error.message}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </TerminalPanel>
        </motion.div>

        {/* Info Panel */}
        <TerminalPanel title="SYSTEM INFORMATION" corners={false} className="mt-8">
          <div className="text-xs space-y-2 text-[var(--text-muted)]">
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
          </div>
        </TerminalPanel>
      </div>
    </div>
  );
}
