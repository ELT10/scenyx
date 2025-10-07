# OpenAI Sora 2 API Reference

This document provides information about integrating with OpenAI's Sora 2 video generation API.

## Overview

The Sora 2 API allows you to generate videos from text prompts using OpenAI's advanced AI model. The API follows OpenAI's standard patterns and authentication methods.

## Authentication

All API requests require authentication using your OpenAI API key:

```typescript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPEN_API_KEY,
});
```

## API Endpoints

### Generate Video

Generate a video from a text prompt using the Sora 2 API.

**Method 1: Using createAndPoll (Recommended)**

This method automatically handles polling and returns when the video is complete:

```typescript
const video = await openai.videos.createAndPoll({
  model: 'sora-2',
  prompt: "Your video description prompt here",
});

if (video.status === 'completed') {
  console.log('Video successfully completed:', video);
}
```

**Method 2: Manual Polling**

For more control over the polling process:

```typescript
// Start video generation
let video = await openai.videos.create({
  model: 'sora-2',
  prompt: "Your video description prompt here",
});

// Poll for completion
while (video.status === 'in_progress' || video.status === 'queued') {
  video = await openai.videos.retrieve(video.id);
  console.log('Progress:', video.progress);
  await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
}
```

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `model` | string | Yes | The model to use (e.g., "sora-2", "sora-2-pro") |
| `prompt` | string | Yes | The text description of the video to generate |

### Response Format

The video generation response includes:

```typescript
{
  id: string;              // Unique identifier for the video
  object: string;          // Object type (e.g., "video")
  created_at: number;      // Unix timestamp
  status: string;          // "queued" | "in_progress" | "completed" | "failed"
  model: string;           // Model used (e.g., "sora-2")
  progress?: number;       // Progress percentage (0-100)
  seconds?: string;        // Video duration
  size?: string;           // Video resolution (e.g., "1280x720")
}
```

### Download Video Content

Once the video is completed, download the content:

```typescript
const content = await openai.videos.downloadContent(video.id);
const arrayBuffer = await content.arrayBuffer();
const buffer = Buffer.from(arrayBuffer);

// Save to file
fs.writeFileSync('video.mp4', buffer);
```

## Example Usage

### Basic Video Generation with createAndPoll

```typescript
async function generateVideo(prompt: string) {
  const openai = new OpenAI({
    apiKey: process.env.OPEN_API_KEY,
  });

  const video = await openai.videos.createAndPoll({
    model: 'sora-2',
    prompt: prompt,
  });

  if (video.status === 'completed') {
    // Download the video
    const content = await openai.videos.downloadContent(video.id);
    return content;
  } else {
    throw new Error(`Video generation failed with status: ${video.status}`);
  }
}
```

### With Manual Polling and Progress Updates

```typescript
async function generateVideoWithProgress(prompt: string, onProgress: (progress: number) => void) {
  const openai = new OpenAI({
    apiKey: process.env.OPEN_API_KEY,
  });

  // Start generation
  let video = await openai.videos.create({
    model: 'sora-2',
    prompt: prompt,
  });

  // Poll until complete
  while (video.status === 'in_progress' || video.status === 'queued') {
    video = await openai.videos.retrieve(video.id);
    
    if (video.progress) {
      onProgress(video.progress);
    }
    
    // Wait 2 seconds before next poll
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  if (video.status === 'failed') {
    throw new Error('Video generation failed');
  }

  // Download the completed video
  const content = await openai.videos.downloadContent(video.id);
  return content;
}
```

### With Error Handling (Full Example)

```typescript
async function generateVideoSafe(prompt: string) {
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPEN_API_KEY,
    });

    console.log('Starting video generation...');
    
    const video = await openai.videos.createAndPoll({
      model: 'sora-2',
      prompt: prompt,
    });

    if (video.status !== 'completed') {
      throw new Error(`Video generation failed with status: ${video.status}`);
    }

    console.log('Video completed, downloading content...');
    
    const content = await openai.videos.downloadContent(video.id);
    const arrayBuffer = await content.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return {
      success: true,
      videoBuffer: buffer,
      videoId: video.id,
      model: video.model,
    };
  } catch (error: any) {
    console.error('Video generation failed:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}
```

## Best Practices

### 1. Prompt Engineering

Write clear, descriptive prompts:
- ✅ "A serene mountain landscape at sunset with birds flying across an orange sky"
- ❌ "mountains"

### 2. Error Handling

Always implement robust error handling:
```typescript
try {
  const video = await generateVideo(prompt);
} catch (error) {
  if (error.status === 401) {
    // Invalid API key
  } else if (error.status === 429) {
    // Rate limit exceeded
  } else if (error.status === 500) {
    // Server error
  }
}
```

### 3. Rate Limiting

Implement rate limiting on your client side to avoid hitting API limits:
```typescript
// Example: Simple rate limiter
let lastRequest = 0;
const MIN_REQUEST_INTERVAL = 1000; // 1 second

async function rateLimitedGenerate(prompt: string) {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequest;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve => 
      setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest)
    );
  }
  
  lastRequest = Date.now();
  return await generateVideo(prompt);
}
```

### 4. Security

- Never expose your API key in client-side code
- Always use environment variables
- Implement server-side API routes (like in this project)
- Consider implementing usage limits per user

## Common Error Codes

| Code | Description | Solution |
|------|-------------|----------|
| 401 | Invalid authentication | Check your API key |
| 429 | Rate limit exceeded | Implement exponential backoff |
| 500 | Server error | Retry with exponential backoff |
| 503 | Service unavailable | Retry later |

## Rate Limits

OpenAI applies rate limits based on your account tier:
- Requests per minute (RPM)
- Tokens per minute (TPM)
- Requests per day (RPD)

Check your current limits in the [OpenAI dashboard](https://platform.openai.com/account/rate-limits).

## Pricing

Video generation costs vary based on:
- Video length
- Video resolution
- Model used (Sora 2)

Check the latest pricing at [OpenAI Pricing](https://openai.com/pricing).

## Additional Resources

- [OpenAI Platform Documentation](https://platform.openai.com/docs)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- [OpenAI Community Forum](https://community.openai.com)
- [OpenAI Status Page](https://status.openai.com)

## Notes

⚠️ **Important:** As of the latest update, the Sora 2 API may still be in beta or limited access. The exact API structure may differ from standard OpenAI patterns. Please refer to the official OpenAI documentation for the most up-to-date information.

The implementation in this project follows typical OpenAI API patterns and may need adjustment based on the final API specification.

## Support

For API-specific questions or issues:
1. Check the [OpenAI documentation](https://platform.openai.com/docs)
2. Visit the [OpenAI Community Forum](https://community.openai.com)
3. Contact OpenAI support through your dashboard

---

Last updated: October 2025

