import { NextRequest, NextResponse } from 'next/server';
import { withCreditGuard } from '@/lib/withCreditGuard';
import { estimateTTSUsdMicros } from '@/lib/pricing';
import { openai } from '@/lib/openai';

export const POST = withCreditGuard<{
  text?: string;
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
}>({
  estimateUsdMicros: async ({ text = '' }) => {
    return estimateTTSUsdMicros(text.length);
  },
  runWithUsageUsdMicros: async ({ text, voice = 'alloy' }, _req, context) => {
    if (!text || text.trim().length === 0) {
      const res = NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
      return { response: res, usageUsdMicros: 0 };
    }

    if (text.length > 4096) {
      const res = NextResponse.json(
        { error: 'Text too long. Maximum 4096 characters.' },
        { status: 400 }
      );
      return { response: res, usageUsdMicros: 0 };
    }

    try {
      console.log('Generating TTS for text length:', text.length, 'voice:', voice);

      // Generate speech using OpenAI TTS
      const mp3Response = await openai.audio.speech.create({
        model: 'tts-1',
        voice: voice,
        input: text,
      });

      // Convert to buffer
      const buffer = Buffer.from(await mp3Response.arrayBuffer());
      const base64Audio = buffer.toString('base64');

      console.log('TTS generated successfully. Size:', buffer.length, 'bytes');

      const res = NextResponse.json({
        success: true,
        audio_data: `data:audio/mp3;base64,${base64Audio}`,
        text_length: text.length,
        voice: voice,
      });

      const usageUsdMicros = estimateTTSUsdMicros(text.length);
      return { response: res, usageUsdMicros };
    } catch (error: any) {
      console.error('TTS generation failed:', error);
      const res = NextResponse.json(
        { error: error.message || 'Failed to generate audio' },
        { status: 500 }
      );
      return { response: res, usageUsdMicros: 0 };
    }
  },
});

