import OpenAI from 'openai';

export const openai = new OpenAI({ apiKey: process.env.OPEN_API_KEY });

export type ChatUsage = { inputTokens: number; outputTokens: number; usdMicros: number };

export async function chatWithUsage(params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming) {
  const res = await openai.chat.completions.create(params as any);
  // The SDK returns usage only for non-streaming requests
  const usage: any = (res as any).usage || {};
  const inputTokens = usage.prompt_tokens ?? 0;
  const outputTokens = usage.completion_tokens ?? 0;
  return { res, usage: { inputTokens, outputTokens } };
}


