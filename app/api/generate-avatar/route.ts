import { NextRequest, NextResponse } from 'next/server';
import { withCreditGuard } from '@/lib/withCreditGuard';

/**
 * POST /api/generate-avatar
 * 
 * Generates an AI avatar using Google Imagen-4-fast via Replicate
 * Cost: $0.04 per image
 */
async function generateAvatarHandler(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, aspect_ratio = '4:3' } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    const replicateToken = process.env.REPLICATE_API_TOKEN;
    if (!replicateToken) {
      console.error('REPLICATE_API_TOKEN is not set');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Enhance prompt for portrait generation based on imagenpromptguide best practices
    const enhancedPrompt = generatePortraitPrompt(prompt);

    console.log('[generate-avatar] Calling Replicate API with enhanced prompt:', enhancedPrompt);

    // Call Replicate API with Prefer: wait to get immediate result
    const response = await fetch(
      'https://api.replicate.com/v1/models/google/imagen-4-fast/predictions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${replicateToken}`,
          'Content-Type': 'application/json',
          'Prefer': 'wait',
        },
        body: JSON.stringify({
          input: {
            prompt: enhancedPrompt,
            aspect_ratio: aspect_ratio,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[generate-avatar] Replicate API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to generate avatar', details: errorText },
        { status: response.status }
      );
    }

    const result = await response.json();
    console.log('[generate-avatar] Replicate API response:', JSON.stringify(result, null, 2));

    // With Prefer: wait, we should get the output directly
    if (result.status === 'succeeded' && result.output && result.output.length > 0) {
      return NextResponse.json({
        success: true,
        image_url: result.output[0], // Imagen returns an array of image URLs
        prediction_id: result.id,
      });
    } else if (result.status === 'failed') {
      return NextResponse.json(
        { error: 'Avatar generation failed', details: result.error },
        { status: 500 }
      );
    } else {
      // If for some reason we didn't get immediate result, return prediction_id for polling
      return NextResponse.json({
        success: true,
        prediction_id: result.id,
        status: result.status,
      });
    }
  } catch (error: unknown) {
    console.error('[generate-avatar] Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Internal server error', details: message },
      { status: 500 }
    );
  }
}

/**
 * Enhances user prompt with portrait-specific details
 * Based on imagenpromptguide.md best practices:
 * - Descriptive language with detailed adjectives
 * - Clear subject definition (portrait/headshot)
 * - Context and background (neutral/studio)
 * - Front-facing orientation
 * - Facial details focus
 */
function generatePortraitPrompt(userInput: string): string {
  // Clean the user input
  const cleanInput = userInput.trim();
  
  // Build a comprehensive portrait prompt
  const portraitElements = [
    'professional portrait photograph',
    cleanInput,
    'front-facing view',
    'looking directly at camera',
    'clear facial features',
    'detailed face',
    'sharp focus on face',
    'neutral studio background',
    'soft professional lighting',
    'high quality',
    'photorealistic',
  ];

  return portraitElements.join(', ');
}

// Wrap with credit guard: $0.04 = 40,000 usd_micros
export const POST = withCreditGuard(generateAvatarHandler, 40000);

