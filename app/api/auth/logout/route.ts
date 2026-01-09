import { NextRequest, NextResponse } from 'next/server';
import { revokeSession } from '@/lib/session';
import { withRateLimit, RATE_LIMITS } from '@/lib/rateLimit';

async function handler(_req: NextRequest) {
  await revokeSession();
  return NextResponse.json({ success: true });
}

export const POST = withRateLimit(handler, RATE_LIMITS.auth);


