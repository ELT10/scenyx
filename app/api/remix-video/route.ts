import { NextRequest, NextResponse } from 'next/server';
import { withCreditGuard } from '@/lib/withCreditGuard';
import { estimateVideoUsdMicros } from '@/lib/pricing';
import { createVideoGeneration } from '@/lib/videoGenerations';

const OPENAI_API_BASE = 'https://api.openai.com/v1';

interface VideoResponse {
  id: string;
  object: string;
  created_at: number;
  status: 'queued' | 'in_progress' | 'completed' | 'failed';
  model: string;
  progress?: number;
  seconds?: string;
  size?: string;
  error?: {
    code: string;
    message: string;
  };
}

export const POST = withCreditGuard<{ 
  video_id?: string; 
  prompt?: string; 
  pollForCompletion?: boolean;
}>({
  estimateUsdMicros: async ({ video_id }) => {
    // First, get the original video details to determine pricing
    if (!video_id) {
      throw new Error('Video ID is required');
    }

    const apiKey = process.env.OPEN_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key is not configured');
    }

    try {
      // Fetch original video details
      const videoResponse = await fetch(`${OPENAI_API_BASE}/videos/${video_id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (!videoResponse.ok) {
        throw new Error('Failed to fetch original video details');
      }

      const video: VideoResponse = await videoResponse.json();
      
      // Extract model and duration
      const model = video.model;
      const seconds = parseInt(video.seconds || '12');
      
      // Determine resolution from size
      const size = video.size;
      let resolution = 'standard';
      if (size === '1792x1024' || size === '1024x1792') {
        resolution = 'high';
      }

      return estimateVideoUsdMicros(model, seconds, resolution);
    } catch (error: any) {
      console.error('Error estimating remix cost:', error);
      // Default to standard sora-2 pricing if we can't fetch original
      return estimateVideoUsdMicros('sora-2', 12, 'standard');
    }
  },
  runWithUsageUsdMicros: async ({ video_id, prompt, pollForCompletion }, _req, context) => {
    if (!video_id) {
      const res = NextResponse.json(
        { error: 'Video ID is required' },
        { status: 400 }
      );
      return { response: res, usageUsdMicros: 0 };
    }

    if (!prompt) {
      const res = NextResponse.json(
        { error: 'Remix prompt is required' },
        { status: 400 }
      );
      return { response: res, usageUsdMicros: 0 };
    }

    const apiKey = process.env.OPEN_API_KEY;
    if (!apiKey) {
      const res = NextResponse.json(
        { error: 'OpenAI API key is not configured' },
        { status: 500 }
      );
      return { response: res, usageUsdMicros: 0 };
    }

    console.log('Starting video remix for video:', video_id, 'with prompt:', prompt);

    // Step 1: Get original video details for pricing
    let originalVideo: VideoResponse;
    try {
      const videoResponse = await fetch(`${OPENAI_API_BASE}/videos/${video_id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (!videoResponse.ok) {
        const errorData = await videoResponse.json().catch(() => ({}));
        console.error('Failed to fetch original video:', errorData);
        const res = NextResponse.json(
          { 
            error: 'Failed to fetch original video details',
            details: errorData
          },
          { status: videoResponse.status }
        );
        return { response: res, usageUsdMicros: 0 };
      }

      originalVideo = await videoResponse.json();

      // Validate model supports remix (only sora-2 and sora-2-pro)
      if (!originalVideo.model.startsWith('sora-2')) {
        const res = NextResponse.json(
          { error: 'Remix is only supported for sora-2 and sora-2-pro models' },
          { status: 400 }
        );
        return { response: res, usageUsdMicros: 0 };
      }

      // Validate original video is completed
      if (originalVideo.status !== 'completed') {
        const res = NextResponse.json(
          { error: 'Original video must be completed before remixing' },
          { status: 400 }
        );
        return { response: res, usageUsdMicros: 0 };
      }
    } catch (error: any) {
      console.error('Error fetching original video:', error);
      const res = NextResponse.json(
        { error: 'Failed to verify original video' },
        { status: 500 }
      );
      return { response: res, usageUsdMicros: 0 };
    }

    // Step 2: Create remix request
    const remixResponse = await fetch(`${OPENAI_API_BASE}/videos/${video_id}/remix`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: prompt,
      }),
    });

    if (!remixResponse.ok) {
      const errorData = await remixResponse.json().catch(() => ({}));
      console.error('Video remix failed:', errorData);
      const res = NextResponse.json(
        { 
          error: errorData.error?.message || 'Failed to start video remix',
          details: errorData
        },
        { status: remixResponse.status }
      );
      return { response: res, usageUsdMicros: 0 };
    }

    let remixedVideo: VideoResponse = await remixResponse.json();
    console.log('Video remix started:', remixedVideo);

    // Determine resolution from original video size
    const size = originalVideo.size || '';
    let resolution = 'standard';
    if (size === '1792x1024' || size === '1024x1792') {
      resolution = 'high';
    }

    // Determine orientation from size
    let orientation = 'horizontal';
    if (size === '720x1280' || size === '1024x1792') {
      orientation = 'vertical';
    }

    // If pollForCompletion is false, return immediately with video_id
    if (pollForCompletion === false) {
      try {
        // Store video generation with hold ID
        await createVideoGeneration({
          videoId: remixedVideo.id,
          userId: context.userId,
          accountId: context.accountId,
          holdId: context.holdId,
          model: originalVideo.model,
          prompt: `REMIX: ${prompt}`,
          seconds: originalVideo.seconds || '12',
          size: originalVideo.size || '1280x720',
          orientation,
          resolution,
        });
        
        console.log(`✅ Remix video tracked: ${remixedVideo.id} with hold: ${context.holdId}`);
      } catch (error: any) {
        console.error('Failed to store remix video generation:', error);
        const res = NextResponse.json(
          { error: 'Failed to initialize remix video tracking' },
          { status: 500 }
        );
        return { response: res, usageUsdMicros: 0 };
      }
      
      const res = NextResponse.json({
        success: true,
        video_id: remixedVideo.id,
        status: remixedVideo.status,
        model: remixedVideo.model,
        progress: remixedVideo.progress || 0,
        message: 'Video remix started. Credits will be charged only if generation succeeds.',
        original_video_id: video_id,
      });
      
      // Keep the hold active - it will be finalized when video completes or fails
      return { response: res, usageUsdMicros: 0, keepHold: true };
    }

    // Step 3: Poll until completion (legacy behavior for backwards compatibility)
    let pollCount = 0;
    const maxPolls = 60; // Max 5 minutes (60 * 5 seconds)
    
    while ((remixedVideo.status === 'in_progress' || remixedVideo.status === 'queued') && pollCount < maxPolls) {
      // Wait 5 seconds before polling again
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const pollResponse = await fetch(`${OPENAI_API_BASE}/videos/${remixedVideo.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (!pollResponse.ok) {
        console.error('Polling failed:', await pollResponse.text());
        break;
      }

      remixedVideo = await pollResponse.json();
      console.log(`Polling ${pollCount + 1}/${maxPolls} - Status: ${remixedVideo.status}, Progress: ${remixedVideo.progress || 0}%`);
      
      pollCount++;
    }

    console.log('Final remix video status:', remixedVideo.status);

    if (remixedVideo.status === 'completed') {
      // Step 4: Download the video content
      console.log('Downloading remixed video content...');
      const contentResponse = await fetch(`${OPENAI_API_BASE}/videos/${remixedVideo.id}/content`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (!contentResponse.ok) {
        const res = NextResponse.json(
          { error: 'Failed to download remixed video content' },
          { status: contentResponse.status }
        );
        return { response: res, usageUsdMicros: 0 };
      }

      const arrayBuffer = await contentResponse.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64Video = buffer.toString('base64');
      
      console.log(`Remixed video downloaded successfully. Size: ${buffer.length} bytes`);
      
      const res = NextResponse.json({
        success: true,
        video_data: `data:video/mp4;base64,${base64Video}`,
        video_id: remixedVideo.id,
        status: remixedVideo.status,
        model: remixedVideo.model,
        progress: remixedVideo.progress,
        original_video_id: video_id,
      });
      
      const usageUsdMicros = estimateVideoUsdMicros(
        originalVideo.model, 
        parseInt(originalVideo.seconds || '12'), 
        resolution
      );
      return { response: res, usageUsdMicros };
    } else if (remixedVideo.status === 'failed') {
      const res = NextResponse.json(
        { 
          error: remixedVideo.error?.message || 'Video remix failed',
          errorCode: remixedVideo.error?.code || 'unknown_error',
          errorDetails: remixedVideo.error,
          status: remixedVideo.status,
          video_id: remixedVideo.id,
          original_video_id: video_id,
        },
        { status: 500 }
      );
      // Don't charge credits for failed videos
      return { response: res, usageUsdMicros: 0 };
    } else {
      const res = NextResponse.json(
        { 
          error: 'Video remix timed out. Please try again.',
          status: remixedVideo.status,
          video_id: remixedVideo.id,
          original_video_id: video_id,
        },
        { status: 408 }
      );
      return { response: res, usageUsdMicros: 0 };
    }
  }
});

