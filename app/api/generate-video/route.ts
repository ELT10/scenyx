import { NextRequest, NextResponse } from 'next/server';

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

export async function POST(request: NextRequest) {
  try {
    const { prompt, pollForCompletion } = await request.json();

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPEN_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key is not configured' },
        { status: 500 }
      );
    }

    console.log('Starting video generation with prompt:', prompt);

    // Step 1: Create video generation request
    const createResponse = await fetch(`${OPENAI_API_BASE}/videos`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sora-2-pro',
        prompt: prompt,
        seconds: "12",
        size: "1280x720"
      }),
    });

    if (!createResponse.ok) {
      const errorData = await createResponse.json().catch(() => ({}));
      console.error('Video creation failed:', errorData);
      return NextResponse.json(
        { 
          error: errorData.error?.message || 'Failed to start video generation',
          details: errorData
        },
        { status: createResponse.status }
      );
    }

    let video: VideoResponse = await createResponse.json();
    console.log('Video generation started:', video);

    // If pollForCompletion is false, return immediately with video_id
    if (pollForCompletion === false) {
      return NextResponse.json({
        success: true,
        video_id: video.id,
        status: video.status,
        model: video.model,
        progress: video.progress || 0,
        message: 'Video generation started. Use the video_id to check progress.',
      });
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
          'Authorization': `Bearer ${apiKey}`,
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
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (!contentResponse.ok) {
        return NextResponse.json(
          { error: 'Failed to download video content' },
          { status: contentResponse.status }
        );
      }

      const arrayBuffer = await contentResponse.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64Video = buffer.toString('base64');
      
      console.log(`Video downloaded successfully. Size: ${buffer.length} bytes`);
      
      return NextResponse.json({
        success: true,
        video_data: `data:video/mp4;base64,${base64Video}`,
        video_id: video.id,
        status: video.status,
        model: video.model,
        progress: video.progress,
      });
    } else if (video.status === 'failed') {
      return NextResponse.json(
        { 
          error: 'Video generation failed',
          status: video.status,
          video_id: video.id,
        },
        { status: 500 }
      );
    } else {
      // Timeout
      return NextResponse.json(
        { 
          error: 'Video generation timed out. Please try again.',
          status: video.status,
          video_id: video.id,
        },
        { status: 408 }
      );
    }

  } catch (error: any) {
    console.error('Error generating video:', error);
    
    return NextResponse.json(
      { 
        error: error.message || 'Failed to generate video',
        details: error.response?.data || null
      },
      { status: error.status || 500 }
    );
  }
}

