# Video Remix Feature

## Overview
The video remix feature allows users to make targeted adjustments to existing Sora-2 and Sora-2-Pro videos without regenerating everything from scratch. This feature is particularly useful for iterative refinement of videos.

## Supported Models
- ✅ sora-2
- ✅ sora-2-pro
- ❌ Other models (remix is not available)

## How It Works

### API Implementation
- **New Endpoint**: `/api/remix-video`
- **Method**: POST
- **Required Parameters**:
  - `video_id`: The ID of the completed video to remix
  - `prompt`: Description of the change to make
  - `pollForCompletion`: Boolean (default: false)

### Backend Process
1. Validates the original video exists and is completed
2. Verifies the model is sora-2 or sora-2-pro
3. Calls OpenAI's remix endpoint: `POST /videos/{video_id}/remix`
4. Tracks the new video generation with credit holds
5. Finalizes credits only when the remix completes successfully

### Pricing
Remix pricing is the same as generating a new video with the same parameters:
- Uses the original video's model, duration, and resolution
- Credits are estimated and held upfront
- Credits are only charged on successful completion
- Failed remixes are free (credits refunded)

## User Interface

### Main Video Generation View
After a video is generated:
1. If the model is sora-2 or sora-2-pro, a **[REMIX VIDEO]** button appears
2. Clicking it reveals a remix prompt input
3. User enters a description of the change (e.g., "Shift colors to warm tones")
4. Cost estimate is shown (same as the original video)
5. Clicking **[START REMIX]** initiates the remix

### Archive View
For completed videos in the archive:
1. Sora-2 and Sora-2-Pro videos show a **[REMIX]** button
2. Clicking opens a modal dialog
3. User enters the remix prompt
4. Modal shows best practices and tips
5. Remix is submitted and tracked like a new generation

## Best Practices (as recommended to users)

### ✅ Good Remix Prompts
- "Shift the color palette to warm sunset tones"
- "Change time from day to night"
- "Add falling snow"
- "Change lighting to golden hour"
- "Make the scene foggy and mysterious"

### ❌ Avoid Multiple Changes
- Don't try to change multiple things at once
- Keep remixes focused on a single, well-defined adjustment
- This preserves more of the original fidelity and reduces artifacts

## Technical Details

### Credit System Integration
- Uses the same `withCreditGuard` wrapper as video generation
- Credits are held during generation
- Automatically finalized via the `/api/check-video` endpoint
- Refunded on failure

### Video Tracking
- Remixed videos are stored in the database with the original parameters
- Prompt is prefixed with "REMIX: " for identification
- Videos appear in the archive alongside other generations

### Error Handling
- Validates original video exists and is completed
- Checks model compatibility
- Provides clear error messages for:
  - Invalid video IDs
  - Incomplete original videos
  - Unsupported models
  - API failures

## Code Changes

### New Files
- `/app/api/remix-video/route.ts` - Remix API endpoint

### Modified Files
- `/app/page.tsx` - Added remix UI components and state management
  - State variables for remix mode
  - Remix function for main generation view
  - Remix function for archive view
  - UI components for both views
  - Modal dialog for archive remix

### Pricing (no changes needed)
- Uses existing pricing functions from `/lib/pricing.ts`
- Pricing is calculated based on original video parameters

## Usage Examples

### Example 1: Color Adjustment
Original: "A cinematic shot of a cityscape at noon"
Remix: "Shift the color palette to teal, sand, and rust tones"

### Example 2: Time of Day
Original: "A forest scene with sunlight filtering through trees"
Remix: "Change the time to sunset with warm golden light"

### Example 3: Weather
Original: "A mountain landscape with clear skies"
Remix: "Add a light layer of fog in the valleys"

## Limitations
1. Only works with completed videos
2. Only supports sora-2 and sora-2-pro models
3. Videos must not be expired (within 1-hour window)
4. One change per remix recommended for best results

## Future Enhancements
- Chain multiple remixes in sequence
- Save remix history for a video
- Preset remix options (e.g., "Make it winter", "Add rain")
- Side-by-side comparison of original and remixed videos

