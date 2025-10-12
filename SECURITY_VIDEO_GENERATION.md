# Video Generation Security & Credit System

## 🔒 Security Overview

This document describes the secure implementation of video generation with proper credit handling that prevents exploits and ensures users are only charged for successful video generations.

## ❌ Previous Vulnerabilities (FIXED)

### 1. **FREE UNLIMITED VIDEOS** - CRITICAL
**Issue:** Credits were released immediately when async generation started, allowing users to generate unlimited free videos.

**How it could be exploited:**
```javascript
// User starts video generation
POST /api/generate-video { prompt: "...", pollForCompletion: false }
// Hold created → Hold immediately released → Video generates → NO CHARGE!
// Repeat infinitely for free videos
```

**Fix:** Hold is now kept active throughout generation and only finalized when video completes or fails.

### 2. **No Duplicate Charge Protection**
**Issue:** No database tracking meant no way to prevent charging the same video multiple times if `/api/check-video` was called repeatedly.

**Fix:** New `video_generations` table tracks each video and ensures idempotent finalization.

### 3. **No Error Tracking**
**Issue:** Failed videos didn't show why they failed, making debugging impossible.

**Fix:** Error codes and messages are now stored and displayed to users.

## ✅ Proper Implementation

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Video Generation Flow                     │
└─────────────────────────────────────────────────────────────┘

1. User initiates video generation
   ↓
2. withCreditGuard creates hold (reserves credits)
   ↓
3. Video generation request sent to OpenAI
   ↓
4. video_generations record created (stores hold_id)
   ↓
5. Hold kept ACTIVE (keepHold: true)
   ↓
6. User polls /api/check-video
   ↓
7. When status is 'completed' or 'failed':
   - fn_finalize_video_generation() called
   - If completed: Capture hold (charge credits)
   - If failed: Release hold (refund credits)
   - Idempotency prevents duplicate charges
```

### Database Schema

**New Table: `video_generations`**
```sql
CREATE TABLE video_generations (
  id UUID PRIMARY KEY,
  video_id TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL,
  account_id UUID NOT NULL,
  hold_id UUID REFERENCES credit_holds(id),
  
  -- Video parameters
  model TEXT NOT NULL,
  prompt TEXT,
  seconds TEXT,
  size TEXT,
  orientation TEXT,
  resolution TEXT,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'queued',
  error_code TEXT,
  error_message TEXT,
  
  -- Credit settlement (prevents double charging)
  credits_charged BOOLEAN DEFAULT FALSE,
  charged_amount_microcredits BIGINT,
  charged_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  -- Constraint: Once charged, always charged
  CONSTRAINT video_generations_charge_once CHECK (...)
);
```

### Key Functions

#### 1. `fn_create_video_generation()`
- Creates tracking record for a new video generation
- Links video_id with hold_id
- Idempotent: returns existing record if video_id already exists

#### 2. `fn_finalize_video_generation()`
- Called when video reaches terminal state (completed/failed)
- **Completed**: Captures hold (charges credits)
- **Failed**: Releases hold (refunds credits)
- **Idempotent**: Won't charge twice even if called multiple times
- Updates `credits_charged` flag to prevent re-finalization

### Code Flow

#### API Route: `/api/generate-video`

```typescript
// Async generation (default)
if (pollForCompletion === false) {
  // Store video generation with hold ID
  await createVideoGeneration({
    videoId: video.id,
    userId: context.userId,
    accountId: context.accountId,
    holdId: context.holdId,
    model, prompt, seconds, size, orientation, resolution
  });
  
  // Keep hold active!
  return { 
    response: res, 
    usageUsdMicros: 0, 
    keepHold: true  // ← This prevents hold from being released
  };
}
```

#### API Route: `/api/check-video`

```typescript
// Get video status from OpenAI
const video = await fetch(`${OPENAI_API_BASE}/videos/${videoId}`);

// Check if we're tracking this video
const videoGen = await getVideoGeneration(videoId);

