# 🎬 Lip Sync Feature - Quick Start Guide

## ✅ Implementation Complete!

The lip sync feature has been successfully added to your SCENYX app!

---

## 🚀 Quick Setup (3 Steps)

### 1️⃣ Get Your Replicate API Token
Visit: https://replicate.com/account/api-tokens
- Sign up or log in
- Create a new API token
- Copy it

### 2️⃣ Add to .env.local
```bash
# Add this line to your .env.local file
REPLICATE_API_TOKEN=r8_your_token_here

# Or use the alternative name (already in your env):
REPLIT_KEY=r8_your_token_here
```
**Note**: The code supports both `REPLICATE_API_TOKEN` and `REPLIT_KEY`!

### 3️⃣ Start the Server
```bash
npm run dev
```

Open http://localhost:3000 and click the **[ LIP SYNC ]** tab!

---

## 🎯 How to Use

### Simple 3-Step Process:

1. **Upload Image/Video**
   - Click "Upload Image/Video"
   - Select a portrait photo or video
   - Preview appears below

2. **Choose Audio Method:**
   
   **Option A: Generate from Script**
   - Enter your script text
   - Choose from 6 AI voices (Nova female is default)
   - Click "Generate Voiceover"
   - Wait ~3 seconds for audio
   
   **Option B: Upload Audio**
   - Click "Upload Audio File" 
   - Select MP3, WAV, or other audio file
   - Preview appears

3. **Generate Lip Sync**
   - Click "Generate Lip Sync Video"
   - Wait 30-60 seconds
   - Download your result!

---

## 💰 Pricing

- **Text-to-Speech**: ~0.021 credits per 1000 characters (~$0.015)
- **Lip Sync**: ~0.043 credits per video (~$0.03)
- **Total for script workflow**: ~0.064 credits (~$0.045)

Example:
- 500 character script = 0.01 credits
- Lip sync generation = 0.043 credits  
- **Total = ~0.053 credits** (~$0.037)

---

## 📸 Best Practices

### For Images:
- ✅ Front-facing portraits work best
- ✅ Clear, well-lit faces
- ✅ Neutral expression
- ❌ Avoid side profiles
- ❌ Avoid group photos

### For Audio:
- ✅ Clear speech
- ✅ Moderate pace
- ✅ 5-30 seconds works best
- ❌ Avoid background music
- ❌ Avoid very fast speech

### For Scripts:
- ✅ Natural, conversational tone
- ✅ Short sentences
- ✅ 50-500 words
- ✅ Include pauses with "..."
- ❌ Avoid very long monologues

---

## 🎤 Voice Options

Choose from 6 OpenAI voices:

1. **Alloy** - Neutral, versatile
2. **Echo** - Male voice
3. **Fable** - British male accent  
4. **Onyx** - Deep male voice
5. **Nova** - Female voice (default) ⭐
6. **Shimmer** - Soft female voice

---

## 🔥 Example Use Cases

1. **Product Demos**
   - Upload product image
   - Generate sales pitch audio
   - Create talking product video

2. **Personal Messages**
   - Upload your photo
   - Record or generate message
   - Send as video message

3. **Marketing Content**
   - Stock photo of person
   - Marketing script
   - Instant spokesperson video

4. **Educational Content**
   - Teacher/instructor photo
   - Lesson script
   - Animated teaching video

5. **Social Media**
   - Profile photo
   - Caption/message text
   - Engaging video post

---

## 🐛 Troubleshooting

### "Replicate API token not configured"
- Add `REPLICATE_API_TOKEN` to `.env.local`
- Restart dev server (`npm run dev`)

### "Failed to generate audio"
- Check `OPEN_API_KEY` is valid in `.env.local`
- Script must be under 4096 characters
- Restart dev server if recently added

### "Lip sync generation failed"
- Ensure face is clearly visible in image
- Try a different image (front-facing portrait)
- Check audio file is valid format
- Ensure you have sufficient credits

### Credits not updating
- Refresh the page
- Check browser console for errors
- Verify Supabase connection

---

## 📋 What Was Added

### New API Routes:
- ✅ `/api/generate-tts` - Text-to-speech
- ✅ `/api/generate-lipsync` - Lip sync video
- ✅ `/api/check-lipsync` - Status checking

### New Features:
- ✅ Lip Sync tab in UI
- ✅ Image/video upload with preview
- ✅ Script-to-speech generation
- ✅ 6 voice options
- ✅ Audio file upload
- ✅ Real-time progress tracking
- ✅ Credit cost estimation
- ✅ Download results
- ✅ Error handling

### Files Modified:
- ✅ `lib/pricing.ts` - Added pricing
- ✅ `lib/client/pricing.ts` - Client pricing
- ✅ `app/page.tsx` - New tab & UI
- ✅ `package.json` - Added Replicate SDK

---

## ⚡ Performance

- **TTS Generation**: 2-5 seconds
- **Lip Sync Processing**: 30-60 seconds  
- **Total Time**: ~35-65 seconds
- **Model**: SadTalker (fast & reliable)

---

## 🎉 You're All Set!

1. ✅ Replicate installed
2. ✅ API routes created
3. ✅ UI implemented  
4. ✅ Pricing configured
5. ✅ Credit system integrated

**Just add your Replicate API token and start creating!**

Visit http://localhost:3000 → Click **[ LIP SYNC ]** → Create magic! ✨

---

Questions? Check:
- `LIPSYNC_FEATURE.md` - Full implementation details
- Replicate docs: https://replicate.com/docs
- OpenAI TTS: https://platform.openai.com/docs/guides/text-to-speech
