import { NextRequest, NextResponse } from 'next/server';

const QUALITY_MODEL_MAP: Record<string, string> = {
  'nano': 'gpt-5-nano',
  'mini': 'gpt-5-mini',
  'high': 'gpt-5',
};

export async function POST(request: NextRequest) {
  try {
    const { companyName, companyType, product, quality = 'mini' } = await request.json();

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

    console.log('Generating threads for:', { companyName, companyType, product, quality, model });

    const prompt = `You are a creative advertising strategist. Generate 4 unique and compelling creative threads/concepts for a 12-second video advertisement.

Company: ${companyName}
Type: ${companyType}${product ? `\nProduct Details: ${product}` : ''}

Each thread should:
- Be concise (1-2 sentences)
- Focus on a unique emotional or narrative angle
- Be suitable for a short, impactful video ad
- Appeal to the target audience

Format your response as a JSON array with 4 objects, each having:
- "id": a unique identifier (1-4)
- "title": a catchy title for the thread (5-8 words)
- "description": the thread concept (1-2 sentences)

Example format:
[
  {
    "id": 1,
    "title": "From Stress to Serenity",
    "description": "A stressed professional discovers the product and finds their moment of peace and relief."
  },
  ...
]

Return ONLY the JSON array, no additional text.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
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
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Thread generation failed:', errorData);
      return NextResponse.json(
        { 
          error: errorData.error?.message || 'Failed to generate threads',
          details: errorData
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Parse the JSON response
    let threads;
    try {
      const parsed = JSON.parse(content);
      // Handle both direct array and wrapped object
      threads = Array.isArray(parsed) ? parsed : (parsed.threads || []);
    } catch (parseError) {
      console.error('Failed to parse threads:', parseError);
      return NextResponse.json(
        { error: 'Failed to parse generated threads' },
        { status: 500 }
      );
    }

    console.log('Generated threads:', threads);

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

