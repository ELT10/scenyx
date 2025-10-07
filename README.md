# SCENYX - AI Video Generation Platform

A sleek, modern web interface for generating videos using OpenAI's Sora 2 API. Built with Next.js 14, TypeScript, Tailwind CSS, and Framer Motion.

## Features

- 🎨 Modern, terminal-inspired UI with grey/white aesthetic
- ⚡ Fast video generation using OpenAI's Sora 2 API
- 📝 AI-powered script generator for video ads
- 🎯 Three quality levels for text generation (GPT-5 Nano, Mini, and Full)
- 🎬 Generate creative thread options or use custom threads
- 📱 Mobile-friendly design
- 🎬 Video preview and download functionality
- 💫 Beautiful animations with Framer Motion and loading states
- 🎬 Terminal-style interface with scan lines and grid effects
- 🔒 Secure API key management through environment variables
- 🔍 Check video status by video ID
- 🔄 Auto-polling for in-progress videos
- 📊 Real-time progress tracking
- 💾 LocalStorage integration - automatically saves all video IDs
- 📑 Tabbed interface with "Script Generator", "Generate Video", and "View Videos"
- 📼 View all your previously generated videos in one place

## Prerequisites

- Node.js 18.x or higher
- npm or yarn package manager
- OpenAI API key with Sora 2 access

## Getting Started

### 1. Clone the repository

