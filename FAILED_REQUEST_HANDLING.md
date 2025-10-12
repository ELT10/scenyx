# Failed Request Handling - OpenAI API

## Overview

This document describes how the application handles failed requests from the OpenAI API, particularly when video generation requests are blocked by moderation or encounter other errors.

## Problem Statement

Previously, when OpenAI API blocked requests (e.g., due to moderation policies), the system would:
1. Deduct credits from the user's account immediately upon video generation start
2. Show generic error messages without details
3. Not refund credits when videos failed during generation

This resulted in users losing credits for videos that were never successfully generated.

## Solution Implemented

### 1. Credit Deduction Strategy

**Before:** Credits were deducted immediately when video generation started (asynchronous mode with `pollForCompletion: false`).

**After:** Credits are **NOT** deducted when video generation starts. Credits are only deducted when:
- Video completes successfully (status: `completed`)
- For synchronous mode (legacy `pollForCompletion: true`), credits are deducted only on successful completion

**Code Changes:**
- `/app/api/generate-video/route.ts` (lines 76-89):
  - Changed `usageUsdMicros` from estimated cost to `0` when returning immediately
  - Added comments explaining credit deduction happens only on completion

### 2. Error Information Display

**Before:** Generic error message "Video generation failed"

**After:** Detailed error information including:
- Error code (e.g., `moderation_blocked`, `invalid_request`, etc.)
- Error message from OpenAI API
- Proper error display in UI

**Code Changes:**
- `/app/api/generate-video/route.ts` (lines 7-20):
  - Added `error` object to `VideoResponse` interface
  
- `/app/api/generate-video/route.ts` (lines 158-170):
  - Enhanced error response to include error code, message, and details
  - Explicitly set `usageUsdMicros: 0` for failed videos

- `/app/page.tsx` (lines 144-156):
  - Updated `pollGenerationProgress` to extract and display error code and message
  - Error format: `{ERROR_CODE}: {error message}`

- `/app/page.tsx` (lines 200-206):
  - Updated `generateVideo` to show error details from initial API call

### 3. User Interface Updates

**Added Information:**
- Info panel now clearly states: "Credits are only deducted when videos complete successfully - failed generations are free"
- Error messages show both code and description for better debugging

**Error Display:**
The UI now shows errors in the format:
```
MODERATION_BLOCKED: Your request was blocked by our moderation system.
```

Instead of just:
```
Video generation failed
```

## API Error Response Format

### Video Generation Endpoint (`/api/generate-video`)

**Success Response (Async Start):**
```json
{
  "success": true,
  "video_id": "video_xxx",
  "status": "queued",
  "model": "sora-2",
  "progress": 0,
  "message": "Video generation started. Use the video_id to check progress."
}
```

**Error Response (Failed Generation):**
```json
{
  "error": "Your request was blocked by our moderation system.",
  "errorCode": "moderation_blocked",
  "errorDetails": {
    "code": "moderation_blocked",
    "message": "Your request was blocked by our moderation system."
  },
  "status": "failed",
  "video_id": "video_xxx"
}
```

### Video Status Check Endpoint (`/api/check-video`)

**Response with Error:**
```json
{
  "success": true,
  "video_id": "video_xxx",
  "status": "failed",
  "model": "sora-2",
  "progress": 0,
  "created_at": 1760195742,
  "seconds": "12",
  "size": "1280x720",
  "error": {
    "code": "moderation_blocked",
    "message": "Your request was blocked by our moderation system."
  }
}
```

## Common OpenAI Error Codes

| Error Code | Description | Credits Charged |
|------------|-------------|-----------------|
| `moderation_blocked` | Content blocked by moderation system | No |
| `invalid_request` | Invalid request parameters | No |
| `rate_limit_exceeded` | Rate limit reached | No |
| `insufficient_quota` | OpenAI API quota exceeded | No |
| `server_error` | OpenAI server error | No |
| `timeout` | Request timed out | No |

## Credit Flow

### Asynchronous Generation (Default)

1. User initiates video generation
2. System creates a credit hold (reserves estimated credits)
3. OpenAI API starts video generation
4. System returns video_id to user
5. **Credit hold is released immediately** (no charge yet)
6. User polls video status
7. When status becomes `completed`:
   - Credits should be charged (future implementation needed)
8. When status becomes `failed`:
   - No credits charged
   - Error details shown to user

### Synchronous Generation (Legacy)

1. User initiates video generation with `pollForCompletion: true`
2. System creates a credit hold
3. OpenAI API starts video generation
4. System polls until completion or failure
5. On completion:
   - Credits are captured from hold
   - Video data returned
6. On failure:
   - Hold is released (no charge)
   - Error details returned

## Important Notes

### Current Limitation

⚠️ **Important:** With asynchronous generation (default mode), credits are currently **NOT** automatically charged when videos complete. This is because:

1. The generation endpoint releases the hold immediately
2. The status check endpoint (`/api/check-video`) doesn't have credit charging logic

This means the system is currently **under-charging** for successful videos in async mode.

### Future Enhancement Needed

To properly charge for async completions, one of these approaches should be implemented:

**Option A: Store Hold with Video ID**
- Store hold_id in database with video_id
- When checking status and video is completed, capture the stored hold
- When checking status and video is failed, release the stored hold

**Option B: Charge on Status Check**
- When `/api/check-video` is called and status is `completed` (first time)
- Create and capture a new charge
- Track in database that this video was already charged

**Option C: Webhook Integration**
- Implement webhook to receive completion notifications from OpenAI
- Charge credits when webhook confirms completion

## Testing Scenarios

### Test Case 1: Moderation Blocked
1. Generate video with inappropriate content
2. Verify error shows: "MODERATION_BLOCKED: Your request was blocked by our moderation system"
3. Verify no credits deducted

### Test Case 2: Successful Generation
1. Generate video with appropriate content
2. Verify video completes successfully
3. Verify credits are deducted (currently not working in async mode - see limitation above)

### Test Case 3: Failed During Generation
1. Generate video that fails after starting
2. Verify error details are shown
3. Verify no credits deducted

## Files Modified

1. `/app/api/generate-video/route.ts` - Credit handling and error details
2. `/app/page.tsx` - Error display in UI
3. `/app/api/check-video/route.ts` - Already had error field support (no changes needed)

## Related Systems

- Credit system: `/lib/credits.ts`
- Credit guard middleware: `/lib/withCreditGuard.ts`
- Pricing: `/lib/pricing.ts`
- Database migrations: `/supabase/migrations/0008_create_hold_capture_system.sql`

