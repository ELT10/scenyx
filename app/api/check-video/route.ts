export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { NextRequest, NextResponse } from 'next/server';
import { finalizeVideoGeneration, getVideoGeneration, updateVideoGenerationStatus, updateVideoUrl } from '@/lib/videoGenerations';
import { releaseHold } from '@/lib/credits';

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

    // Get video status from OpenAI
    const statusResponse = await fetch(`${OPENAI_API_BASE}/videos/${videoId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    // If OpenAI API call fails, DON'T finalize credits
    // The video might still be generating, we just can't check the status
    if (!statusResponse.ok) {
      const errorData = await statusResponse.json().catch(() => ({}));
      console.error('❌ OpenAI API error (status check failed):', statusResponse.status, errorData);
      
      // Return error to user but DON'T touch the hold
      // Hold stays active - video might still be generating on OpenAI's side
      return NextResponse.json(
        { 
          error: errorData.error?.message || 'Failed to retrieve video status from OpenAI',
          details: errorData,
          note: 'Credits remain reserved. Video may still be generating.'
        },
        { status: statusResponse.status }
      );
    }

    // Successfully got response from OpenAI
    const video: VideoResponse = await statusResponse.json();
    console.log('✅ Video status from OpenAI:', video.status, video.id);

    // Check if we're tracking this video generation for credit finalization
    const videoGen = await getVideoGeneration(videoId);
    
    // ONLY finalize if OpenAI explicitly returned terminal status
    // This prevents refunding credits when our API fails but video is still generating
    if (videoGen && videoGen.credits_charged === null && (video.status === 'completed' || video.status === 'failed')) {
      console.log('🎯 Terminal status received from OpenAI:', video.status);
      
      try {
        const finalizationResult = await finalizeVideoGeneration(
          videoId,
          video.status,
          video.error?.code,
          video.error?.message
        );
        console.log('✅ Finalization successful:', finalizationResult);
        
        if (video.status === 'completed') {
          console.log('💳 Credits charged for successful video:', videoId);
        } else {
          console.log('💰 Credits refunded - OpenAI returned failed status:', videoId, '- Error:', video.error?.code);
        }
      } catch (error: any) {
        console.error('❌ Finalization failed:', error);
        
        // CRITICAL: If finalization fails AND OpenAI said video failed,
        // we must release the hold manually to avoid keeping user's credits stuck
        if (video.status === 'failed' && videoGen.hold_id) {
          console.log('🚨 Attempting emergency hold release...');
          try {
            await releaseHold(videoGen.hold_id);
            console.log('💰 Emergency hold release successful');
          } catch (releaseError: any) {
            console.error('🚨 CRITICAL: Could not release hold:', releaseError);
            // This needs manual intervention - log it prominently
            console.error('🚨 MANUAL ACTION REQUIRED: Release hold', videoGen.hold_id, 'for video', videoId);
          }
        }
        
        // Don't fail the request - user still gets video status
      }
    } else if (videoGen && videoGen.credits_charged === null) {
      // Video is still generating (queued or in_progress)
      console.log('⏳ Video still generating, hold remains active:', video.status);
    } else if (videoGen && videoGen.credits_charged !== null) {
      // Already finalized
      console.log('✓ Video already finalized, credits_charged:', videoGen.credits_charged);
    }

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
          const videoDataUrl = `data:video/mp4;base64,${base64Video}`;
          
          console.log('✅ OpenAI video fetched, size:', buffer.length, 'bytes');
          
          // Note: We don't store base64 data URLs for OpenAI videos in the database
          // because they're too large (>800KB) and would exceed PostgreSQL's index limit.
          // OpenAI videos are fetched on-demand from OpenAI's API.
          
          return NextResponse.json({
            success: true,
            video_id: video.id,
            status: video.status,
            model: video.model,
            progress: video.progress,
            created_at: video.created_at,
            seconds: video.seconds,
            size: video.size,
            video_data: videoDataUrl,
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
    // Network error, timeout, or other exception
    console.error('❌ Exception while checking video status:', error);
    
    // DON'T finalize or touch credits - we don't know the real status
    // Hold stays active - video might still be generating
    
    return NextResponse.json(
      { 
        error: error.message || 'Failed to check video status',
        details: error.response?.data || null,
        note: 'Network or server error. Credits remain reserved. Video may still be generating.'
      },
      { status: error.status || 500 }
    );
  }
}

