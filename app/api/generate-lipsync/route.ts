import { NextRequest, NextResponse } from 'next/server';
import { withCreditGuard } from '@/lib/withCreditGuard';
import { estimateLipSyncUsdMicros } from '@/lib/pricing';
import { createVideoGeneration } from '@/lib/videoGenerations';

// Support both env var names
const replicateApiToken = process.env.REPLICATE_API_TOKEN || process.env.REPLIT_KEY;

export const POST = withCreditGuard<{
  imageUrl?: string;
  audioUrl?: string;
  model?: string;
  prompt?: string;
  audioDuration?: number;
  pollForCompletion?: boolean;
}>({
  estimateUsdMicros: async ({ model = 'wan-video/wan-2.2-s2v', audioDuration = 10 }) => {
    return estimateLipSyncUsdMicros(model, audioDuration);
  },
  runWithUsageUsdMicros: async (
    { imageUrl, audioUrl, model = 'wan-video/wan-2.2-s2v', prompt, audioDuration = 10, pollForCompletion = false },
    _req,
    context
  ) => {
    if (!imageUrl || !audioUrl) {
      const res = NextResponse.json(
        { error: 'Image and audio are required' },
        { status: 400 }
      );
      return { response: res, usageUsdMicros: 0 };
    }

    if (!replicateApiToken) {
      const res = NextResponse.json(
        { error: 'Replicate API token not configured' },
        { status: 500 }
      );
      return { response: res, usageUsdMicros: 0 };
    }

    try {
      console.log('Starting lip sync generation with model:', model);

      // Build input based on model
      const input: any = {
        image: imageUrl,
        audio: audioUrl,
      };
      
      // WAN-Video REQUIRES a prompt parameter (not optional!)
      if (model === 'wan-video/wan-2.2-s2v') {
        input.prompt = prompt || 'person talking'; // Default if not provided
      }

      // Use direct Replicate HTTP API (more reliable than SDK)
      // POST to /v1/models/{owner}/{model}/predictions
      const apiUrl = `https://api.replicate.com/v1/models/${model}/predictions`;
      
      console.log('Calling Replicate API:', apiUrl);
      console.log('Input:', JSON.stringify(input, null, 2));

      const replicateResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${replicateApiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input }),
      });

      if (!replicateResponse.ok) {
        const errorText = await replicateResponse.text();
        console.error('Replicate API error:', replicateResponse.status, errorText);
        throw new Error(`Replicate API failed (${replicateResponse.status}): ${errorText}`);
      }

      let prediction = await replicateResponse.json();
      console.log('Initial prediction created:', prediction.id, 'Status:', prediction.status);

      const predictionId = prediction.id;

      // For client polling mode, return immediately with prediction ID
      if (pollForCompletion === false) {
        // Store the lip sync generation with hold ID for later finalization
        try {
          await createVideoGeneration({
            videoId: predictionId,
            userId: context.userId,
            accountId: context.accountId,
            holdId: context.holdId,
            model,
            prompt: prompt || `Lip sync: ${model}`,
            seconds: audioDuration.toString(),
            size: 'N/A', // Lip sync doesn't have fixed size
            orientation: 'N/A',
            resolution: 'N/A',
          });
          
          console.log(`✅ Lip sync tracking created: ${predictionId} with hold: ${context.holdId}, duration: ${audioDuration}s`);
        } catch (error: any) {
          console.error('Failed to store lip sync generation:', error);
          // If we can't store tracking, release the hold and fail
          const res = NextResponse.json(
            { error: 'Failed to initialize lip sync tracking' },
            { status: 500 }
          );
          return { response: res, usageUsdMicros: 0 };
        }
        
        const res = NextResponse.json({
          success: true,
          prediction_id: predictionId,
          status: prediction.status,
          message: 'Lip sync generation started',
        });
        return { response: res, usageUsdMicros: 0, keepHold: true };
      }

      // Server-side polling: Wait for completion
      const maxAttempts = 120; // 10 minutes max (5 seconds * 120)
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
            'Authorization': `Bearer ${replicateApiToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (!statusResponse.ok) {
          console.error('Failed to poll status:', statusResponse.status);
          break;
        }

        prediction = await statusResponse.json();
        attempts++;
        console.log(`Poll attempt ${attempts}: Status = ${prediction.status}`);
      }

      // Extract video URL from completed prediction
      let videoUrl: string | null = null;
      
      if (prediction.status === 'succeeded' && prediction.output) {
        if (typeof prediction.output === 'string') {
          videoUrl = prediction.output;
        } else if (Array.isArray(prediction.output) && prediction.output.length > 0) {
          videoUrl = prediction.output[0];
        } else if (typeof prediction.output === 'object' && prediction.output.url) {
          videoUrl = prediction.output.url;
        }
      }

      if (!videoUrl) {
        if (prediction.status === 'failed') {
          throw new Error(`Generation failed: ${prediction.error || 'Unknown error'}`);
        } else if (attempts >= maxAttempts) {
          throw new Error('Generation timed out after 10 minutes');
        } else {
          throw new Error(`No video URL in ${prediction.status} prediction`);
        }
      }

      console.log('Video URL:', videoUrl);
      console.log('Final status:', prediction.status);

      // Download video and convert to base64 for proper downloading (like Sora videos)
      let videoData: string | null = null;
      try {
        console.log('Downloading video from Replicate CDN:', videoUrl);
        const videoResponse = await fetch(videoUrl);
        
        if (videoResponse.ok) {
          const arrayBuffer = await videoResponse.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const base64Video = buffer.toString('base64');
          videoData = `data:video/mp4;base64,${base64Video}`;
          console.log('Video downloaded and converted to base64. Size:', buffer.length, 'bytes');
        }
      } catch (error: any) {
        console.error('Error downloading video:', error);
        // Continue with URL if download fails
      }

      // Return completed result
      const res = NextResponse.json({
        success: true,
        video_url: videoUrl,
        video_data: videoData, // Base64 for downloading
        prediction_id: predictionId,
        status: 'succeeded',
      });
      const usageUsdMicros = estimateLipSyncUsdMicros(model, audioDuration);
      return { response: res, usageUsdMicros };
    } catch (error: any) {
      console.error('Lip sync generation failed:', error);
      const res = NextResponse.json(
        { error: error.message || 'Failed to generate lip sync video' },
        { status: 500 }
      );
      return { response: res, usageUsdMicros: 0 };
    }
  },
});

