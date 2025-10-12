# Fix Verification Guide

## 🚨 What Was Fixed

### Problem
1. SQL constraint was too strict - failed videos couldn't be finalized
2. Function used `0` instead of `NULL` for failed videos
3. Credits got stuck when finalization failed
4. Your test video lost 0.57 credits permanently

### Solution Implemented
1. ✅ Fixed SQL constraint to allow three states (NULL/FALSE/TRUE)
2. ✅ Function now uses NULL for failed videos
3. ✅ Smart finalization - only when OpenAI returns terminal status
4. ✅ Emergency hold release if finalization fails
5. ✅ Migration to auto-release stuck holds

## 📋 Steps to Apply Fix

### Step 1: Run the Patch Migration

```bash
cd /Users/eltonthomas/Developer/scenyx

# Apply the fix migration (this will also release your stuck hold)
psql $DATABASE_URL -f supabase/migrations/0011_fix_video_generation_constraint.sql
```

**Expected output:**
```
ALTER TABLE
ALTER TABLE
ALTER TABLE
NOTICE:  Released stuck hold for video video_68ea81978cb081908cc1ae4e40deb2fe0bc42021c18534f3 (hold: 1ed8f5d1-eb06-4de5-a16b-a859b3455ea0, amount: 400000)
NOTICE:  ✅ Released 1 stuck holds and refunded credits
DO
```

### Step 2: Verify Your Credits Were Refunded

```sql
-- Check your balance (should be back to ~2.29 credits)
SELECT balance_microcredits / 1000000.0 as balance_credits
FROM accounts
WHERE user_id = 'bbaa5804-43a6-4843-a68e-631446a13028';

-- Check the hold was released
SELECT status 
FROM credit_holds 
WHERE id = '1ed8f5d1-eb06-4de5-a16b-a859b3455ea0';
-- Should return: 'released'

-- Check the video generation was finalized
SELECT 
  video_id,
  status,
  credits_charged,
  error_code,
  charged_at
FROM video_generations
WHERE video_id = 'video_68ea81978cb081908cc1ae4e40deb2fe0bc42021c18534f3';
-- Should show:
-- status: 'failed'
-- credits_charged: false
-- error_code: 'moderation_blocked'
-- charged_at: (timestamp when migration ran)
```

### Step 3: Test the Fix with New Video

```bash
# Test 1: Generate a video that will be moderation blocked
curl -X POST http://localhost:3000/api/generate-video \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "prompt": "test inappropriate content",
    "model": "sora-2",
    "seconds": "4",
    "pollForCompletion": false
  }'

# Save the video_id from response

# Wait a few seconds, then check status
curl "http://localhost:3000/api/check-video?video_id=VIDEO_ID" \
  -H "Cookie: your-session-cookie"

# Should see:
# - status: "failed"
# - error: { code: "moderation_blocked", message: "..." }
# - Logs show: "💰 Credits refunded - OpenAI returned failed status"
```

### Step 4: Verify in Database

```sql
-- Check the failed video was properly finalized
SELECT 
  vg.video_id,
  vg.status,
  vg.credits_charged,
  vg.error_code,
  h.status as hold_status,
  h.amount_microcredits / 1000000.0 as hold_amount
FROM video_generations vg
JOIN credit_holds h ON h.id = vg.hold_id
WHERE vg.video_id = 'VIDEO_ID_FROM_TEST';

-- Expected results:
-- status: 'failed'
-- credits_charged: false
-- error_code: 'moderation_blocked'
-- hold_status: 'released'
```

## 🧪 Test Scenarios

### Test 1: Moderation Block (Refund)
```bash
# Generate video with inappropriate content
# Expected: 
# - Video fails
# - Error shown: "MODERATION_BLOCKED: ..."
# - Credits refunded
# - Hold released
```

### Test 2: Successful Video (Charge)
```bash
# Generate video with appropriate content
# Expected:
# - Video completes
# - Credits charged
# - Hold captured
```

### Test 3: Network Error (Hold Stays Active)
```bash
# Simulate by killing OpenAI API connection mid-generation
# Or wait for natural network error
# Expected:
# - Error message: "Network or server error..."
# - Note: "Credits remain reserved..."
# - Hold stays ACTIVE (not released)
# - Can check again later when network recovers
```

### Test 4: Idempotency (No Double Charge)
```bash
# Check status of completed video 10 times
# Expected:
# - Only charged once
# - Logs show: "✓ Video already finalized"
```

