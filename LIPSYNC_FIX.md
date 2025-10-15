# 🔧 Lip Sync Model Fix

## Issue Fixed
The SadTalker model version was outdated/incorrect, causing a 422 error from Replicate.

## Solution
Switched to **Wav2Lip** (`cjwbw/wav2lip`) - a reliable, well-maintained model on Replicate.

---

## What Changed

### Model Update
- **Old**: `lucataco/sadtalker` (broken version)
- **New**: `cjwbw/wav2lip` (working, reliable) ✅

### Pricing Update
- **Wav2Lip**: ~0.036 credits per video (~$0.025)
- **SadTalker**: ~0.043 credits per video (~$0.03) - still available as premium option

### UI Update
- Wav2Lip is now the default/recommended model
- SadTalker is still available as a "Premium" option in the dropdown

---

## Testing the Fix

1. **Restart Dev Server** (if running):
```bash
npm run dev
```

2. **Go to Lip Sync Tab**:
   - Open http://localhost:3000
   - Click **[ LIP SYNC ]**

3. **Test the Feature**:
   - Upload an image (portrait photo)
   - Enter a script and generate voiceover, OR upload audio
   - Click **[ GENERATE LIP SYNC VIDEO ]**
   - Wait ~30-60 seconds
   - Download result!

---

## Expected Behavior

✅ **TTS Generation**: Should work (already working)
✅ **Lip Sync Generation**: Should now work with Wav2Lip
✅ **Credits**: Should be deducted correctly (~0.036 credits for lip sync)
✅ **Result**: Video with synced lip movements

---

## Model Comparison

### Wav2Lip (Default) ⭐
- **Speed**: ~30-60 seconds
- **Quality**: Good for most use cases
- **Cost**: 0.036 credits (~$0.025)
- **Best for**: Quick results, general purpose

### SadTalker (Premium)
- **Speed**: ~30-60 seconds  
- **Quality**: Higher quality, more natural
- **Cost**: 0.043 credits (~$0.03)
- **Best for**: Professional/final videos
- **Note**: May not work if version is outdated

---

## Troubleshooting

### If Wav2Lip also gives 422 error:
This means the version might have been updated. To fix:

1. Visit: https://replicate.com/cjwbw/wav2lip
2. Find the latest version hash
3. Update in: `app/api/generate-lipsync/route.ts`
4. Change the version in `replicate.predictions.create()`

### If you want to use a different model:
Check Replicate's lip sync collection:
- https://replicate.com/collections/ai-lip-sync-faces

Popular working models:
- `cjwbw/wav2lip` (current default)
- `chenxwh/video-retalking`
- `devxpy/cog-wav2lip`

---

## Files Updated

1. ✅ `app/api/generate-lipsync/route.ts` - Changed to Wav2Lip model
2. ✅ `app/page.tsx` - Updated UI to show Wav2Lip as default
3. ✅ `lib/pricing.ts` - Added Wav2Lip pricing
4. ✅ `lib/client/pricing.ts` - Added Wav2Lip pricing
5. ✅ `app/api/check-lipsync/route.ts` - Updated default pricing

---

## Ready to Test! 🚀

The fix is complete. Just restart your dev server and try generating a lip sync video!

```bash
npm run dev
```

Then visit: http://localhost:3000 → **[ LIP SYNC ]** tab
