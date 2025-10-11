# JSON Prompting for Sora 2: A Guide to Creating Hyper-Realistic AI Videos

## Introduction

Sora 2, released by OpenAI on September 30, 2025, represents a significant advancement in AI video generation, capable of producing videos that mimic real-world physics, motion, and consistency. Traditional natural-language prompts often lead to suboptimal results due to ambiguity and token inefficiency. JSON prompting addresses this by structuring instructions as key-value pairs, allowing the model to process directives more efficiently and allocate more computational resources to visual fidelity.

This report distills the techniques from a comprehensive X thread by @EXM7777, an AI agency operator, posted on October 10, 2025. The thread outlines a systematic approach to JSON prompting, emphasizing temporal sequencing, layered components, and template-based workflows for scalable, photorealistic outputs.

## Why Use JSON Prompting for Sora 2?

JSON (JavaScript Object Notation) transforms vague, essay-like prompts into organized, machine-readable structures. Consider the difference:

- **Natural Language Example**: "Create a cinematic video of a sunset over mountains with dramatic lighting and smooth camera movement."
- **JSON Equivalent**:
  ```json
  {
    "scene": {
      "subject": "sunset over rugged mountains",
      "environment": "alpine landscape with pine trees"
    },
    "camera": {
      "movement": "smooth pan right",
      "angle": "low angle"
    },
    "lighting": {
      "type": "dramatic golden hour",
      "mood": "epic"
    }
  }
  ```

### Key Benefits
- **Reduced Ambiguity**: Labels ensure elements like "dramatic" apply precisely (e.g., to lighting, not motion).
- **Token Efficiency**: Skips linguistic overhead—90% fewer tokens for the same information, freeing resources for generation.
- **Temporal Focus**: Sora 2 excels at understanding scene evolution (physics, cause-and-effect), so JSON enables timeline-based prompting.
- **Consistency and Realism**: More processing power for details like reflections, shadows, and multi-subject coherence.

Without structure, prompts waste cycles on parsing, resulting in "AI-looking" videos. JSON channels creativity through precision, yielding outputs that challenge viewers to distinguish them from real footage.

## Core Components of a JSON Prompt

Every effective Sora 2 JSON prompt includes five layered components: scene (spatial), camera (perspective), motion (temporal), lighting (mood), and timeline (pacing). Nest them logically for maintainability.

### 1. Scene Description (Spatial Foundation)
Defines "what's in the frame" with specific relationships.

**Example**:
```json
{
  "scene": {
    "subject": "elderly craftsman in workshop",
    "environment": "cluttered wooden workbench with tools",
    "objects": ["vintage hand saw", "wood shavings", "half-finished chair"],
    "composition": "medium shot, rule of thirds"
  }
}
```
- Avoid vagueness (e.g., "a nice workshop")—specify positions and interactions for depth.

### 2. Camera Parameters (Perspective and Framing)
Leverage cinematography terms Sora 2 understands.

**Example**:
```json
{
  "camera": {
    "angle": "eye level, slight dutch tilt",
    "movement": "slow dolly left to right",
    "lens": "35mm equivalent, shallow depth of field",
    "focus": "subject sharp, background soft bokeh"
  }
}
```
- Key: Dynamic movement prevents static, fake appearances.

### 3. Motion and Action (Temporal Dynamics)
Layer primary, secondary, and tertiary motions for realism.

**Example**:
```json
{
  "motion": {
    "primary": "hands carefully sanding wood grain",
    "secondary": "dust particles floating through light beam",
    "tertiary": "workshop fan oscillating in background",
    "pace": "calm, meditative"
  }
}
```
- Sora 2 simulates physics naturally—prompt for momentum and interactions.

### 4. Lighting and Atmosphere (Mood and Believability)
Use motivated lighting sources for emotional depth.

**Example**:
```json
{
  "lighting": {
    "source": "single window, late afternoon",
    "direction": "45 degrees camera left",
    "quality": "soft directional with visible god rays",
    "color_temp": "warm 3200K",
    "mood": "nostalgic, contemplative"
  }
}
```
- Vague "good lighting" fails; specify direction and quality to avoid uncanny valley effects.

### 5. Temporal Structure (Pacing and Narrative)
Choreograph evolution over time.

