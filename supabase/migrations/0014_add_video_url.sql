-- Add video_url column to store the final video URL
-- This is especially important for Replicate videos which can't be fetched by ID without auth

ALTER TABLE video_generations
ADD COLUMN IF NOT EXISTS video_url TEXT;

-- Add index for faster lookups when fetching videos
CREATE INDEX IF NOT EXISTS idx_video_generations_video_url ON video_generations(video_url) WHERE video_url IS NOT NULL;

-- Add comment for clarity
COMMENT ON COLUMN video_generations.video_url IS 'Stores the final video URL for completed videos. Critical for Replicate videos which require auth to fetch by prediction ID.';