## 📊 Key Log Messages

### Successful Refund (Failed Video)
```
✅ Video status from OpenAI: failed video_xxx
🎯 Terminal status received from OpenAI: failed
✅ Finalization successful: { status: 'failed_and_refunded', ... }
💰 Credits refunded - OpenAI returned failed status: video_xxx - Error: moderation_blocked
```

### Successful Charge (Completed Video)
```
✅ Video status from OpenAI: completed video_xxx
🎯 Terminal status received from OpenAI: completed
✅ Finalization successful: { status: 'completed_and_charged', ... }
💳 Credits charged for successful video: video_xxx
```

### Network Error (Hold Preserved)
```
❌ OpenAI API error (status check failed): 500 ...
```
Response includes: `"note": "Credits remain reserved. Video may still be generating."`

### Still Generating (Hold Active)
```
✅ Video status from OpenAI: in_progress video_xxx
⏳ Video still generating, hold remains active: in_progress
```

### Already Finalized (Idempotency)
```
✅ Video status from OpenAI: completed video_xxx
✓ Video already finalized, credits_charged: true
```

## 🔍 Monitoring Queries

### Check Active Holds
```sql
SELECT 
  vg.video_id,
  vg.status as video_status,
  vg.created_at,
  NOW() - vg.created_at as age,
  h.status as hold_status,
  h.amount_microcredits / 1000000.0 as hold_amount,
  h.expires_at
FROM video_generations vg
JOIN credit_holds h ON h.id = vg.hold_id
WHERE vg.credits_charged IS NULL
AND h.status = 'active'
ORDER BY vg.created_at DESC;
```

### Check Recent Failures
```sql
SELECT 
  video_id,
  error_code,
  error_message,
  created_at,
  charged_at - created_at as finalization_time
FROM video_generations
WHERE status = 'failed'
AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

### Check Credit Usage Today
```sql
SELECT 
  COUNT(*) as total_videos,
  SUM(CASE WHEN credits_charged = TRUE THEN 1 ELSE 0 END) as charged_videos,
  SUM(CASE WHEN credits_charged = FALSE THEN 1 ELSE 0 END) as refunded_videos,
  SUM(CASE WHEN credits_charged IS NULL THEN 1 ELSE 0 END) as pending_videos,
  SUM(CASE WHEN credits_charged = TRUE THEN charged_amount_microcredits ELSE 0 END) / 1000000.0 as total_charged_dollars
FROM video_generations
WHERE created_at::DATE = CURRENT_DATE;
```

## ✅ Success Criteria

After applying the fix, verify:

1. ✅ Your stuck credits were refunded (balance ~2.29)
2. ✅ Failed videos show error codes to users
3. ✅ Failed videos get refunds (credits_charged = FALSE)
4. ✅ Successful videos get charged (credits_charged = TRUE)
5. ✅ Network errors don't trigger refunds (hold stays active)
6. ✅ Multiple status checks don't cause double charges
7. ✅ No SQL constraint violations in logs

## 🚨 If Something Goes Wrong

### Migration Fails
```bash
# Check what went wrong
psql $DATABASE_URL -c "
  SELECT conname, pg_get_constraintdef(oid) 
  FROM pg_constraint 
  WHERE conrelid = 'video_generations'::regclass;
"

# If constraint already fixed, that's fine - skip migration
```

### Hold Still Stuck
```sql
-- Manually release hold
SELECT fn_release_hold('HOLD_ID_HERE');

-- Manually mark video as finalized
UPDATE video_generations
SET 
  credits_charged = FALSE,
  charged_amount_microcredits = NULL,
  charged_at = NOW()
WHERE video_id = 'VIDEO_ID_HERE';
```

### Credits Not Refunded
```sql
-- Check ledger to see what happened
SELECT * FROM credits_ledger
WHERE hold_id = 'HOLD_ID_HERE'
ORDER BY created_at DESC;

-- If hold was captured instead of released, contact support
```

## 📞 Support

If you encounter issues:

1. Check logs for error messages
2. Run monitoring queries above
3. Check if migration completed successfully
4. Verify constraint is correct:
   ```sql
   \d video_generations
   ```

## 🎉 Done!

Once verified, your system will:
- ✅ Only charge for successful videos
- ✅ Refund failed videos with error details
- ✅ Handle network errors gracefully
- ✅ Prevent all exploitation attempts
- ✅ Track everything for audit trail

**Your 0.57 credits should be refunded after running the migration!** 💰