**Example**:
```json
{
  "timeline": {
    "0-2s": "establish wide shot of workshop",
    "2-6s": "push in to medium shot, focus on hands working",
    "6-8s": "rack focus to craftsman's concentrated face",
    "8-10s": "pull back revealing finished piece, soft smile"
  }
}
```
- Shifts focus from "what" to "when," aligning with Sora 2's temporal processing.

### Sora 2-Specific Enhancements
Incorporate model strengths:
- **Physics Object**:
  ```json
  {
    "physics": {
      "gravity": "earth standard",
      "wind": "gentle 5mph breeze from left",
      "materials": {
        "fabric": "silk, flowing naturally",
        "liquid": "water with realistic surface tension",
        "smoke": "cigarette smoke, wispy dissipation"
      }
    }
  }
  ```
- **Multi-Subject Consistency**:
  ```json
  {
    "subjects": [
      {
        "id": "character_01",
        "appearance": "woman, 30s, auburn hair in bun, green sweater",
        "maintain_across_shots": true
      }
    ]
  }
  ```
- **Multi-Shot Sequences**:
  ```json
  {
    "sequence": [
      {
        "shot": "01",
        "setup": { /* scene, camera, etc. */ },
        "duration": "5s"
      },
      {
        "transition": "match cut on movement",
        "shot": "02",
        "setup": { /* ... */ },
        "duration": "4s"
      }
    ]
  }
  ```

## Template-Based Workflow

Build reusable templates with placeholders for scalability:

```json
{
  "scene": {
    "subject": "{{SUBJECT}}",
    "environment": "{{ENVIRONMENT}}",
    "objects": ["{{OBJ1}}", "{{OBJ2}}", "{{OBJ3}}"]
  },
  "camera": "{{CAMERA_PRESET_CINEMATIC}}",
  "lighting": "{{LIGHTING_PRESET_NATURAL}}",
  "motion": { /* ... */ },
  "timeline": { /* ... */ }
}
```
- Presets (e.g., `CAMERA_PRESET_CINEMATIC`) standardize outputs.
- Start minimal, iterate by testing one parameter at a time.

## Best Practices and Rules

| Rule | Description |
|------|-------------|
| 1. Start Minimal | Layer complexity systematically to isolate impacts. |
| 2. Test Incrementally | Change one parameter (e.g., motion pace) per iteration. |
| 3. Build a Library | Save proven templates for genres (e.g., "workshop_cinematic"). |
| 4. Use Descriptive Keys | Full names like "shallow_depth_of_field" over abbreviations. |
| 5. Logical Nesting | Group related elements (e.g., all camera under "camera"). |

- **Token Optimization**: For 30s videos, aim for <200 tokens—reinvest savings in details.
- **Full Prompt Structure**:
  ```json
  {
    "duration": "10s",
    "scene": { /* ... */ },
    "camera": { /* ... */ },
    "motion": { /* ... */ },
    "lighting": { /* ... */ },
    "physics": { /* optional */ },
    "subjects": [ /* optional */ ],
    "timeline": { /* ... */ }
  }
  ```

## Common Mistakes to Avoid

| Mistake | Why It Fails | Fix |
|---------|--------------|-----|
| Over-Describing Backgrounds | Sora auto-fills; wastes tokens. | Focus on key interactions. |
| Under-Describing Motion | Lacks temporal depth; feels flat. | Layer primary/secondary actions. |
| Static Camera | Looks artificial. | Always include subtle movement. |
| Vague Lighting | Unmotivated; uncanny. | Specify source and direction. |
| No Timeline | Random pacing; disorienting. | Define explicit sequences. |

Natural language equivalents become unreadable walls of text; JSON prevents this.

## Action Plan to Get Started

1. **Select a Prompt**: Take your best natural-language Sora 2 prompt.
2. **Convert to JSON**: Map it to the five components above.
3. **Generate and Compare**: Run side-by-side with the original; note improvements in realism.
4. **Iterate**: Add Sora-specific elements (physics, consistency).
5. **Template-ize**: Save as a reusable structure; build a library over time.

## Conclusion

JSON prompting elevates Sora 2 from a tool to a precision instrument, enabling AI-First workflows where structure amplifies creativity. By thinking temporally and layering components, users achieve consistent, film-quality videos. Initial awkwardness fades quickly—master this, and you'll engineer outputs that blur the line between AI and reality.
