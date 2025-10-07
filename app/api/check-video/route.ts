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
  error?: {
    code: string;
    message: string;
  };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const videoId = searchParams.get('video_id');

    if (!videoId) {
      return NextResponse.json(
        { error: 'Video ID is required' },
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

    console.log('Checking video status for ID:', videoId);

    // Get video status
    const statusResponse = await fetch(`${OPENAI_API_BASE}/videos/${videoId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!statusResponse.ok) {
      const errorData = await statusResponse.json().catch(() => ({}));
      console.error('Video status check failed:', errorData);
      return NextResponse.json(
        { 
          error: errorData.error?.message || 'Failed to retrieve video status',
          details: errorData
        },
        { status: statusResponse.status }
      );
    }

    const video: VideoResponse = await statusResponse.json();
    console.log('Video status:', video);

    // If video is completed, optionally fetch the content
    if (video.status === 'completed') {
      try {
        const contentResponse = await fetch(`${OPENAI_API_BASE}/videos/${video.id}/content`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
        });

        if (contentResponse.ok) {
          const arrayBuffer = await contentResponse.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const base64Video = buffer.toString('base64');
          
          return NextResponse.json({
            success: true,
            video_id: video.id,
            status: video.status,
            model: video.model,
            progress: video.progress,
            created_at: video.created_at,
            seconds: video.seconds,
            size: video.size,
            video_data: `data:video/mp4;base64,${base64Video}`,
          });
        }
      } catch (contentError) {
        console.error('Failed to fetch video content:', contentError);
        // Continue without video content
      }
    }

    return NextResponse.json({
      success: true,
      video_id: video.id,
      status: video.status,
      model: video.model,
      progress: video.progress,
      created_at: video.created_at,
      seconds: video.seconds,
      size: video.size,
      error: video.error,
    });

  } catch (error: any) {
    console.error('Error checking video status:', error);
    
    return NextResponse.json(
      { 
        error: error.message || 'Failed to check video status',
        details: error.response?.data || null
      },
      { status: error.status || 500 }
    );
  }
}

