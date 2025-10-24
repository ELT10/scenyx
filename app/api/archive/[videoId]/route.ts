import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const OPENAI_API_BASE = 'https://api.openai.com/v1';

interface RouteParams {
  params: {
    videoId: string;
  };
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { videoId } = params;

    if (!videoId) {
      return NextResponse.json(
        { error: 'Video ID is required' },
        { status: 400 }
      );
    }

    // Fetch video generation record from database
    const { data: videoGen, error: dbError } = await supabaseAdmin
      .from('video_generations')
      .select('video_id, model, status, seconds, created_at, prompt, size, orientation, resolution, video_url')
      .eq('video_id', videoId)
      .single();

    if (dbError || !videoGen) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    // Check if video is completed
    if (videoGen.status !== 'completed') {
      return NextResponse.json({
        success: false,
        video_id: videoGen.video_id,
        status: videoGen.status,
        model: videoGen.model,
        created_at: videoGen.created_at,
        message: 'Video is not yet completed',
      });
    }

    // Determine if it's OpenAI or Replicate based on model
    const source: 'replicate' | 'openai' =
      videoGen.model?.startsWith('wan-video/') || videoGen.model?.startsWith('bytedance/')
        ? 'replicate'
        : 'openai';

    // Calculate expiry (1 hour from creation)
    const created = new Date(videoGen.created_at).getTime();
    const ttlMs = 1 * 3600 * 1000; // 1 hour
    const expiresMs = created + ttlMs;
    const now = Date.now();

    if (expiresMs < now) {
      return NextResponse.json({
        success: false,
        video_id: videoGen.video_id,
        status: 'expired',
        model: videoGen.model,
        created_at: videoGen.created_at,
        message: 'Video has expired (older than 1 hour)',
      });
    }

    // Fetch video content based on source
    if (source === 'openai') {
      const apiKey = process.env.OPEN_API_KEY;
      
      if (!apiKey) {
        console.error('❌ OpenAI API key not configured');
        return NextResponse.json(
          { error: 'OpenAI API key is not configured' },
          { status: 500 }
        );
      }

      console.log('📥 Fetching OpenAI video content for:', videoId);

      try {
        const contentResponse = await fetch(`${OPENAI_API_BASE}/videos/${videoId}/content`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
        });

        console.log('📊 OpenAI content response status:', contentResponse.status);

        if (contentResponse.ok) {
          const arrayBuffer = await contentResponse.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const base64Video = buffer.toString('base64');
          
          console.log('✅ OpenAI video fetched successfully, size:', buffer.length, 'bytes');
          
          return NextResponse.json({
            success: true,
            video_id: videoGen.video_id,
            status: videoGen.status,
            model: videoGen.model,
            prompt: videoGen.prompt,
            seconds: videoGen.seconds,
            size: videoGen.size,
            orientation: videoGen.orientation,
            resolution: videoGen.resolution,
            created_at: videoGen.created_at,
            source,
            video_data: `data:video/mp4;base64,${base64Video}`,
          });
        } else {
          const errorText = await contentResponse.text();
          console.error('❌ Failed to fetch OpenAI video content:', contentResponse.status, errorText);
          return NextResponse.json(
            { error: `Failed to fetch video content from OpenAI: ${contentResponse.status}` },
            { status: contentResponse.status }
          );
        }
      } catch (error: any) {
        console.error('❌ Error fetching OpenAI video:', error);
        return NextResponse.json(
          { error: 'Failed to fetch video content' },
          { status: 500 }
        );
      }
    } else {
      // Replicate video - use stored video URL
      if (!videoGen.video_url) {
        console.error('❌ Replicate video URL not found for:', videoId);
        return NextResponse.json(
          { error: 'Video URL not available. Video may not have completed processing yet.' },
          { status: 404 }
        );
      }

      console.log('📥 Fetching Replicate video from stored URL:', videoGen.video_url.substring(0, 50) + '...');

      try {
        // Download video from stored URL and convert to base64
        const videoResponse = await fetch(videoGen.video_url);
        
        console.log('📊 Replicate CDN response status:', videoResponse.status);

        if (videoResponse.ok) {
          const arrayBuffer = await videoResponse.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const base64Video = buffer.toString('base64');
          
          console.log('✅ Replicate video fetched successfully, size:', buffer.length, 'bytes');
          
          return NextResponse.json({
            success: true,
            video_id: videoGen.video_id,
            status: videoGen.status,
            model: videoGen.model,
            prompt: videoGen.prompt,
            seconds: videoGen.seconds,
            created_at: videoGen.created_at,
            source,
            video_url: videoGen.video_url, // Stored Replicate URL
            video_data: `data:video/mp4;base64,${base64Video}`,
          });
        } else {
          const errorText = await videoResponse.text();
          console.error('❌ Failed to download video from Replicate CDN:', videoResponse.status, errorText);
          return NextResponse.json(
            { error: `Failed to download video from Replicate CDN: ${videoResponse.status}` },
            { status: videoResponse.status }
          );
        }
      } catch (error: any) {
        console.error('❌ Error downloading Replicate video:', error);
        return NextResponse.json(
          { error: 'Failed to download video content' },
          { status: 500 }
        );
      }
    }
  } catch (error: any) {
    console.error('Error fetching video:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch video' },
      { status: 500 }
    );
  }
}

