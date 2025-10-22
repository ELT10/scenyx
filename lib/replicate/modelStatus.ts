export type ModelStatus = 'online' | 'offline' | 'unknown';

function statusUrlForModel(slug: string): string | null {
  const parts = slug.split('/');
  if (parts.length !== 2) return null;
  const [owner, model] = parts;
  if (!owner || !model) return null;
  return `https://replicate.com/${owner}/${model}/status`;
}

export async function fetchModelStatus(slug: string): Promise<ModelStatus> {
  const url = statusUrlForModel(slug);
  if (!url) return 'unknown';

  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return 'unknown';
    const json = await res.json().catch(() => ({}));
    const status = json?.status;
    if (status === 'online' || status === 'offline') {
      return status;
    }
    return 'unknown';
  } catch (error) {
    console.warn(`Failed to fetch status for model ${slug}:`, error);
    return 'unknown';
  }
}


