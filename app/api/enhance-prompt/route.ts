import { NextRequest, NextResponse } from 'next/server';
import { withCreditGuard } from '@/lib/withCreditGuard';
import { estimateChatUsdMicros } from '@/lib/pricing';

type Body = {
  prompt?: string;
  seconds?: string; // "4" | "8" | "12"
  orientation?: 'horizontal' | 'vertical';
  quality?: 'nano' | 'mini' | 'high';
};

const QUALITY_MODEL_MAP: Record<string, string> = {
  nano: 'gpt-5-nano',
  mini: 'gpt-5-mini',
  high: 'gpt-5',
};

export const POST = withCreditGuard<Body>({
  estimateUsdMicros: async ({ prompt = '', quality = 'mini' }) => {
    const model = QUALITY_MODEL_MAP[quality] || QUALITY_MODEL_MAP['mini'];
    // Rough token estimate based on input length; include buffer for guidance
    const approxInputTokens = Math.min(4000, Math.max(800, Math.ceil(prompt.length / 4) + 1200));
    const approxOutputTokens = 1200; // Target concise but structured enhanced prompt
    return estimateChatUsdMicros(model, approxInputTokens, approxOutputTokens);
  },
  runWithUsageUsdMicros: async ({ prompt, seconds = '12', orientation = 'horizontal', quality = 'mini' }, _req: NextRequest) => {
    if (!prompt || !prompt.trim()) {
      const res = NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
      return { response: res, usageUsdMicros: 0 };
    }

    const secsNum = parseInt(seconds as string, 10);
    const secs = Number.isFinite(secsNum) ? secsNum : 12;
    const model = QUALITY_MODEL_MAP[quality] || QUALITY_MODEL_MAP['mini'];

    const systemMessage = `You are a senior video prompt specialist for OpenAI Sora 2. Enhance user prompts into a single, production-ready prompt that reliably guides the model.

Follow these constraints inspired by the Sora 2 Prompting Guide:
- Keep API parameters out of the prose (no mentions of model, size, seconds, resolution). Those are set separately.
- Aim for one clear camera setup and one clear subject action per shot; avoid excessive complexity.
- Use concrete, visual nouns and verbs. Avoid vague words like "beautiful" without specifics.
- Respect duration: for 4s keep action minimal; 8s allows 2–3 beats; 12s can include a short sequence but still single-shot logic.
- Prefer diegetic ambience for sound cues; avoid non-diegetic score unless requested.
- Provide a compact structure:
  1) Prose scene description (concise, vivid)
  2) Cinematography: camera, lens feel or DOF, lighting + palette, mood
  3) Actions: 1–3 timed beats that fit the seconds
  4) Dialogue: only if present in the user prompt (short, natural)
  5) Background Sound: subtle ambience cues
- Keep length tight and immediately usable as a single Sora prompt. Do not output explanations or markdown.
`;

    const userMessage = `Original prompt/script:\n${prompt}\n\nTarget clip duration: ${secs}s\nOrientation: ${orientation}.\nRewrite and enhance into the described structure. Preserve the user’s intent and subject matter while making framing, motion, lighting, palette, and sound cues specific and achievable within ${secs}s. Output only the enhanced prompt text.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPEN_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage },
        ],
        temperature: 1,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({} as any));
      const res = NextResponse.json({ error: errorData?.error?.message || 'Failed to enhance prompt', details: errorData }, { status: response.status });
      return { response: res, usageUsdMicros: 0 };
    }

    const data = await response.json();
    const enhancedPrompt: string = data?.choices?.[0]?.message?.content?.trim() || '';
    if (!enhancedPrompt) {
      const res = NextResponse.json({ error: 'Empty enhancement result' }, { status: 500 });
      return { response: res, usageUsdMicros: 0 };
    }

    const usage = data?.usage || {};
    const inputTokens = usage.prompt_tokens ?? 2000;
    const outputTokens = usage.completion_tokens ?? 1200;
    const usageUsdMicros = estimateChatUsdMicros(model, inputTokens, outputTokens);

    const res = NextResponse.json({ success: true, enhancedPrompt });
    return { response: res, usageUsdMicros };
  }
});


