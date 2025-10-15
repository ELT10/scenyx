import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

type ArchiveItem = {
  video_id: string;
  model: string;
  status: 'queued' | 'in_progress' | 'completed' | 'failed';
  seconds: string | null;
  created_at: string;
  source: 'replicate' | 'openai';
  expiresAt: string; // ISO
  remainingHours: number; // floor
};

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const hoursParam = req.nextUrl.searchParams.get('hours');
  const hours = Math.max(1, Math.min(48, parseInt(hoursParam || '20', 10) || 20));

  const sinceIso = new Date(Date.now() - hours * 3600 * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from('video_generations')
    .select('video_id, model, status, seconds, created_at')
    .eq('user_id', session.userId)
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const now = Date.now();
  // Map and compute per-source expiry (Replicate ~1h, OpenAI ~24h)
  let items: ArchiveItem[] = (data || []).map((row: any) => {
    const created = new Date(row.created_at).getTime();
    const source: 'replicate' | 'openai' =
      row.model?.startsWith('wan-video/') || row.model?.startsWith('bytedance/')
        ? 'replicate'
        : 'openai';
    const ttlMs = source === 'replicate' ? 1 * 3600 * 1000 : 24 * 3600 * 1000;
    const expiresMs = created + ttlMs;
    const remaining = Math.max(0, Math.floor((expiresMs - now) / 3600_000));
    return {
      video_id: row.video_id,
      model: row.model,
      status: row.status,
      seconds: row.seconds ?? null,
      created_at: row.created_at,
      source,
      expiresAt: new Date(expiresMs).toISOString(),
      remainingHours: remaining,
    };
  });

  // Filter out expired Replicate items (>1h old)
  items = items.filter((it) => (it.source === 'replicate' ? Date.parse(it.expiresAt) > now : true));

  return NextResponse.json({ items });
}


