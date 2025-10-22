import { NextResponse } from 'next/server';
import { fetchModelStatus, type ModelStatus } from '@/lib/replicate/modelStatus';

const CACHE_TTL_MS = 15_000;

let cache: { data: Record<string, ModelStatus>; at: number } | null = null;

export const GET = async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const modelsParam = searchParams.get('models');

  if (!modelsParam) {
    return NextResponse.json(
      { error: 'models query param required (comma-separated list of owner/model slugs)' },
      { status: 400 }
    );
  }

  const models = modelsParam
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean);

  if (!models.length) {
    return NextResponse.json(
      { error: 'No valid models provided in query param' },
      { status: 400 }
    );
  }

  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    const cachedStatuses: Record<string, ModelStatus> = {};
    for (const model of models) {
      cachedStatuses[model] = cache.data[model] ?? 'unknown';
    }
    return NextResponse.json({ statuses: cachedStatuses });
  }

  const statuses: Record<string, ModelStatus> = {};

  for (const model of models) {
    statuses[model] = await fetchModelStatus(model);
  }

  cache = { data: statuses, at: Date.now() };

  return NextResponse.json({ statuses });
};


