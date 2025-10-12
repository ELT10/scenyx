import { supabaseAdmin } from './supabaseAdmin';

export interface VideoGenerationData {
  videoId: string;
  userId: string;
  accountId: string;
  holdId: string;
  model: string;
  prompt: string;
  seconds: string;
  size: string;
  orientation: string;
  resolution: string;
}

export interface VideoGenerationStatus {
  id: string;
  video_id: string;
  user_id: string;
  account_id: string;
  hold_id: string | null;
  status: 'queued' | 'in_progress' | 'completed' | 'failed';
  credits_charged: boolean;
  charged_amount_microcredits: bigint | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

/**
 * Create a video generation record with an active hold
 * This tracks the video generation and prevents duplicate charging
 */
export async function createVideoGeneration(data: VideoGenerationData): Promise<string> {
  const { data: result, error } = await supabaseAdmin
    .rpc('fn_create_video_generation', {
      p_video_id: data.videoId,
      p_user_id: data.userId,
      p_account_id: data.accountId,
      p_hold_id: data.holdId,
      p_model: data.model,
      p_prompt: data.prompt,
      p_seconds: data.seconds,
      p_size: data.size,
      p_orientation: data.orientation,
      p_resolution: data.resolution,
    });

  if (error) {
    console.error('Failed to create video generation:', error);
    throw new Error(`Failed to create video generation: ${error.message}`);
  }

  return result as string;
}

/**
 * Get video generation by video ID
 */
export async function getVideoGeneration(videoId: string): Promise<VideoGenerationStatus | null> {
  const { data, error } = await supabaseAdmin
    .from('video_generations')
    .select('*')
    .eq('video_id', videoId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Not found
      return null;
    }
    console.error('Failed to get video generation:', error);
    throw new Error(`Failed to get video generation: ${error.message}`);
  }

  return data as VideoGenerationStatus;
}

/**
 * Finalize a video generation (capture or release hold based on status)
 * This should be called when the video reaches a terminal state (completed or failed)
 * 
 * @param videoId - The OpenAI video ID
 * @param status - Final status: 'completed' or 'failed'
 * @param errorCode - Error code if failed
 * @param errorMessage - Error message if failed
 * @returns Result of the finalization
 */
export async function finalizeVideoGeneration(
  videoId: string,
  status: 'completed' | 'failed',
  errorCode?: string,
  errorMessage?: string
): Promise<{
  status: string;
  credits_charged: boolean;
  hold_id: string;
}> {
  const { data: result, error } = await supabaseAdmin
    .rpc('fn_finalize_video_generation', {
      p_video_id: videoId,
      p_status: status,
      p_error_code: errorCode || null,
      p_error_message: errorMessage || null,
    });

  if (error) {
    console.error('Failed to finalize video generation:', error);
    throw new Error(`Failed to finalize video generation: ${error.message}`);
  }

  return result as any;
}

/**
 * Update video generation status (for progress tracking)
 * This does NOT finalize - just updates status and progress
 */
export async function updateVideoGenerationStatus(
  videoId: string,
  status: 'queued' | 'in_progress' | 'completed' | 'failed',
  errorCode?: string,
  errorMessage?: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('video_generations')
    .update({
      status,
      error_code: errorCode || null,
      error_message: errorMessage || null,
      updated_at: new Date().toISOString(),
    })
    .eq('video_id', videoId);

  if (error) {
    console.error('Failed to update video generation status:', error);
    throw new Error(`Failed to update video generation status: ${error.message}`);
  }
}

/**
 * Get video generations for a user
 */
export async function getUserVideoGenerations(
  userId: string,
  limit = 50
): Promise<VideoGenerationStatus[]> {
  const { data, error } = await supabaseAdmin
    .from('video_generations')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to get user video generations:', error);
    throw new Error(`Failed to get user video generations: ${error.message}`);
  }

  return (data || []) as VideoGenerationStatus[];
}

