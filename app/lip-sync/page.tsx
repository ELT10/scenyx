'use client';

import { motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useLipSync } from '@/lib/hooks/useLipSync';
import { formatCredits } from '@/lib/client/pricing';
import TerminalPanel from '@/components/TerminalPanel';
import GlowButton from '@/components/GlowButton';
import BackgroundEffects from '@/components/BackgroundEffects';
import TerminalInput from '@/components/TerminalInput';
import CostEstimate from '@/components/CostEstimate';
import ProgressBar from '@/components/ProgressBar';

export default function LipSyncPage() {
  const lipSync = useLipSync();

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
                    onClick={() => lipSync.setIsModelModalOpen(true)}
                    disabled={lipSync.loadingLipSync || lipSync.loadingTTS}
                    className="w-full bg-black bg-opacity-60 border border-[var(--border-dim)] text-[var(--text-primary)] px-4 py-3 text-sm font-mono focus:border-[var(--border-primary)] focus:outline-none transition-all text-left"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex-1 truncate">{lipSync.lipSyncModelLabels[lipSync.lipSyncModel] || lipSync.lipSyncModel}</span>
                      <span
                        className="text-[10px] px-2 py-1 rounded uppercase tracking-wide"
                        style={lipSync.statusStyles[(lipSync.modelStatuses[lipSync.lipSyncModel] || 'unknown')]}
                      >
                        {lipSync.statusLabels[(lipSync.modelStatuses[lipSync.lipSyncModel] || 'unknown')]}
                      </span>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => lipSync.fetchLipSyncModelStatuses()}
                    disabled={lipSync.loadingLipSync || lipSync.loadingTTS}
                    className="inline-flex items-center justify-center border border-[var(--border-dim)] px-3 py-2 text-xs uppercase tracking-wider text-[var(--text-muted)] hover:border-[var(--accent-cyan)] hover:text-[var(--accent-cyan)] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    title="Refresh model statuses"
                  >
                    Refresh
                  </button>
                </div>
              </div>

              {/* Prompt for WAN-Video model */}
              {lipSync.lipSyncModel === 'wan-video/wan-2.2-s2v' && (
                <div>
                  <label className="block text-xs uppercase tracking-widest text-[var(--text-primary)] mb-2 font-mono">
                    {'>'} VIDEO PROMPT (RECOMMENDED)
                  </label>
                  <input
                    type="text"
                    placeholder="Default: person talking (try: woman singing, man speaking...)"
                    value={lipSync.lipSyncPrompt}
                    onChange={(e) => lipSync.setLipSyncPrompt(e.target.value)}
                    disabled={lipSync.loadingLipSync || lipSync.loadingTTS}
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
                
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <button
                    onClick={() => {
                      lipSync.setImageSource('upload');
                      lipSync.avatarError && lipSync.setAvatarError(null);
                    }}
                    disabled={lipSync.loadingLipSync || lipSync.loadingTTS || lipSync.generatingAvatar}
                    className={`p-4 border text-center transition-all ${
                      lipSync.imageSource === 'upload'
                        ? 'border-[var(--accent-cyan)] bg-[var(--accent-cyan)] bg-opacity-10 text-[var(--accent-cyan)]'
                        : 'border-[var(--border-dim)] text-[var(--text-muted)] hover:border-[var(--text-secondary)]'
                    }`}
                  >
                    <div className="text-2xl mb-2">📤</div>
                    <div className="text-xs uppercase tracking-wider font-mono">Upload Image</div>
                  </button>
                  <button
                    onClick={() => {
                      lipSync.setImageSource('ai');
                      lipSync.avatarError && lipSync.setAvatarError(null);
                    }}
                    disabled={lipSync.loadingLipSync || lipSync.loadingTTS || lipSync.generatingAvatar}
                    className={`p-4 border text-center transition-all ${
                      lipSync.imageSource === 'ai'
                        ? 'border-[var(--accent-cyan)] bg-[var(--accent-cyan)] bg-opacity-10 text-[var(--accent-cyan)]'
                        : 'border-[var(--border-dim)] text-[var(--text-muted)] hover:border-[var(--text-secondary)]'
                    }`}
                  >
                    <div className="text-2xl mb-2">🤖</div>
                    <div className="text-xs uppercase tracking-wider font-mono">AI Generate</div>
                  </button>
                </div>

                {/* Upload Image UI */}
                {lipSync.imageSource === 'upload' && (
                  <div>
                    {!lipSync.lipSyncImagePreview ? (
                      <label className="block">
                        <div className="border-2 border-dashed border-[var(--border-dim)] p-8 text-center cursor-pointer hover:border-[var(--accent-cyan)] transition-all">
                          <div className="text-4xl mb-2">📸</div>
                          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Click to upload image</p>
                          <p className="text-[10px] text-[var(--text-muted)] mt-2">PNG, JPG, WEBP (Max 10MB)</p>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={lipSync.handleImageFileChange}
                          disabled={lipSync.loadingLipSync || lipSync.loadingTTS}
                          className="hidden"
                        />
                      </label>
                    ) : (
                      <div>
                        <div className="border border-[var(--border-primary)] p-2 bg-black">
                          <img src={lipSync.lipSyncImagePreview} alt="Preview" className="w-full" />
                        </div>
                        <button
                          onClick={() => {
                            lipSync.handleImageFileChange({ target: { files: null } } as any);
                          }}
                          className="mt-2 w-full border border-[var(--border-dim)] text-[var(--text-muted)] px-4 py-2 text-xs uppercase tracking-wider hover:border-[var(--text-primary)] hover:text-[var(--text-primary)] transition-all"
                        >
                          CLEAR IMAGE
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* AI Generate Image UI */}
                {lipSync.imageSource === 'ai' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs uppercase tracking-widest text-[var(--text-primary)] mb-2 font-mono">
                        {'>'} Avatar Type
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => lipSync.setAvatarType('face')}
                          disabled={lipSync.generatingAvatar}
                          className={`p-3 border text-center transition-all ${
                            lipSync.avatarType === 'face'
                              ? 'border-[var(--accent-cyan)] bg-[var(--accent-cyan)] bg-opacity-10 text-[var(--accent-cyan)]'
                              : 'border-[var(--border-dim)] text-[var(--text-muted)]'
                          }`}
                        >
                          <div className="text-sm uppercase tracking-wider font-mono">Face Only</div>
                        </button>
                        <button
                          onClick={() => lipSync.setAvatarType('full-body')}
                          disabled={lipSync.generatingAvatar}
                          className={`p-3 border text-center transition-all ${
                            lipSync.avatarType === 'full-body'
                              ? 'border-[var(--accent-cyan)] bg-[var(--accent-cyan)] bg-opacity-10 text-[var(--accent-cyan)]'
                              : 'border-[var(--border-dim)] text-[var(--text-muted)]'
                          }`}
                        >
                          <div className="text-sm uppercase tracking-wider font-mono">Full Body</div>
                        </button>
                      </div>
                    </div>

                    <TerminalInput
                      label="Avatar Description"
                      placeholder="Describe the person you want to create..."
                      multiline
                      rows={3}
                      value={lipSync.avatarPrompt}
                      onChange={(e) => lipSync.setAvatarPrompt(e.target.value)}
                      disabled={lipSync.generatingAvatar}
                      labelRight={
                        <button
                          onClick={lipSync.enhanceAvatarPrompt}
                          disabled={lipSync.enhancingAvatarPrompt || !lipSync.avatarPrompt.trim()}
                          className="text-[10px] uppercase tracking-wider px-2 py-1 border border-[var(--border-dim)] text-[var(--text-muted)] hover:border-[var(--accent-cyan)] hover:text-[var(--accent-cyan)] transition-colors"
                        >
                          {lipSync.enhancingAvatarPrompt ? 'ENHANCING...' : 'ENHANCE'}
                        </button>
                      }
                    />

                    <CostEstimate credits={lipSync.avatarCost} operation="Avatar Generation" />

                    <GlowButton
                      onClick={lipSync.generateAvatar}
                      disabled={lipSync.generatingAvatar || !lipSync.avatarPrompt.trim()}
                      loading={lipSync.generatingAvatar}
                      className="w-full"
                    >
                      {lipSync.generatingAvatar ? 'GENERATING...' : '[ GENERATE AVATAR ]'}
                    </GlowButton>

                    {lipSync.avatarError && (
                      <div className="border border-[var(--accent-red)] bg-[var(--accent-red)] bg-opacity-10 p-3 text-xs text-[#000]">
                        {lipSync.avatarError}
                      </div>
                    )}

                    {lipSync.generatedAvatarUrl && (
                      <div>
                        <div className="border border-[var(--border-primary)] p-2 bg-black">
                          <img src={lipSync.generatedAvatarUrl} alt="Generated Avatar" className="w-full" />
                        </div>
                        <button
                          onClick={lipSync.clearAvatar}
                          className="mt-2 w-full border border-[var(--border-dim)] text-[var(--text-muted)] px-4 py-2 text-xs uppercase tracking-wider hover:border-[var(--text-primary)] hover:text-[var(--text-primary)] transition-all"
                        >
                          CLEAR AVATAR
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Audio Source Selection */}
              <div className="border border-[var(--border-dim)] p-4 sm:p-6 bg-[#3c324d]">
                <label className="block text-xs uppercase tracking-widest text-[var(--text-primary)] mb-4 font-mono">
                  {'>'} AUDIO SOURCE
                </label>
                
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <button
                    onClick={() => lipSync.setAudioSource('tts')}
                    disabled={lipSync.loadingLipSync || lipSync.loadingTTS}
                    className={`p-4 border text-center transition-all ${
                      lipSync.audioSource === 'tts'
                        ? 'border-[var(--accent-cyan)] bg-[var(--accent-cyan)] bg-opacity-10 text-[var(--accent-cyan)]'
                        : 'border-[var(--border-dim)] text-[var(--text-muted)] hover:border-[var(--text-secondary)]'
                    }`}
                  >
                    <div className="text-2xl mb-2">🔊</div>
                    <div className="text-xs uppercase tracking-wider font-mono">Text-to-Speech</div>
                  </button>
                  <button
                    onClick={() => lipSync.setAudioSource('upload')}
                    disabled={lipSync.loadingLipSync || lipSync.loadingTTS}
                    className={`p-4 border text-center transition-all ${
                      lipSync.audioSource === 'upload'
                        ? 'border-[var(--accent-cyan)] bg-[var(--accent-cyan)] bg-opacity-10 text-[var(--accent-cyan)]'
                        : 'border-[var(--border-dim)] text-[var(--text-muted)] hover:border-[var(--text-secondary)]'
                    }`}
                  >
                    <div className="text-2xl mb-2">📤</div>
                    <div className="text-xs uppercase tracking-wider font-mono">Upload Audio</div>
                  </button>
                </div>

                {/* TTS UI */}
                {lipSync.audioSource === 'tts' && (
                  <div className="space-y-4">
                    <TerminalInput
                      label="Voiceover Script"
                      placeholder="Enter the text for voiceover..."
                      multiline
                      rows={4}
                      value={lipSync.lipSyncScript}
                      onChange={(e) => lipSync.setLipSyncScript(e.target.value)}
                      disabled={lipSync.loadingTTS}
                      labelRight={
                        <button
                          onClick={lipSync.generateVoiceoverScript}
                          disabled={lipSync.generatingVoiceoverScript || !lipSync.lipSyncScript.trim()}
                          className="text-[10px] uppercase tracking-wider px-2 py-1 border border-[var(--border-dim)] text-[var(--text-muted)] hover:border-[var(--accent-cyan)] hover:text-[var(--accent-cyan)] transition-colors"
                        >
                          {lipSync.generatingVoiceoverScript ? 'GENERATING...' : 'ENHANCE SCRIPT'}
                        </button>
                      }
                    />

                    <div>
                      <label className="block text-xs uppercase tracking-widest text-[var(--text-primary)] mb-2 font-mono">
                        {'>'} Voice Selection
                      </label>
                      <select
                        value={lipSync.lipSyncVoice}
                        onChange={(e) => lipSync.setLipSyncVoice(e.target.value as any)}
                        disabled={lipSync.loadingTTS}
                        className="w-full bg-black bg-opacity-60 border border-[var(--border-dim)] text-[var(--text-primary)] px-4 py-3 text-sm font-mono focus:border-[var(--border-primary)] focus:outline-none transition-all"
                      >
                        <option value="alloy">Alloy</option>
                        <option value="echo">Echo</option>
                        <option value="fable">Fable</option>
                        <option value="onyx">Onyx</option>
                        <option value="nova">Nova</option>
                        <option value="shimmer">Shimmer</option>
                      </select>
                    </div>

                    <CostEstimate credits={lipSync.ttsCost} operation="TTS Generation" />

                    <GlowButton
                      onClick={lipSync.generateTTS}
                      disabled={lipSync.loadingTTS || !lipSync.lipSyncScript.trim()}
                      loading={lipSync.loadingTTS}
                      className="w-full"
                    >
                      {lipSync.loadingTTS ? 'GENERATING...' : '[ GENERATE VOICEOVER ]'}
                    </GlowButton>

                    {lipSync.generatedAudioUrl && (
                      <div className="border border-[var(--border-primary)] p-4 bg-black bg-opacity-60">
                        <p className="text-xs text-[var(--text-muted)] uppercase mb-2">Generated Audio</p>
                        <audio
                          ref={lipSync.audioRef}
                          src={lipSync.generatedAudioUrl}
                          controls
                          className="w-full"
                          onLoadedMetadata={lipSync.handleAudioLoaded}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Upload Audio UI */}
                {lipSync.audioSource === 'upload' && (
                  <div>
                    {!lipSync.lipSyncAudioUrl ? (
                      <label className="block">
                        <div className="border-2 border-dashed border-[var(--border-dim)] p-8 text-center cursor-pointer hover:border-[var(--accent-cyan)] transition-all">
                          <div className="text-4xl mb-2">🎵</div>
                          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Click to upload audio</p>
                          <p className="text-[10px] text-[var(--text-muted)] mt-2">MP3, WAV, OGG (Max 10MB)</p>
                        </div>
                        <input
                          type="file"
                          accept="audio/*"
                          onChange={lipSync.handleAudioFileChange}
                          disabled={lipSync.loadingLipSync}
                          className="hidden"
                        />
                      </label>
                    ) : (
                      <div>
                        <div className="border border-[var(--border-primary)] p-4 bg-black bg-opacity-60">
                          <p className="text-xs text-[var(--text-muted)] uppercase mb-2">Uploaded Audio</p>
                          <audio
                            ref={lipSync.audioRef}
                            src={lipSync.lipSyncAudioUrl}
                            controls
                            className="w-full"
                            onLoadedMetadata={lipSync.handleAudioLoaded}
                          />
                        </div>
                        <button
                          onClick={() => {
                            lipSync.handleAudioFileChange({ target: { files: null } } as any);
                          }}
                          className="mt-2 w-full border border-[var(--border-dim)] text-[var(--text-muted)] px-4 py-2 text-xs uppercase tracking-wider hover:border-[var(--text-primary)] hover:text-[var(--text-primary)] transition-all"
                        >
                          CLEAR AUDIO
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Generate Lip Sync */}
              <div className="space-y-4">
                <CostEstimate credits={lipSync.lipSyncCost} operation="Lip Sync Generation" />

                <GlowButton
                  onClick={lipSync.generateLipSync}
                  disabled={lipSync.loadingLipSync || !lipSync.lipSyncAudioUrl || !(lipSync.lipSyncImagePreview || lipSync.generatedAvatarUrl)}
                  loading={lipSync.loadingLipSync}
                  className="w-full"
                >
                  {lipSync.loadingLipSync ? `GENERATING... ${lipSync.lipSyncProgress}%` : '[ GENERATE LIP SYNC VIDEO ]'}
                </GlowButton>

                {lipSync.loadingLipSync && (
                  <ProgressBar progress={lipSync.lipSyncProgress} label="LIP SYNC PROGRESS" />
                )}

                {lipSync.lipSyncError && (
                  <div className="border border-[var(--accent-red)] bg-[var(--accent-red)] bg-opacity-10 p-4">
                    <div className="text-[#000] text-xs">{lipSync.lipSyncError}</div>
                  </div>
                )}

                {lipSync.lipSyncResult && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <h3 className="text-sm uppercase tracking-widest text-[var(--text-primary)] mb-4 font-mono">
                      {'>'} GENERATED LIP SYNC VIDEO
                    </h3>
                    <div className="border border-[var(--border-primary)] p-2 bg-black">
                      <video
                        src={lipSync.lipSyncResult}
                        controls
                        className="w-full"
                        autoPlay
                      />
                    </div>
                    <a
                      href={lipSync.lipSyncResult}
                      download
                      className="mt-4 block text-center border border-[var(--border-primary)] text-[var(--text-primary)] px-6 py-3 text-sm uppercase tracking-wider hover:bg-[var(--accent-cyan)] hover:bg-opacity-10 transition-all"
                    >
                      [ DOWNLOAD VIDEO ]
                    </a>
                  </motion.div>
                )}
              </div>
            </div>
          </TerminalPanel>

          {/* Model Selection Modal */}
          {lipSync.isModelModalOpen && typeof window !== 'undefined' && createPortal(
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center p-4 z-[9999]"
              onClick={() => lipSync.setIsModelModalOpen(false)}
            >
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-black border-2 border-[var(--accent-cyan)] p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
              >
                <h3 className="text-lg uppercase tracking-widest text-[var(--accent-cyan)] mb-4 font-mono">
                  {'>'} SELECT LIP SYNC MODEL
                </h3>
                <div className="space-y-3">
                  {lipSync.supportedLipSyncModels.map((model) => (
                    <button
                      key={model}
                      onClick={() => {
                        lipSync.setLipSyncModel(model);
                        lipSync.setIsModelModalOpen(false);
                      }}
                      className={`w-full p-4 border text-left transition-all ${
                        lipSync.lipSyncModel === model
                          ? 'border-[var(--accent-cyan)] bg-[var(--accent-cyan)] bg-opacity-10'
                          : 'border-[var(--border-dim)] hover:border-[var(--text-secondary)]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-[var(--text-primary)]">{lipSync.lipSyncModelLabels[model] || model}</span>
                        <span
                          className="text-[10px] px-2 py-1 rounded uppercase tracking-wide"
                          style={lipSync.statusStyles[(lipSync.modelStatuses[model] || 'unknown')]}
                        >
                          {lipSync.statusLabels[(lipSync.modelStatuses[model] || 'unknown')]}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => lipSync.setIsModelModalOpen(false)}
                  className="mt-4 w-full border border-[var(--border-dim)] text-[var(--text-muted)] px-4 py-3 text-sm uppercase tracking-wider hover:border-[var(--text-primary)] hover:text-[var(--text-primary)] transition-all"
                >
                  [ CLOSE ]
                </button>
              </motion.div>
            </motion.div>,
            document.body
          )}
        </motion.div>

        {/* Info Panel */}
        <TerminalPanel title="SYSTEM INFORMATION" corners={false} className="mt-8">
          <div className="text-xs space-y-2 text-[var(--text-muted)]">
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
              <span>Download promptly: all videos expire in ~1 hour</span>
            </div>
          </div>
        </TerminalPanel>
      </div>
    </div>
  );
}