// If terminal state and not yet charged, finalize
if (videoGen && !videoGen.credits_charged && 
    (video.status === 'completed' || video.status === 'failed')) {
  
  await finalizeVideoGeneration(
    videoId,
    video.status,
    video.error?.code,
    video.error?.message
  );
  
  // Now credits are properly charged or refunded
}
```

## 🛡️ Exploit Prevention

### 1. Free Video Generation
**Attack:** Generate videos without paying
**Prevention:** 
- Hold keeps credits reserved throughout generation
- Credits only released if video fails
- `keepHold: true` prevents premature release

### 2. Double Charging
**Attack:** Call `/api/check-video` multiple times to charge user repeatedly
**Prevention:**
- `credits_charged` boolean flag
- Idempotent `fn_finalize_video_generation()`
- Database constraint ensures single charge
- Function checks flag before finalizing

### 3. Hold Expiry Abuse
**Attack:** Start many videos and let holds expire to bypass credit checks
**Prevention:**
- Holds expire after 1 hour (configurable)
- Expired holds automatically cleaned up
- Video generation fails if hold expires before completion

### 4. Race Conditions
**Attack:** Concurrent requests to charge/refund same video
**Prevention:**
- `FOR UPDATE` locks in database functions
- Atomic operations for credit changes
- Idempotency keys

### 5. Incomplete Generation Tracking
**Attack:** Start video generation but delete tracking record
**Prevention:**
- RLS policies on `video_generations` table
- Only service role can delete records
- Users can only read their own records

## 💰 Credit Flow Scenarios

### Scenario 1: Successful Video Generation
```
1. User has 1000 credits
2. Starts 12s sora-2 video (costs 800 credits)
3. Hold created: balance = 200, hold = 800
4. Video generates successfully
5. Hold captured: balance = 200 (charged)
6. video_generations.credits_charged = TRUE
```

### Scenario 2: Moderation Blocked
```
1. User has 1000 credits
2. Starts video with inappropriate content (costs 800 credits)
3. Hold created: balance = 200, hold = 800
4. OpenAI rejects with moderation_blocked
5. Hold released: balance = 1000 (refunded)
6. video_generations.credits_charged = FALSE
7. User sees error: "MODERATION_BLOCKED: Your request..."
```

### Scenario 3: Generation Fails Mid-Process
```
1. User has 1000 credits
2. Starts video (costs 800 credits)
3. Hold created: balance = 200, hold = 800
4. Video starts generating (status: in_progress)
5. OpenAI encounters error (status: failed)
6. User calls /api/check-video
7. Hold released: balance = 1000 (refunded)
8. Error displayed with code and message
```

### Scenario 4: Multiple Status Checks (Idempotency)
```
1. Video completes successfully
2. User calls /api/check-video → Charged 800 credits
3. User calls /api/check-video again → NO additional charge
4. User calls /api/check-video 10 more times → Still NO charge
5. credits_charged flag prevents re-finalization
```

## 🚨 Error Codes

| Error Code | Meaning | Credits Charged | Display to User |
|------------|---------|-----------------|-----------------|
| `moderation_blocked` | Content violates policy | ❌ No | Yes - show code + message |
| `invalid_request` | Bad parameters | ❌ No | Yes - show code + message |
| `rate_limit_exceeded` | Too many requests | ❌ No | Yes - show code + message |
| `server_error` | OpenAI internal error | ❌ No | Yes - show code + message |
| `timeout` | Generation timeout | ❌ No | Yes - show code + message |
| `completed` | Success! | ✅ Yes | No error |

## 📊 Monitoring & Logging

### Key Log Messages

**Hold Created:**
```
🔒 Creating hold: { accountId, estUsdMicros, idempotencyKey }
Hold created: [hold_id]
```

**Hold Kept Active:**
```
⏳ Keeping hold active for later finalization: [hold_id]
✅ Video generation tracked: [video_id] with hold: [hold_id]
```

**Finalization:**
```
🎯 Video generation finalized: { status, video_id, credits_charged }
✅ Credits charged for successful video: [video_id]
💰 Credits refunded for failed video: [video_id] - Error: [error_code]
```

### Database Queries for Monitoring

```sql
-- Videos pending finalization
SELECT video_id, status, created_at, model
FROM video_generations
WHERE credits_charged = FALSE
AND status IN ('queued', 'in_progress')
ORDER BY created_at DESC;

