// Client-side pricing calculator (mirrors backend pricing.ts)
// Shows users estimated cost before they click generate

export type ModelPricing = {
  inputPer1kUsdMicros?: number;
  outputPer1kUsdMicros?: number;
  videoPerSecondUsdMicros?: number;
};

// Pricing per 1k tokens (converted from OpenAI's per 1M token pricing)
// GPT-5: $1.25/1M input, $10.00/1M output
// GPT-5-mini: $0.25/1M input, $2.00/1M output
// GPT-5-nano: $0.05/1M input, $0.40/1M output
export const PRICING: Record<string, ModelPricing> = {
  'gpt-5': { inputPer1kUsdMicros: 1250, outputPer1kUsdMicros: 10000 },           // $1.25/1M → $0.00125/1k
  'gpt-5-mini': { inputPer1kUsdMicros: 250, outputPer1kUsdMicros: 2000 },        // $0.25/1M → $0.00025/1k
  'gpt-5-nano': { inputPer1kUsdMicros: 50, outputPer1kUsdMicros: 400 },          // $0.05/1M → $0.00005/1k
};

// Video pricing per second varies by resolution
// Sora-2: 720x1280 or 1280x720 = $0.10/second
// Sora-2-Pro standard (720x1280 or 1280x720) = $0.30/second
// Sora-2-Pro high (1024x1792 or 1792x1024) = $0.50/second
export const VIDEO_PRICING_PER_SECOND_USD_MICROS: Record<string, number> = {
  'sora-2-standard': 100000,      // $0.10/second
  'sora-2-high': 100000,          // $0.10/second (sora-2 only has one resolution)
  'sora-2-pro-standard': 300000,  // $0.30/second
  'sora-2-pro-high': 500000,      // $0.50/second
};

export const QUALITY_MODEL_MAP: Record<string, string> = {
  'nano': 'gpt-5-nano',
  'mini': 'gpt-5-mini',
  'high': 'gpt-5',
};

// Default conversion: 1 credit = $0.70 OpenAI spend
// This means $1 of OpenAI usage = 1/0.70 = ~1.43 credits
const DEFAULT_CREDIT_USD_VALUE = 0.70;

/**
 * Calculate estimated credits for chat/text generation
 */
export function estimateChatCredits(quality: string, estimatedInputTokens: number = 1000, estimatedOutputTokens: number = 1500): number {
  const model = QUALITY_MODEL_MAP[quality] || QUALITY_MODEL_MAP['mini'];
  const p = PRICING[model];
  
  if (!p || !p.inputPer1kUsdMicros || !p.outputPer1kUsdMicros) return 0;
  
  const inputCostMicros = Math.ceil((estimatedInputTokens / 1000) * p.inputPer1kUsdMicros);
  const outputCostMicros = Math.ceil((estimatedOutputTokens / 1000) * p.outputPer1kUsdMicros);
  const totalUsdMicros = inputCostMicros + outputCostMicros;
  
  // Convert USD to credits using factor
  const totalUsd = totalUsdMicros / 1_000_000;
  const credits = totalUsd / DEFAULT_CREDIT_USD_VALUE;
  
  return Math.ceil(credits * 1_000_000) / 1_000_000; // Round up to 6 decimals
}

/**
 * Calculate estimated credits for video generation
 */
export function estimateVideoCredits(model: string, seconds: number, resolution: string = 'standard'): number {
  const key = `${model}-${resolution}`;
  const pricePerSecond = VIDEO_PRICING_PER_SECOND_USD_MICROS[key];
  
  if (!pricePerSecond) return 0;
  
  const totalUsdMicros = Math.ceil(seconds * pricePerSecond);
  
  // Convert USD to credits using factor
  const totalUsd = totalUsdMicros / 1_000_000;
  const credits = totalUsd / DEFAULT_CREDIT_USD_VALUE;
  
  return Math.ceil(credits * 1_000_000) / 1_000_000; // Round up to 6 decimals
}

/**
 * Format credits for display
 */
export function formatCredits(credits: number): string {
  if (credits < 0.01) return '< 0.01';
  if (credits < 1) return credits.toFixed(3);
  return credits.toFixed(2);
}

/**
 * Format USD for display
 */
export function formatUsd(usdMicros: number): string {
  const usd = usdMicros / 1_000_000;
  if (usd < 0.01) return '< $0.01';
  return `$${usd.toFixed(2)}`;
}

/**
 * Get model display name
 */
export function getModelDisplayName(quality: string): string {
  return QUALITY_MODEL_MAP[quality] || quality;
}

// Lip Sync pricing (per second of output video)
export const LIPSYNC_PRICING_PER_SECOND_USD_MICROS: Record<string, number> = {
  'bytedance/omni-human': 140000,     // $0.14 per second
  'wan-video/wan-2.2-s2v': 20000,     // $0.02 per second
};

export const TTS_PRICING_PER_1K_CHARS_USD_MICROS = 15000;

// Avatar generation pricing (Google Imagen-4-fast via Replicate)
export const AVATAR_GENERATION_USD_MICROS = 38000; // $0.038 per image

export function estimateLipSyncCredits(model: string, seconds: number = 10): number {
  const pricePerSecond = LIPSYNC_PRICING_PER_SECOND_USD_MICROS[model];
  const priceUsdMicros = pricePerSecond 
    ? Math.ceil(seconds * pricePerSecond)
    : 200000; // Default to ~$0.20 for 10 seconds
  const totalUsd = priceUsdMicros / 1_000_000;
  const credits = totalUsd / DEFAULT_CREDIT_USD_VALUE;
  return Math.ceil(credits * 1_000_000) / 1_000_000;
}

export function estimateTTSCredits(textLength: number): number {
  const chars = textLength;
  const costUsdMicros = Math.ceil((chars / 1000) * TTS_PRICING_PER_1K_CHARS_USD_MICROS);
  const totalUsd = costUsdMicros / 1_000_000;
  const credits = totalUsd / DEFAULT_CREDIT_USD_VALUE;
  return Math.ceil(credits * 1_000_000) / 1_000_000;
}

export function estimateAvatarCredits(): number {
  const totalUsd = AVATAR_GENERATION_USD_MICROS / 1_000_000;
  const credits = totalUsd / DEFAULT_CREDIT_USD_VALUE;
  return Math.ceil(credits * 1_000_000) / 1_000_000;
}

