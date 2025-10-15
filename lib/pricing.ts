// Simple pricing map; extend as needed
export type ModelPricing = {
  inputPer1kUsdMicros?: number;
  outputPer1kUsdMicros?: number;
  imagePerUnitUsdMicros?: number;
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

export function estimateChatUsdMicros(model: string, inputTokens: number, outputTokens: number) {
  const p = PRICING[model];
  if (!p || !p.inputPer1kUsdMicros || !p.outputPer1kUsdMicros) return 0;
  const inputCost = Math.ceil((inputTokens / 1000) * p.inputPer1kUsdMicros);
  const outputCost = Math.ceil((outputTokens / 1000) * p.outputPer1kUsdMicros);
  return inputCost + outputCost;
}

export function estimateVideoUsdMicros(model: string, seconds: number, resolution: string = 'standard') {
  const key = `${model}-${resolution}`;
  const pricePerSecond = VIDEO_PRICING_PER_SECOND_USD_MICROS[key];
  if (!pricePerSecond) return 0;
  return Math.ceil(seconds * pricePerSecond);
}

// Lip Sync pricing (per second of output video)
export const LIPSYNC_PRICING_PER_SECOND_USD_MICROS: Record<string, number> = {
  'bytedance/omni-human': 140000,     // $0.14 per second
  'wan-video/wan-2.2-s2v': 20000,     // $0.02 per second
};

// Text-to-Speech pricing (OpenAI TTS)
export const TTS_PRICING_PER_1K_CHARS_USD_MICROS = 15000; // $0.015 per 1k chars

export function estimateLipSyncUsdMicros(model: string, seconds: number = 10): number {
  const pricePerSecond = LIPSYNC_PRICING_PER_SECOND_USD_MICROS[model];
  if (!pricePerSecond) return 200000; // Default to ~$0.20 for 10 seconds
  return Math.ceil(seconds * pricePerSecond);
}

export function estimateTTSUsdMicros(textLength: number): number {
  const chars = textLength;
  return Math.ceil((chars / 1000) * TTS_PRICING_PER_1K_CHARS_USD_MICROS);
}


