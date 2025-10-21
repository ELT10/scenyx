import { NextRequest, NextResponse } from 'next/server';
import { withCreditGuard } from '@/lib/withCreditGuard';
import { estimateChatUsdMicros } from '@/lib/pricing';

const QUALITY_MODEL_MAP: Record<string, string> = {
  'nano': 'gpt-5-nano',
  'mini': 'gpt-5-mini',
  'high': 'gpt-5',
};

export const POST = withCreditGuard<{ quality?: string; companyName?: string; companyType?: string; product?: string; thread?: string; orientation?: string; duration?: string }>({
  estimateUsdMicros: async ({ quality = 'mini' }) => {
    const model = QUALITY_MODEL_MAP[quality] || QUALITY_MODEL_MAP['mini'];
    // Conservative estimate with buffer for reasoning tokens
    return estimateChatUsdMicros(model, 2000, 3500);  // Increased buffer
  },
  runWithUsageUsdMicros: async ({ companyName, companyType, product, thread, quality = 'mini', orientation = 'horizontal', duration = '12' }, _req, _context) => {

    if (!companyName || !companyType || !thread) {
      const res = NextResponse.json(
        { error: 'Company name, type, and thread are required' },
        { status: 400 }
      );
      return { response: res, usageUsdMicros: 0 };
    }

    // Get the model based on quality level
    const model = QUALITY_MODEL_MAP[quality] || QUALITY_MODEL_MAP['mini'];
    
    // Determine video dimensions based on orientation
    const videoDimensions = orientation === 'vertical' ? '720x1280 (Portrait)' : '1280x720 (Landscape)';
    const frameComposition = orientation === 'vertical' 
      ? 'Vertical/portrait framing with subjects centered. Optimize for mobile viewing with close-up shots and minimal horizontal movement.'
      : 'Horizontal/landscape framing with wider shots. Utilize full width for cinematic compositions and dynamic camera movements.';

    console.log('Generating script for:', { companyName, companyType, product, thread, quality, model, orientation, duration });

    const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
    const durationSeconds = parseInt(duration ?? '4', 10) || 4;
    const shot1EndSeconds = clamp(Number((durationSeconds * 0.35).toFixed(1)), 1, Math.max(1, durationSeconds - 1));
    const shot2EndSeconds = clamp(
      Number((durationSeconds * 0.7).toFixed(1)),
      shot1EndSeconds + 0.5,
      Math.max(shot1EndSeconds + 0.5, durationSeconds - 0.3)
    );
    const formatSeconds = (value: number) => (Number.isInteger(value) ? `${value}s` : `${value.toFixed(1)}s`);
    const shotRanges = {
      shot1: `0-${formatSeconds(shot1EndSeconds)}`,
      shot2: `${formatSeconds(shot1EndSeconds)}-${formatSeconds(shot2EndSeconds)}`,
      shot3: `${formatSeconds(shot2EndSeconds)}-${formatSeconds(durationSeconds)}`,
    };
    const soraModel = quality === 'high' ? 'sora-2-pro' : 'sora-2';

    const prompt = `You are a senior video director crafting Sora-ready prompts. Reference the official Sora Prompting Guide to translate the provided creative thread into a cohesive ${duration}-second ${orientation} video concept optimized for ${videoDimensions} resolution.

Project Context
Company: ${companyName}
Type: ${companyType}${product ? `\nProduct Details: ${product}` : ''}
Creative Thread Summary: ${thread}
Video Orientation & Framing Notes: ${frameComposition}
Duration: ${duration} seconds

Follow these rules:
- Use concrete visual nouns and active verbs; avoid vague adjectives.
- Lock continuity for subjects, wardrobe, props, lighting logic, and palette across shots unless story progression demands change.
- One camera setup per shot with explicit framing, lensing, motion, depth of field, lighting, palette anchors, and atmosphere cues.
- Break subject actions into 2–4 beats with clear timing logic per shot.
- Include short natural dialogue only if it fits the duration window; otherwise write "None".
- Background sound cues should describe ambience/textures, not licensed music.
- Orientation must inform composition (vertical: centered, tight depth; horizontal: layered wides and lateral motion).
- Replace every parenthetical instruction with specific content. Never leave placeholders or brackets.
- Conclude with a single master prompt paragraph under 900 characters ready to paste into Sora.

Output format (keep headings exactly as written):
${duration}-Second Sora Prompt Blueprint

API Parameters:
- model: ${soraModel}
- size: ${orientation === 'vertical' ? '720x1280' : '1280x720'}
- seconds: "${duration}"

Thread Synopsis:
Provide 2–3 sentences tying company, product, emotional tone, and audience benefit together while honoring the creative thread.

Continuity Anchors:
- Primary subject: define character identity, age range, and defining trait.
- Wardrobe & props: lock wardrobe colors, hero props, and recurring items.
- Environment & lighting logic: set consistent location logic, time of day, and key light sources.
- Palette anchors: note three to five color anchors that stay visible across shots.

Shots:
Shot 1 — [${shotRanges.shot1} | Opening hook]
Prose scene description: write a vivid, specific description of the shot from the viewer perspective.
Cinematography:
- Camera shot: specify framing and angle.
- Lens: specify focal length or style.
- Camera motion: describe the camera move or state that the camera is locked off.
- Depth of field: define shallow, deep, or rack-focus behavior.
- Lighting setup: detail key, fill, rim, and motivation.
- Palette anchors: reiterate visible palette colors in the shot.
- Atmosphere: note haze, particles, weather, or texture in the air.
Actions:
- Beat 1 detail with timing cue.
- Beat 2 detail with timing cue.
Dialogue:
- Provide dialogue line with speaker label, or write "None".
Background sound:
- Describe ambience or foley texture.
On-screen text / CTA:
- Provide text or write "None".

Shot 2 — [${shotRanges.shot2} | Development & product reveal]
Prose scene description: write a vivid, specific description of the shot from the viewer perspective.
Cinematography:
- Camera shot: specify framing and angle.
- Lens: specify focal length or style.
- Camera motion: describe the camera move or state that the camera is locked off.
- Depth of field: define shallow, deep, or rack-focus behavior.
- Lighting setup: detail key, fill, rim, and motivation.
- Palette anchors: reiterate visible palette colors in the shot.
- Atmosphere: note haze, particles, weather, or texture in the air.
Actions:
- Beat 1 detail with timing cue.
- Beat 2 detail with timing cue.
Dialogue:
- Provide dialogue line with speaker label, or write "None".
Background sound:
- Describe ambience or foley texture.
On-screen text / CTA:
- Provide text or write "None".

Shot 3 — [${shotRanges.shot3} | Resolution & brand imprint]
Prose scene description: write a vivid, specific description of the shot from the viewer perspective.
Cinematography:
- Camera shot: specify framing and angle.
- Lens: specify focal length or style.
- Camera motion: describe the camera move or state that the camera is locked off.
- Depth of field: define shallow, deep, or rack-focus behavior.
- Lighting setup: detail key, fill, rim, and motivation.
- Palette anchors: reiterate visible palette colors in the shot.
- Atmosphere: note haze, particles, weather, or texture in the air.
Actions:
- Beat 1 detail with timing cue.
- Beat 2 detail with timing cue.
Dialogue:
- Provide dialogue line with speaker label, or write "None".
Background sound:
- Describe ambience or foley texture.
On-screen text / CTA:
- Provide text or write "None".

Master Prompt (paste into Sora):
"""
Compose a single paragraph that sequences the three shots in order, summarizing camera, lighting, palette anchors, subject actions, dialogue (if any), and ambience cues in flowing prose optimized for Sora generation. Keep it under 900 characters.
"""

Remix Notes:
- Suggest one controlled variation that keeps continuity (for example, lens change or palette shift).
- Suggest one reset lever if the output misfires (for example, simplify action or adjust lighting).`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPEN_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
      model: model,
      messages: [
        {
          role: 'system',
          content: 'You are a professional video advertisement scriptwriter with expertise in short-form content.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
    }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const res = NextResponse.json({ error: errorData.error?.message || 'Failed to generate script', details: errorData }, { status: response.status });
      return { response: res, usageUsdMicros: 0 };
    }

    const data = await response.json();
    const script = data.choices[0].message.content;

    console.log('Generated script:', script);

    const res = NextResponse.json({ success: true, script });
    const usage = data.usage;
    const inputTokens = usage?.prompt_tokens ?? 1000;
    const outputTokens = usage?.completion_tokens ?? 1500;
    const usageUsdMicros = estimateChatUsdMicros(model, inputTokens, outputTokens);
    return { response: res, usageUsdMicros };
  }
});