-- Failed videos (refunded)
SELECT video_id, error_code, error_message, created_at
FROM video_generations
WHERE status = 'failed'
AND credits_charged = FALSE
ORDER BY created_at DESC;

-- Successful videos (charged)
SELECT video_id, charged_amount_microcredits, charged_at
FROM video_generations
WHERE status = 'completed'
AND credits_charged = TRUE
ORDER BY charged_at DESC;

-- Orphaned holds (need cleanup)
SELECT h.id, h.amount_microcredits, h.created_at, h.expires_at
FROM credit_holds h
LEFT JOIN video_generations vg ON h.id = vg.hold_id
WHERE h.status = 'active'
AND h.expires_at < NOW()
AND vg.id IS NULL;
```

## 🔧 Migration Guide

### Required Steps

1. **Run Migration 0010:**
```bash
psql -f supabase/migrations/0010_video_generation_tracking.sql
```

2. **Verify Functions Created:**
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name LIKE 'fn_%video%';
```

Expected output:
- `fn_create_video_generation`
- `fn_finalize_video_generation`
- `fn_update_video_generation_timestamp`

3. **Test Hold System:**
```bash
# Start video generation
curl -X POST /api/generate-video \
  -H "Content-Type: application/json" \
  -d '{"prompt": "test", "model": "sora-2", "seconds": "4"}'

# Check status (should show hold is active)
SELECT * FROM credit_holds WHERE status = 'active';

# Check video generation tracking
SELECT * FROM video_generations WHERE video_id = 'video_xxx';
```

## 🎯 Testing Scenarios

### Test 1: Normal Successful Generation
1. Start video generation
2. Wait for completion
3. Call `/api/check-video`
4. Verify credits charged
5. Call `/api/check-video` again
6. Verify NO additional charge

### Test 2: Moderation Block
1. Start video with inappropriate prompt
2. Check status → should be 'failed'
3. Verify error_code = 'moderation_blocked'
4. Verify credits refunded
5. Verify error shown to user

### Test 3: Insufficient Credits
1. User with 100 credits
2. Try to generate 12s sora-2-pro video (costs 1600)
3. Should fail with "insufficient credits"
4. NO hold created
5. Balance unchanged

### Test 4: Concurrent Generations
1. Start 3 videos simultaneously
2. Verify 3 holds created
3. Wait for completion
4. Verify each finalized exactly once
5. Verify correct total charged

## 📝 Best Practices

1. **Always use idempotency keys** for client-side retries
2. **Monitor orphaned holds** and set up cleanup jobs
3. **Log all finalization events** for audit trail
4. **Alert on finalization failures** - these indicate bugs
5. **Review error_codes** regularly to improve prompts/UX
6. **Set up hold expiry cleanup** cron job

## 🔮 Future Enhancements

1. **Webhook Integration**
   - Receive completion notifications from OpenAI
   - Finalize immediately without polling
   - Reduce latency

2. **Partial Refunds**
   - If video fails at 50% progress, charge 50%
   - More fair pricing model

3. **Hold Increase**
   - If generation takes longer than estimated
   - Increase hold mid-generation

4. **Credit Packages**
   - Bulk discounts
   - Subscription plans
   - Loyalty rewards

## 📚 Related Documentation

- `FAILED_REQUEST_HANDLING.md` - Initial error handling documentation
- `/lib/videoGenerations.ts` - Video generation helper functions
- `/lib/withCreditGuard.ts` - Credit guard middleware
- `/supabase/migrations/0008_create_hold_capture_system.sql` - Hold/capture system
- `/supabase/migrations/0010_video_generation_tracking.sql` - Video tracking system