```bash
cd /Users/eltonthomas/Developer/sora2
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Create a `.env.local` file in the root directory:

```bash
cp .env.example .env.local
```

Then edit `.env.local` and add your OpenAI API key:

```
OPEN_API_KEY=your_openai_api_key_here
```

⚠️ **Important:** Make sure to add your actual OpenAI API key. You can get one from [OpenAI's platform](https://platform.openai.com/api-keys).

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## Usage

The interface is organized into three tabs:

### Tab 1: Script Generator

Create professional video ad scripts powered by AI:

1. **Enter Company Details**: Fill in your company name, industry type, and product description
2. **Select Generation Quality**: Choose from three quality levels:
   - **Fast (GPT-5 Nano)**: Quick results, lower quality
   - **Balanced (GPT-5 Mini)**: Good quality, moderate speed (default)
   - **Premium (GPT-5)**: Best quality, uses the most advanced model
3. **Choose Thread Option**:
   - **Option A - Auto-Generate**: Leave the custom thread field empty and click "Generate Thread Options" to get 4 AI-generated creative concepts
   - **Option B - Custom Thread**: Enter your own creative thread/concept in the custom thread field
4. **Select a Thread**: If you chose Option A, select one of the 4 generated thread options
5. **Generate Script**: The AI will create a detailed 12-second video ad script with:
   - Scene-by-scene breakdown
   - Timing for each scene (e.g., 0-3s, 3-7s, 7-12s)
   - Visual descriptions
   - Voice-over (VO) text
   - On-screen text suggestions
6. **Generate Video**: Click "Generate Video" to automatically switch to the Generate Video tab with the script pre-filled

**Example Flow:**
- Company: Naturion
- Type: Hair care / Beauty & Wellness
- Product: Premium hair oil made with natural ingredients
- Thread: "A stressed-out person finding out about Naturion and finding peace"
- Result: Professional 12-second ad script with 3 scenes

### Tab 2: Generate Video

Generate new videos and check specific video statuses:

1. **Enter a prompt**: Describe the video you want to generate in the text area
2. **Generate**: Click the "Generate Video" button or press Enter
3. **Watch Progress**: Real-time progress bar shows generation status and percentage
4. **Wait**: The video generation process typically takes 1-2 minutes
5. **View & Download**: Once generated, the video will appear below with options to download
6. **Auto-Save**: The video ID is automatically saved to localStorage for later access

**Progress Tracking:**
- Progress bar in the generate button shows current percentage
- Detailed progress card displays status (queued, in_progress, completed)
- Video ID is shown while generating for manual tracking
- Automatic polling every 3 seconds for real-time updates

**Check Video Status Feature:**
- Scroll down to find the "Check Video Status" section
- Enter any video ID to check its current status
- View detailed information including progress, model, duration, and resolution
- Use "Start Auto-Poll" for in-progress videos to automatically check every 5 seconds

### Tab 3: View Videos

View all your previously generated videos:

1. **Switch to View Videos**: Click the "📼 View Videos" tab
2. **Browse Videos**: See all videos you've generated (stored in localStorage)
3. **Auto-Load**: Videos automatically load their current status from the API
4. **Watch & Download**: Completed videos can be played inline and downloaded
5. **Refresh**: Click the refresh button to update all video statuses

### Example Prompts

- "A serene sunset over a mountain range with birds flying in the sky"
- "A futuristic city with flying cars and neon lights at night"
- "Ocean waves crashing on a rocky shore during a storm"
- "A cozy cabin in the woods with snow falling gently"

## Project Structure

```
sora2/
├── app/
│   ├── api/
│   │   ├── check-video/
│   │   │   └── route.ts           # API endpoint for checking video status
│   │   ├── generate-script/
│   │   │   └── route.ts           # API endpoint for script generation
│   │   ├── generate-threads/
│   │   │   └── route.ts           # API endpoint for thread generation
│   │   └── generate-video/
│   │       └── route.ts           # API endpoint for video generation
│   ├── globals.css                # Global styles and Tailwind
│   ├── layout.tsx                 # Root layout component
│   └── page.tsx                   # Main page with UI (3 tabs)
├── .env.example                   # Example environment variables
├── .gitignore                     # Git ignore file
├── next.config.mjs                # Next.js configuration
├── package.json                   # Project dependencies
├── postcss.config.mjs             # PostCSS configuration
├── tailwind.config.ts             # Tailwind CSS configuration
└── tsconfig.json                  # TypeScript configuration
```

## API Integration

The application uses OpenAI's Sora 2 Video Generation API through the official OpenAI Node.js SDK. The API integration is handled in the `/app/api/generate-video/route.ts` file.

### How It Works

1. User submits a text prompt
2. Backend calls `openai.videos.createAndPoll()` to generate the video
3. The SDK automatically polls until the video is complete
4. Once completed, the video content is downloaded and sent to the frontend
5. Frontend displays the video for viewing and downloading

### API Endpoints

#### **POST** `/api/generate-threads`

Generate 4 creative thread options for a video ad script.

Request body:
```json
{
  "companyName": "Naturion",
  "companyType": "Hair care / Beauty & Wellness",
  "product": "Premium hair oil made with natural ingredients that nourishes and strengthens hair",
  "quality": "mini"  // Optional: "nano" | "mini" | "high" (default: "mini")
}
```

**Quality Levels:**
- `nano`: Uses GPT-5 Nano - Fast, lower quality
- `mini`: Uses GPT-5 Mini - Balanced (default)
- `high`: Uses GPT-5 - Premium quality

Response:
```json
{
  "success": true,
  "threads": [
    {
      "id": 1,
      "title": "From Stress to Serenity",
      "description": "A stressed professional discovers the product and finds their moment of peace and relief."
    },
    {
      "id": 2,
      "title": "Natural Beauty Awakens",
      "description": "A person embraces their natural beauty journey and discovers the transformation through the product."
    },
    ...
  ]
}
```

#### **POST** `/api/generate-script`

Generate a detailed 12-second video ad script.

Request body:
```json
{
  "companyName": "Naturion",
  "companyType": "Hair care / Beauty & Wellness",
  "product": "Premium hair oil made with natural ingredients",
  "thread": "A stressed-out person finding out about Naturion and finding peace",
  "quality": "mini"  // Optional: "nano" | "mini" | "high" (default: "mini")
}
```

**Quality Levels:**
- `nano`: Uses GPT-5 Nano - Fast, lower quality
- `mini`: Uses GPT-5 Mini - Balanced (default)
- `high`: Uses GPT-5 - Premium quality

Response:
```json
{
  "success": true,
  "script": "12-Second Video Ad Script\n\nScene 1 — [0-3s | Stress & tension]\n(Visual: Warm, dim light...)\nVO: \"Long days... endless stress...\"\n\n..."
}
```

#### **POST** `/api/generate-video`

Generate a new video from a text prompt.

Request body:
```json
{
  "prompt": "Your video description here",
  "pollForCompletion": false  // Optional: if false, returns immediately with video_id
}
```

Response (when `pollForCompletion: false`):
```json
{
  "success": true,
  "video_id": "video_abc123...",
  "status": "queued",
  "model": "sora-2-pro",
  "progress": 0,
  "message": "Video generation started. Use the video_id to check progress."
}
```

Response (when `pollForCompletion: true` or not specified, legacy mode):
```json
{
  "success": true,
  "video_data": "data:video/mp4;base64,...",
  "video_id": "video_abc123...",
  "status": "completed",
  "model": "sora-2",
  "progress": 100
}
```

#### **GET** `/api/check-video?video_id={video_id}`

Check the status of an existing video generation job.

Query parameters:
- `video_id`: The ID of the video to check

Response:
```json
{
  "success": true,
  "video_id": "video_abc123...",
  "status": "in_progress",
  "progress": 45,
  "model": "sora-2-pro",
  "created_at": 1696723200,
  "seconds": "12",
  "size": "1280x720"
}
```

Status values:
- `queued`: Video generation is queued
- `in_progress`: Video is being generated (includes progress percentage)
- `completed`: Video is ready (includes video_data if available)
- `failed`: Video generation failed (includes error details)

## Building for Production

To create a production build:

```bash
npm run build
npm start
```

## Technology Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **API Client**: OpenAI Node.js SDK
- **Runtime**: Node.js

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPEN_API_KEY` | Your OpenAI API key | Yes |

