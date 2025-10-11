import { NextRequest, NextResponse } from 'next/server';
import { withCreditGuard } from '@/lib/withCreditGuard';
import { estimateVideoUsdMicros } from '@/lib/pricing';

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
}

export const POST = withCreditGuard<{ prompt?: string; pollForCompletion?: boolean; model?: string; seconds?: string; orientation?: string; resolution?: string }>({
  estimateUsdMicros: async ({ model = 'sora-2-pro', seconds = '12', resolution = 'standard' }) => {
    const secs = parseInt(seconds) || 12;
    return estimateVideoUsdMicros(model, secs, resolution);
  },
  runWithUsageUsdMicros: async ({ prompt, pollForCompletion, model = 'sora-2-pro', seconds = '12', orientation = 'horizontal', resolution = 'standard' }, _req) => {

    if (!prompt) {
      const res = NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
      return { response: res, usageUsdMicros: 0 };
    }

    // Determine size based on orientation and resolution
    // sora-2-pro supports higher resolutions: 1792x1024 (landscape) and 1024x1792 (portrait)
    // sora-2 only supports: 1280x720 (landscape) and 720x1280 (portrait)
    let size: string;
    if (model === 'sora-2-pro' && resolution === 'high') {
      size = orientation === 'vertical' ? '1024x1792' : '1792x1024';
    } else {
      size = orientation === 'vertical' ? '720x1280' : '1280x720';
    }
    
    console.log('Starting video generation with prompt:', prompt, 'model:', model, 'seconds:', seconds, 'size:', size, 'orientation:', orientation);

    // Step 1: Create video generation request
    const createResponse = await fetch(`${OPENAI_API_BASE}/videos`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPEN_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        prompt: prompt,
        seconds: seconds,
        size: size
      }),
    });

    if (!createResponse.ok) {
      const errorData = await createResponse.json().catch(() => ({}));
      console.error('Video creation failed:', errorData);
      const res = NextResponse.json(
        { 
          error: errorData.error?.message || 'Failed to start video generation',
          details: errorData
        },
        { status: createResponse.status }
      );
      return { response: res, usageUsdMicros: 0 };
    }

    let video: VideoResponse = await createResponse.json();
    console.log('Video generation started:', video);

    // If pollForCompletion is false, return immediately with video_id
    if (pollForCompletion === false) {
      const res = NextResponse.json({
        success: true,
        video_id: video.id,
        status: video.status,
        model: video.model,
        progress: video.progress || 0,
        message: 'Video generation started. Use the video_id to check progress.',
      });
      const usageUsdMicros = estimateVideoUsdMicros(model, parseInt(seconds) || 12, resolution);
      return { response: res, usageUsdMicros };
    }

    // Step 2: Poll until completion (legacy behavior for backwards compatibility)
    let pollCount = 0;
    const maxPolls = 60; // Max 5 minutes (60 * 5 seconds)
    
    while ((video.status === 'in_progress' || video.status === 'queued') && pollCount < maxPolls) {
      // Wait 5 seconds before polling again
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const pollResponse = await fetch(`${OPENAI_API_BASE}/videos/${video.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.OPEN_API_KEY}`,
        },
      });

      if (!pollResponse.ok) {
        console.error('Polling failed:', await pollResponse.text());
        break;
      }

      video = await pollResponse.json();
      console.log(`Polling ${pollCount + 1}/${maxPolls} - Status: ${video.status}, Progress: ${video.progress || 0}%`);
      
      pollCount++;
    }

    console.log('Final video status:', video.status);

    if (video.status === 'completed') {
      // Step 3: Download the video content
      console.log('Downloading video content...');
      const contentResponse = await fetch(`${OPENAI_API_BASE}/videos/${video.id}/content`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.OPEN_API_KEY}`,
        },
      });

      if (!contentResponse.ok) {
        const res = NextResponse.json(
          { error: 'Failed to download video content' },
          { status: contentResponse.status }
        );
        return { response: res, usageUsdMicros: 0 };
      }

      const arrayBuffer = await contentResponse.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64Video = buffer.toString('base64');
      
      console.log(`Video downloaded successfully. Size: ${buffer.length} bytes`);
      
      const res = NextResponse.json({
        success: true,
        video_data: `data:video/mp4;base64,${base64Video}`,
        video_id: video.id,
        status: video.status,
        model: video.model,
        progress: video.progress,
      });
      const usageUsdMicros = estimateVideoUsdMicros(model, parseInt(seconds) || 12, resolution);
      return { response: res, usageUsdMicros };
    } else if (video.status === 'failed') {
      const res = NextResponse.json(
        { 
          error: 'Video generation failed',
          status: video.status,
          video_id: video.id,
        },
        { status: 500 }
      );
      return { response: res, usageUsdMicros: 0 };
    } else {
      const res = NextResponse.json(
        { 
          error: 'Video generation timed out. Please try again.',
          status: video.status,
          video_id: video.id,
        },
        { status: 408 }
      );
      return { response: res, usageUsdMicros: 0 };
    }
  }
});

