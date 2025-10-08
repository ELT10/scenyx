import { NextRequest, NextResponse } from 'next/server';

const QUALITY_MODEL_MAP: Record<string, string> = {
  'nano': 'gpt-5-nano',
  'mini': 'gpt-5-mini',
  'high': 'gpt-5',
};

export async function POST(request: NextRequest) {
  try {
    const { companyName, companyType, product, quality = 'mini', orientation = 'horizontal', duration = '12' } = await request.json();

    if (!companyName || !companyType) {
      return NextResponse.json(
        { error: 'Company name and type are required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPEN_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key is not configured' },
        { status: 500 }
      );
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
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('=== OPENAI API RESPONSE ===');
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ Thread generation failed:', errorData);
      return NextResponse.json(
        { 
          error: errorData.error?.message || 'Failed to generate threads',
          details: errorData
        },
        { status: response.status }
      );
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
        return NextResponse.json(
          { error: 'API returned empty threads. Please try again.' },
          { status: 500 }
        );
      }
      
      if (threads.length < 4) {
        console.warn(`⚠️ Expected 4 threads but got ${threads.length}`);
      }
    } catch (parseError) {
      console.error('❌ Failed to parse threads:', parseError);
      console.error('Parse error message:', parseError instanceof Error ? parseError.message : 'Unknown error');
      console.error('Raw content that failed to parse:', content);
      return NextResponse.json(
        { error: 'Failed to parse generated threads' },
        { status: 500 }
      );
    }

    console.log('✅ Successfully generated threads:', threads.length, 'items');

    return NextResponse.json({
      success: true,
      threads: threads,
    });

  } catch (error: any) {
    console.error('Error generating threads:', error);
    
    return NextResponse.json(
      { 
        error: error.message || 'Failed to generate threads',
        details: error.response?.data || null
      },
      { status: error.status || 500 }
    );
  }
}

