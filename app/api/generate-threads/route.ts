import { NextRequest, NextResponse } from 'next/server';
import { withCreditGuard } from '@/lib/withCreditGuard';
import { estimateChatUsdMicros } from '@/lib/pricing';

const QUALITY_MODEL_MAP: Record<string, string> = {
  'nano': 'gpt-5-nano',
  'mini': 'gpt-5-mini',
  'high': 'gpt-5',
};

export const POST = withCreditGuard<{ quality?: string; companyName?: string; companyType?: string; product?: string; orientation?: string; duration?: string }>({
  estimateUsdMicros: async ({ quality = 'mini' }) => {
    const model = QUALITY_MODEL_MAP[quality] || QUALITY_MODEL_MAP['mini'];
    // Conservative upper-bound estimate with buffer for reasoning tokens
    // GPT-5 can use significant reasoning tokens, so estimate high
    return estimateChatUsdMicros(model, 1000, 3000);  // Increased buffer
  },
  runWithUsageUsdMicros: async ({ companyName, companyType, product, quality = 'mini', orientation = 'horizontal', duration = '12' }) => {

    if (!companyName || !companyType) {
      const res = NextResponse.json(
        { error: 'Company name and type are required' },
        { status: 400 }
      );
      return { response: res, usageUsdMicros: 0 };
    }

    // Get the model based on quality level
    const model = QUALITY_MODEL_MAP[quality] || QUALITY_MODEL_MAP['mini'];
    
    // Determine video dimensions based on orientation
    const videoDimensions = orientation === 'vertical' ? '720x1280 (Portrait)' : '1280x720 (Landscape)';
    const formatContext = orientation === 'vertical' 
      ? 'mobile-first portrait video suitable for social media platforms like Instagram Stories, TikTok, and YouTube Shorts'
      : 'traditional landscape video suitable for YouTube, TV, and desktop viewing';

    console.log('=== GENERATE THREADS REQUEST ===');
    console.log('Input parameters:', { companyName, companyType, product, quality, model, orientation, duration });

    const prompt = `You are a creative advertising strategist. Generate 4 unique and compelling creative threads/concepts for a ${duration}-second ${orientation} video advertisement.

Company: ${companyName}
Type: ${companyType}${product ? `\nProduct Details: ${product}` : ''}
Video Format: ${videoDimensions} - ${formatContext}
Duration: ${duration} seconds

Each thread should:
- Be concise (1-2 sentences)
- Focus on a unique emotional or narrative angle
- Be suitable for a ${duration}-second ${orientation} video ad (${videoDimensions})
- Be optimized for ${formatContext}
- Appeal to the target audience
- Consider the ${duration}-second time constraint when suggesting narrative concepts

Format your response as a JSON object with a "threads" array containing 4 objects.

REQUIRED FORMAT (you MUST follow this exact structure):
{
  "threads": [
    {
      "id": 1,
      "title": "From Stress to Serenity",
      "description": "A stressed professional discovers the product and finds their moment of peace and relief."
    },
    {
      "id": 2,
      "title": "...",
      "description": "..."
    },
    {
      "id": 3,
      "title": "...",
      "description": "..."
    },
    {
      "id": 4,
      "title": "...",
      "description": "..."
    }
  ]
}

IMPORTANT: Return a JSON object with a "threads" array containing exactly 4 thread objects. Do not return a single object or a plain array.`;

    const requestBody = {
      model: model,
      messages: [
        {
          role: 'system',
          content: 'You are a creative advertising strategist specializing in short-form video content.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: "json_object" }
    };

    console.log('=== OPENAI API REQUEST ===');
    console.log('Model:', model);
    console.log('Prompt length:', prompt.length);
    console.log('Full request body:', JSON.stringify(requestBody, null, 2));

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPEN_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const res = NextResponse.json({ error: errorData.error?.message || 'Failed to generate threads', details: errorData }, { status: response.status });
      return { response: res, usageUsdMicros: 0 };
    }

    const data = await response.json();
    console.log('Full API response:', JSON.stringify(data, null, 2));
    
    const content = data.choices[0].message.content;
    console.log('Raw content from API:', content);
    console.log('Content type:', typeof content);
    console.log('Content length:', content?.length);
    
    // Parse the JSON response
    let threads;
    try {
      const parsed = JSON.parse(content);
      console.log('Parsed content:', JSON.stringify(parsed, null, 2));
      console.log('Is parsed an array?', Array.isArray(parsed));
      
      // Handle different response formats
      if (Array.isArray(parsed)) {
        // Direct array
        threads = parsed;
        console.log('Format: Direct array');
      } else if (parsed.threads && Array.isArray(parsed.threads)) {
        // Object with threads property
        threads = parsed.threads;
        console.log('Format: Object with threads array');
      } else if (parsed.id && parsed.title && parsed.description) {
        // Single thread object - wrap it in an array and warn
        console.warn('⚠️ API returned single object instead of array, wrapping it');
        threads = [parsed];
      } else {
        // Unknown format
        console.error('❌ Unknown format. Object keys:', Object.keys(parsed));
        threads = [];
      }
      
      console.log('Extracted threads:', JSON.stringify(threads, null, 2));
      console.log('Threads count:', threads.length);
      
      if (!Array.isArray(threads)) {
        console.error('❌ Threads is not an array:', threads);
        console.error('Parsed object keys:', Object.keys(parsed));
      }
      
      if (threads.length === 0) {
        console.error('❌ Empty threads array!');
        console.error('Original parsed object:', parsed);
        const res = NextResponse.json(
          { error: 'API returned empty threads. Please try again.' },
          { status: 500 }
        );
        return { response: res, usageUsdMicros: 0 };
      }
      
      if (threads.length < 4) {
        console.warn(`⚠️ Expected 4 threads but got ${threads.length}`);
      }
    } catch (parseError) {
      console.error('❌ Failed to parse threads:', parseError);
      console.error('Parse error message:', parseError instanceof Error ? parseError.message : 'Unknown error');
      console.error('Raw content that failed to parse:', content);
      const res = NextResponse.json(
        { error: 'Failed to parse generated threads' },
        { status: 500 }
      );
      return { response: res, usageUsdMicros: 0 };
    }

    console.log('✅ Successfully generated threads:', threads.length, 'items');

    const res = NextResponse.json({ success: true, threads });
    const usage = data.usage;
    const inputTokens = usage?.prompt_tokens ?? 600;
    const outputTokens = usage?.completion_tokens ?? 800;
    const usageUsdMicros = estimateChatUsdMicros(model, inputTokens, outputTokens);
    return { response: res, usageUsdMicros };
  }
});