## Troubleshooting

### "OpenAI API key is not configured" error

Make sure you have created a `.env.local` file and added your API key:
```
OPEN_API_KEY=sk-your-api-key-here
```

### Video generation fails

1. Verify your API key is correct and has Sora 2 access
2. Check the OpenAI API status page
3. Review the console logs for detailed error messages

### Styling issues

If you notice styling problems, try:
```bash
npm run dev
```
This will rebuild the Tailwind CSS.

## Notes

- **API Availability**: As of the development date, OpenAI's Sora 2 API may still be in beta or limited access. Make sure your API key has the necessary permissions.
- **Cost**: Video generation using Sora 2 may incur costs based on OpenAI's pricing. Monitor your usage in the OpenAI dashboard.
- **Rate Limits**: Be aware of OpenAI's rate limits and implement appropriate error handling for your use case.
- **Video Generation Time**: Video generation typically takes 1-2 minutes. The application uses `createAndPoll()` which automatically handles the polling for you.
- **Video Format**: Generated videos are returned as MP4 files and are displayed inline in the browser using base64 encoding.
- **LocalStorage**: Video IDs are stored in your browser's localStorage under the key `sora_video_ids`. This data persists across sessions but is browser-specific.
- **Privacy**: All video IDs are stored locally in your browser only - no external database is used.

## License

MIT License - feel free to use this project for your own purposes.

## Support

For issues related to:
- **This interface**: Check the console logs and ensure all dependencies are installed
- **OpenAI API**: Visit [OpenAI's documentation](https://platform.openai.com/docs) or contact their support
- **Sora 2 access**: Contact OpenAI regarding API access

## Contributing

Feel free to submit issues and enhancement requests!

---

Built with ❤️ using Next.js and OpenAI's Sora 2 API

**SCENYX** - Next-Generation AI Video Creation

