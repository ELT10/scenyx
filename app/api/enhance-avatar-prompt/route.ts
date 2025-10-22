import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import OpenAI from 'openai';
import { estimateChatUsdMicros } from '@/lib/pricing';
import { withCreditGuard, CreditGuardContext } from '@/lib/withCreditGuard';

const openai = new OpenAI({
  apiKey: process.env.OPEN_API_KEY,
});

type EnhanceBody = {
  prompt: string;
};

async function enhancePromptHandler(
  body: EnhanceBody,
  _req: NextRequest,
  context: CreditGuardContext
) {
  const { prompt } = body;

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return {
      response: NextResponse.json({ error: 'Prompt is required' }, { status: 400 }),
      usageUsdMicros: 0,
    };
  }

  try {
    const openaiResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert image prompt engineer for Google Imagen. Enhance user prompts for professional portrait/avatar generation.

Follow these guidelines from the Imagen Prompting Guide:
- Maximum prompt length: 480 tokens. Keep enhanced prompts concise yet detailed.
- Structure: Start with subject (person description), then context/background, then style (photorealistic portrait).
- Use descriptive language: Detailed adjectives and adverbs for clear visualization.
- Provide context: Include neutral studio background, front-facing view, looking at camera.
- Focus on facial details: Emphasize clear facial features, sharp focus on face, professional lighting.
- Style: Photorealistic, high quality, professional portrait photograph.
- Subject: Enhance the user's description of the person (age, ethnicity, expression, clothing, etc.) while preserving intent.
- Avoid complexity: One clear subject, simple composition.
- Output ONLY the enhanced prompt text. No explanations or markdown.`,
        },
        {
          role: 'user',
          content: `Enhance this prompt for a professional AI avatar/portrait: "${prompt}"

Make it vivid, detailed, and optimized for Imagen-4-fast. Focus on facial details and photorealism.`,
        },
      ],
      temperature: 0.7,
      max_tokens: 200,
    });

    const enhancedPrompt = openaiResponse.choices[0]?.message?.content?.trim() || prompt;

    // Calculate actual cost
    const inputTokens = openaiResponse.usage?.prompt_tokens || 0;
    const outputTokens = openaiResponse.usage?.completion_tokens || 0;
    const usageUsdMicros = estimateChatUsdMicros('gpt-4o-mini', inputTokens, outputTokens);

    return {
      response: NextResponse.json({
        success: true,
        enhanced_prompt: enhancedPrompt,
        original_prompt: prompt,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_usd_micros: usageUsdMicros,
      }),
      usageUsdMicros,
    };
  } catch (error: any) {
    console.error('Enhance avatar prompt failed:', error);
    return {
      response: NextResponse.json(
        { error: 'Failed to enhance prompt', details: error.message },
        { status: 500 }
      ),
      usageUsdMicros: 0,
    };
  }
}

// Estimate ~500 micros for safety (covers typical enhancement)
export const POST = withCreditGuard({
  estimateUsdMicros: async () => 500,
  runWithUsageUsdMicros: enhancePromptHandler,
});
