import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { withRateLimit, RATE_LIMITS } from '@/lib/rateLimit';

async function handler(_req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }
    return NextResponse.json({ 
      authenticated: true, 
      walletAddress: session.walletAddress 
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'failed' }, { status: 500 });
  }
}

export const GET = withRateLimit(handler, RATE_LIMITS.status);

