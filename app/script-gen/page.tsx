'use client';

import { motion } from 'framer-motion';
import { useScriptGeneration } from '@/lib/hooks/useScriptGeneration';
import TerminalPanel from '@/components/TerminalPanel';
import GlowButton from '@/components/GlowButton';
import DataGrid from '@/components/DataGrid';
import BackgroundEffects from '@/components/BackgroundEffects';
import TerminalInput from '@/components/TerminalInput';
import CostEstimate from '@/components/CostEstimate';

export default function ScriptGenPage() {
  const script = useScriptGeneration();

  return (
    <div className="min-h-screen relative pb-24 sm:pb-20">
      <BackgroundEffects />

      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
        >
          <TerminalPanel title="SCRIPT GENERATION MODULE FOR ADS" status="active">
            <div className="space-y-6">
              <DataGrid columns={2} gap="md">
                <TerminalInput
                  label="COMPANY/PRODUCT NAME"
                  placeholder="Enter company or product name..."
                  value={script.companyName}
                  onChange={(e) => script.setCompanyName(e.target.value)}
                  disabled={script.loadingIdeas || script.loadingScript}
                />

                <TerminalInput
                  label="PRODUCT/COMPANY TYPE"
                  placeholder="Enter product or company type..."
                  value={script.companyType}
                  onChange={(e) => script.setCompanyType(e.target.value)}
                  disabled={script.loadingIdeas || script.loadingScript}
                />
              </DataGrid>

              <TerminalInput
                label="PRODUCT SPECIFICATIONS (OPTIONAL)"
                placeholder="Enter detailed product description..."
                multiline
                rows={3}
                value={script.productDescription}
                onChange={(e) => script.setProductDescription(e.target.value)}
                disabled={script.loadingIdeas || script.loadingScript}
              />

              <div className="space-y-4">
                <DataGrid columns={2} gap="md">
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-[var(--text-primary)] mb-2 font-mono">
                      {'>'} GENERATION QUALITY LEVEL
                    </label>
                    <select
                      value={script.scriptQuality}
                      onChange={(e) => script.setScriptQuality(e.target.value as 'nano' | 'mini' | 'high')}
                      disabled={script.loadingIdeas || script.loadingScript}
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
                      value={script.scriptDuration}
                      onChange={(e) => script.setScriptDuration(e.target.value as '4' | '8' | '12')}
                      disabled={script.loadingIdeas || script.loadingScript}
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
                    value={script.orientation}
                    onChange={(e) => script.setOrientation(e.target.value as 'vertical' | 'horizontal')}
                    disabled={script.loadingIdeas || script.loadingScript}
                    className="w-full bg-black bg-opacity-60 border border-[var(--border-dim)] text-[var(--text-primary)] px-4 py-3 text-sm font-mono focus:border-[var(--border-primary)] focus:outline-none transition-all"
                  >
                    <option value="horizontal">[ HORIZONTAL ] 1280x720</option>
                    <option value="vertical">[ VERTICAL ] 720x1280</option>
                  </select>
                </div>
              </div>

              <TerminalInput
                label="CUSTOM IDEA (OPTIONAL)"
                placeholder="Enter your own creative idea or concept..."
                multiline
                rows={2}
                value={script.customIdea}
                onChange={(e) => script.setCustomIdea(e.target.value)}
                disabled={script.loadingIdeas || script.loadingScript}
              />

              {/* Advanced Options Collapsible Section */}
              <div className="border border-[var(--border-dim)] bg-black bg-opacity-30">
                <button
                  type="button"
                  onClick={() => script.setShowAdvanced(!script.showAdvanced)}
                  className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-[var(--text-primary)] hover:bg-opacity-5 transition-colors"
                  disabled={script.loadingIdeas || script.loadingScript}
                >
                  <span className="text-xs uppercase tracking-widest text-[var(--text-muted)] font-mono">
                    {'>'} ADVANCED OPTIONS
                  </span>
                  <span className="text-[var(--text-muted)] text-sm">
                    {script.showAdvanced ? '[ − ]' : '[ + ]'}
                  </span>
                </button>
                
                {script.showAdvanced && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="px-4 pb-4 space-y-4 border-t border-[var(--border-dim)]"
                  >
                    <div className="pt-4">
                      <p className="text-xs text-[var(--text-muted)] mb-4">
                        These optional fields help generate more targeted scripts. Leave empty to let AI determine the best approach.
                      </p>
                      
                      <TerminalInput
                        label="TARGET AUDIENCE"
                        placeholder="e.g., Young professionals aged 25-35, busy parents, fitness enthusiasts..."
                        value={script.targetAudience}
                        onChange={(e) => script.setTargetAudience(e.target.value)}
                        disabled={script.loadingIdeas || script.loadingScript}
                      />
                    </div>

                    <TerminalInput
                      label="PROBLEM / PAIN POINT"
                      placeholder="e.g., Struggling with hair fall, lack of time for self-care, expensive alternatives..."
                      multiline
                      rows={2}
                      value={script.audienceProblem}
                      onChange={(e) => script.setAudienceProblem(e.target.value)}
                      disabled={script.loadingIdeas || script.loadingScript}
                    />

                    <TerminalInput
                      label="CALL TO ACTION (CTA)"
                      placeholder="e.g., Shop Now, Try Free for 7 Days, Visit our website, Download the app..."
                      value={script.callToAction}
                      onChange={(e) => script.setCallToAction(e.target.value)}
                      disabled={script.loadingIdeas || script.loadingScript}
                    />
                  </motion.div>
                )}
              </div>

              {!script.customIdea.trim() ? (
                <CostEstimate 
                  credits={script.ideasCost} 
                  operation="Idea Generation" 
                />
              ) : (
                <CostEstimate 
                  credits={script.scriptCost} 
                  operation="Script Generation" 
                />
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                {!script.customIdea.trim() ? (
                  <GlowButton
                    onClick={script.generateIdeas}
                    disabled={script.loadingIdeas || !script.companyName.trim() || !script.companyType.trim()}
                    loading={script.loadingIdeas}
                    className="flex-1"
                  >
                    {script.loadingIdeas ? 'GENERATING...' : '[ GENERATE IDEAS ]'}
                  </GlowButton>
                ) : (
                  <GlowButton
                    onClick={script.handleCustomIdeaSubmit}
                    disabled={script.loadingScript || !script.companyName.trim() || !script.companyType.trim()}
                    loading={script.loadingScript}
                    className="flex-1"
                  >
                    {script.loadingScript ? 'PROCESSING...' : '[ GENERATE SCRIPT ]'}
                  </GlowButton>
                )}
              </div>

              {script.scriptError && (
                <div className="border border-[var(--accent-red)] bg-[var(--accent-red)] bg-opacity-10 p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-[#000] text-xl">⚠</span>
                    <div>
                      <div className="text-[#000] font-bold text-sm uppercase mb-1">ERROR</div>
                      <div className="text-[#000] text-xs">{script.scriptError}</div>
                    </div>
                  </div>
                </div>
              )}

              {script.ideas.length > 0 && !script.customIdea && (
                <div>
                  <h3 className="text-sm uppercase tracking-widest text-[var(--text-primary)] mb-4 font-mono">
                    {'>'} SELECT AN IDEA
                  </h3>
                  <DataGrid columns={2} gap="md">
                    {script.ideas.map((idea) => (
                      <button
                        key={idea.id}
                        onClick={() => script.handleIdeaSelect(idea)}
                        disabled={script.loadingScript}
                        className={`
                          p-4 border text-left transition-all
                          ${script.selectedIdea?.id === idea.id
                            ? 'border-[var(--border-primary)] bg-[var(--text-primary)] bg-opacity-5 '
                            : 'border-[var(--border-dim)] hover:border-[var(--text-secondary)] '
                          }
                          disabled:opacity-30 disabled:cursor-not-allowed
                        `}
                      >
                        <h4 className={`font-bold text-sm mb-2 uppercase tracking-wide ${script.selectedIdea?.id === idea.id ? 'text-[#000000]' : 'text-[var(--text-primary)]'}`}>
                          {idea.title}
                        </h4>
                        <p className="text-[var(--text-muted)] text-xs leading-relaxed">
                          {idea.description}
                        </p>
                      </button>
                    ))}
                  </DataGrid>
                  <CostEstimate 
                    credits={script.scriptCost} 
                    operation="Script Generation" 
                    className="mt-4"
                  />
                </div>
              )}

              {script.loadingScript && (
                <div className="border border-[var(--accent-cyan)] bg-[var(--accent-cyan)] bg-opacity-5 p-4">
                  <div className="flex items-center gap-3">
                    <div className="loading-bar w-full"></div>
                  </div>
                  <div className="text-[var(--accent-cyan)] text-xs uppercase mt-2 tracking-wider">
                    PROCESSING SCRIPT GENERATION...
                  </div>
                </div>
              )}

              {script.generatedScript && (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm uppercase tracking-widest text-[var(--text-primary)] font-mono">
                      {'>'} GENERATED SCRIPT OUTPUT
                    </h3>
                    <GlowButton
                      onClick={script.generateVideoFromScript}
                      variant="primary"
                    >
                      [ GENERATE VIDEO ]
                    </GlowButton>
                  </div>
                  <div className="border border-[var(--border-primary)] bg-black bg-opacity-60 p-6">
                    <pre className="whitespace-pre-wrap font-mono text-xs text-[var(--text-primary)] leading-relaxed">
                      {script.generatedScript}
                    </pre>
                  </div>
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
              <span>Enter Company/Product Name (eg.CocoGold), Company/Product Type (eg.Hair Oil), and a Description</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[var(--text-primary)]">{'>'}</span>
              <span>Select Generation Quality, Video Duration, and Video Orientation</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[var(--text-primary)]">{'>'}</span>
              <span>Expand Advanced Options to specify Target Audience, Pain Points, and CTA for better results</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[var(--text-primary)]">{'>'}</span>
              <span>Leave Custom Idea empty and click [ GENERATE IDEAS ] for AI suggestions</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[var(--text-primary)]">{'>'}</span>
              <span>Select an idea to auto-generate a script, or enter a custom idea and click [ GENERATE SCRIPT ]</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[var(--text-primary)]">{'>'}</span>
              <span>Review the output and click [ GENERATE VIDEO ] to send it to Video Gen</span>
            </div>
          </div>
        </TerminalPanel>
      </div>
    </div>
  );
}
