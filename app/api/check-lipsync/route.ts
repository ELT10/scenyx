export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { NextRequest, NextResponse } from 'next/server';
import { finalizeVideoGeneration, getVideoGeneration } from '@/lib/videoGenerations';
import { estimateLipSyncUsdMicros } from '@/lib/pricing';
import { captureHold } from '@/lib/credits';

// Support both env var names
const replicateApiToken = process.env.REPLICATE_API_TOKEN || process.env.REPLIT_KEY;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const predictionId = searchParams.get('prediction_id');

    if (!predictionId) {
      return NextResponse.json(
        { error: 'Prediction ID is required' },
        { status: 400 }
      );
    }

    if (!replicateApiToken) {
      return NextResponse.json(
        { error: 'Replicate API token not configured' },
        { status: 500 }
      );
    }

    console.log('Checking lip sync status for ID:', predictionId);

    // Use direct HTTP API to get prediction status
    const apiUrl = `https://api.replicate.com/v1/predictions/${predictionId}`;
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${replicateApiToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Replicate API error:', response.status, errorText);
      return NextResponse.json(
        { error: `Failed to get prediction status: ${errorText}` },
        { status: response.status }
      );
    }

    const prediction = await response.json();

    // Check if this prediction has a hold that needs to be captured
    // We'll use the video_generations table to track lip sync holds too
    const videoGen = await getVideoGeneration(predictionId);
    
    if (videoGen && videoGen.credits_charged === null && videoGen.hold_id && prediction.status === 'succeeded') {
      console.log('🎯 Lip sync succeeded, capturing hold');
      
      try {
        // Use stored model and duration for accurate pricing
        const model = videoGen.model || 'wan-video/wan-2.2-s2v';
        const durationSeconds = videoGen.seconds ? parseInt(videoGen.seconds) : 10;
        console.log(`💰 Calculating cost: ${model} × ${durationSeconds}s`);
        const usageUsdMicros = estimateLipSyncUsdMicros(model, durationSeconds);
        
        await captureHold(videoGen.hold_id, BigInt(usageUsdMicros));
        
        // Mark as charged in the database
        await finalizeVideoGeneration(
          predictionId,
          'completed',
          undefined,
          undefined
        );
        
        console.log('✅ Hold captured for lip sync:', predictionId);
      } catch (error: any) {
        console.error('❌ Failed to capture hold for lip sync:', error);
      }
    } else if (videoGen && videoGen.credits_charged === null && videoGen.hold_id && prediction.status === 'failed') {
      console.log('💰 Lip sync failed, releasing hold');
      
      try {
        const errorMessage = typeof prediction.error === 'string' 
          ? prediction.error 
          : JSON.stringify(prediction.error) || 'Unknown error';
        
        await finalizeVideoGeneration(
          predictionId,
          'failed',
          'generation_failed',
          errorMessage
        );
        console.log('✅ Hold released for failed lip sync:', predictionId);
      } catch (error: any) {
        console.error('❌ Failed to release hold for lip sync:', error);
      }
    }

    // Extract video URL for easier frontend access
    let videoUrl: string | null = null;
    if (prediction.output) {
      if (typeof prediction.output === 'string') {
        videoUrl = prediction.output;
      } else if (Array.isArray(prediction.output) && prediction.output.length > 0) {
        videoUrl = prediction.output[0];
      } else if (typeof prediction.output === 'object' && prediction.output.url) {
        videoUrl = prediction.output.url;
      }
    }

    // If video is completed, download it and convert to base64 for proper downloading
    let videoData: string | null = null;
    if (prediction.status === 'succeeded' && videoUrl) {
      try {
        console.log('Downloading video from Replicate CDN:', videoUrl);
        const videoResponse = await fetch(videoUrl);
        
        if (videoResponse.ok) {
          const arrayBuffer = await videoResponse.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const base64Video = buffer.toString('base64');
          videoData = `data:video/mp4;base64,${base64Video}`;
          console.log('Video downloaded and converted to base64. Size:', buffer.length, 'bytes');
        } else {
          console.error('Failed to download video from Replicate:', videoResponse.status);
        }
      } catch (error: any) {
        console.error('Error downloading video:', error);
        // Continue without video data - still return the URL
      }
    }

    return NextResponse.json({
      success: true,
      prediction_id: prediction.id,
      status: prediction.status,
      output: prediction.output,
      video_url: videoUrl, // Original Replicate URL
      video_data: videoData, // Base64 encoded video for downloading
      error: prediction.error,
      logs: prediction.logs,
    });
  } catch (error: any) {
    console.error('Failed to check lip sync status:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check status' },
      { status: 500 }
    );
  }
}

