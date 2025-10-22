import { NextRequest, NextResponse } from 'next/server';
import { withCreditGuard, CreditGuardContext } from '@/lib/withCreditGuard';
import { estimateAvatarUsdMicros } from '@/lib/pricing';

/**
 * POST /api/generate-avatar
 * 
 * Generates an AI avatar using Google Imagen-4-fast via Replicate
 * Cost: $0.04 per image
 */

type GenerateAvatarBody = {
  prompt: string;
  aspect_ratio?: string;
  avatar_type?: 'face' | 'full-body';
  pollForCompletion?: boolean;
};

async function generateAvatarHandler(
  body: GenerateAvatarBody,
  req: NextRequest,
  context: CreditGuardContext
) {
  const { prompt, aspect_ratio = '4:3', avatar_type = 'face', pollForCompletion = true } = body;

  if (!prompt || typeof prompt !== 'string') {
    return {
      response: NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      ),
      usageUsdMicros: 0,
    };
  }

  const replicateToken = process.env.REPLIT_KEY;
  if (!replicateToken) {
    console.error('REPLIT_KEY is not set');
    return {
      response: NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      ),
      usageUsdMicros: 0,
    };
  }

  // Enhance prompt based on avatar type and imagenpromptguide best practices
  const enhancedPrompt = generatePortraitPrompt(prompt, avatar_type);

  console.log('[generate-avatar] Calling Replicate API with enhanced prompt:', enhancedPrompt);

  try {
    // Call Replicate API to create prediction
    const response = await fetch(
      'https://api.replicate.com/v1/models/google/imagen-4-fast/predictions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${replicateToken}`,
          'Content-Type': 'application/json',
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
      return {
        response: NextResponse.json(
          { error: 'Failed to generate avatar', details: errorText },
          { status: response.status }
        ),
        usageUsdMicros: 0,
      };
    }

    let prediction = await response.json();
    console.log('[generate-avatar] Initial prediction created:', prediction.id, 'Status:', prediction.status);

    const predictionId = prediction.id;

    // If client wants to poll, return immediately
    if (!pollForCompletion) {
      return {
        response: NextResponse.json({
          success: true,
          prediction_id: predictionId,
          status: prediction.status,
          message: 'Avatar generation started',
        }),
        usageUsdMicros: estimateAvatarUsdMicros(),
      };
    }

    // Server-side polling: Wait for completion
    const maxAttempts = 60; // 5 minutes max (5 seconds * 60)
    let attempts = 0;

    while (
      (prediction.status === 'starting' || prediction.status === 'processing') &&
      attempts < maxAttempts
    ) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      
      // Poll the prediction status
      const statusUrl = `https://api.replicate.com/v1/predictions/${predictionId}`;
      const statusResponse = await fetch(statusUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${replicateToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!statusResponse.ok) {
        console.error('[generate-avatar] Failed to poll status:', statusResponse.status);
        break;
      }

      prediction = await statusResponse.json();
      attempts++;
      console.log(`[generate-avatar] Poll attempt ${attempts}: Status = ${prediction.status}`);
    }

    // Extract image URL from completed prediction
    let imageUrl: string | null = null;
    
    if (prediction.status === 'succeeded' && prediction.output) {
      if (typeof prediction.output === 'string') {
        imageUrl = prediction.output;
      } else if (Array.isArray(prediction.output) && prediction.output.length > 0) {
        imageUrl = prediction.output[0];
      } else if (typeof prediction.output === 'object' && prediction.output.url) {
        imageUrl = prediction.output.url;
      }
    }

    if (!imageUrl) {
      if (prediction.status === 'failed') {
        return {
          response: NextResponse.json(
            { error: 'Avatar generation failed', details: prediction.error || 'Unknown error' },
            { status: 500 }
          ),
          usageUsdMicros: 0,
        };
      } else if (attempts >= maxAttempts) {
        return {
          response: NextResponse.json(
            { error: 'Avatar generation timed out after 5 minutes' },
            { status: 500 }
          ),
          usageUsdMicros: 0,
        };
      } else {
        return {
          response: NextResponse.json(
            { error: `No image URL in ${prediction.status} prediction` },
            { status: 500 }
          ),
          usageUsdMicros: 0,
        };
      }
    }

    console.log('[generate-avatar] Image URL:', imageUrl);
    console.log('[generate-avatar] Final status:', prediction.status);

    // Return completed result
    return {
      response: NextResponse.json({
        success: true,
        image_url: imageUrl,
        prediction_id: predictionId,
        status: 'succeeded',
      }),
      usageUsdMicros: estimateAvatarUsdMicros(),
    };
  } catch (error: unknown) {
    console.error('[generate-avatar] Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      response: NextResponse.json(
        { error: 'Internal server error', details: message },
        { status: 500 }
      ),
      usageUsdMicros: 0,
    };
  }
}

/**
 * Enhances user prompt based on avatar type
 * Based on imagenpromptguide.md best practices:
 * - Descriptive language with detailed adjectives
 * - Clear subject definition
 * - Context and background
 * - Orientation and framing
 * - Detail focus based on type
 */
function generatePortraitPrompt(userInput: string, avatarType: 'face' | 'full-body' = 'face'): string {
  // Clean the user input
  const cleanInput = userInput.trim();
  
  if (avatarType === 'face') {
    // Portrait/headshot style - focus on facial details
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
  } else {
    // Full body style - focus on complete figure with hands visible
    const fullBodyElements = [
      'professional full body photograph',
      cleanInput,
      'full length shot',
      'head to toe',
      'complete figure visible',
      'both hands clearly visible',
      'arms at sides or in natural pose',
      'natural standing pose',
      'clear details throughout',
      'neutral studio background',
      'even professional lighting',
      'high quality',
      'photorealistic',
    ];
    return fullBodyElements.join(', ');
  }
}

// Wrap with credit guard: $0.04 = 40,000 usd_micros
export const POST = withCreditGuard({
  estimateUsdMicros: async (body: GenerateAvatarBody) => estimateAvatarUsdMicros(),
  runWithUsageUsdMicros: generateAvatarHandler,
});

