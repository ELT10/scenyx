import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { estimateChatUsdMicros } from '@/lib/pricing';
import { withCreditGuard, CreditGuardContext } from '@/lib/withCreditGuard';

const openai = new OpenAI({
  apiKey: process.env.OPEN_API_KEY,
});

type GenerateVoiceoverBody = {
  idea: string;
  duration?: number; // target duration in seconds
};

async function generateVoiceoverHandler(
  body: GenerateVoiceoverBody,
  _req: NextRequest,
  context: CreditGuardContext
) {
  const { idea, duration = 30 } = body;

  if (!idea || typeof idea !== 'string' || idea.trim().length === 0) {
    return {
      response: NextResponse.json({ error: 'Idea/description is required' }, { status: 400 }),
      usageUsdMicros: 0,
    };
  }

  try {
    // Estimate word count based on duration (average speaking rate: ~150 words/minute)
    const targetWordCount = Math.round((duration / 60) * 150);
    const wordRange = `${Math.max(50, targetWordCount - 30)}-${targetWordCount + 30}`;

    const openaiResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a professional voiceover scriptwriter specializing in concise, engaging scripts for text-to-speech narration.

Your scripts should be:
- Natural and conversational, optimized for AI voice delivery
- Clear and easy to understand when spoken aloud
- Emotionally engaging with a warm, friendly tone
- Free of complex punctuation or formatting that TTS can't handle well
- Appropriate length for the target duration (around ${duration} seconds)
- Target word count: ${wordRange} words

Guidelines:
- Use short to medium sentences for better TTS pacing
- Avoid abbreviations, acronyms, or special characters
- Write numbers as words (e.g., "twenty" not "20")
- Include natural pauses with commas and periods
- Focus on one clear message or story
- End with a memorable closing line or call-to-action if appropriate
- DO NOT include any stage directions, speaker labels, or meta-commentary
- Output ONLY the voiceover script text itself`,
        },
        {
          role: 'user',
          content: `Generate a ${duration}-second voiceover script based on this idea:

"${idea}"

Create an engaging, natural-sounding script that brings this concept to life. Make it compelling and suitable for AI text-to-speech narration.`,
        },
      ],
      temperature: 0.8,
      max_tokens: 400,
    });

    const script = openaiResponse.choices[0]?.message?.content?.trim() || idea;

    // Calculate actual cost
    const inputTokens = openaiResponse.usage?.prompt_tokens || 0;
    const outputTokens = openaiResponse.usage?.completion_tokens || 0;
    const usageUsdMicros = estimateChatUsdMicros('gpt-4o-mini', inputTokens, outputTokens);

    return {
      response: NextResponse.json({
        success: true,
        script: script,
        original_idea: idea,
        word_count: script.split(/\s+/).length,
        estimated_duration: Math.round((script.split(/\s+/).length / 150) * 60),
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_usd_micros: usageUsdMicros,
      }),
      usageUsdMicros,
    };
  } catch (error: any) {
    console.error('Generate voiceover script failed:', error);
    return {
      response: NextResponse.json(
        { error: 'Failed to generate script', details: error.message },
        { status: 500 }
      ),
      usageUsdMicros: 0,
    };
  }
}

// Estimate ~600 micros for safety (covers typical generation)
export const POST = withCreditGuard({
  estimateUsdMicros: async () => 600,
  runWithUsageUsdMicros: generateVoiceoverHandler,
});

