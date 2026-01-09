import { NextRequest, NextResponse } from 'next/server';
import { createNonce } from '@/lib/siws';
import { withRateLimit, RATE_LIMITS } from '@/lib/rateLimit';

async function handler(req: NextRequest) {
  try {
    const { walletAddress } = await req.json();
    if (!walletAddress) return NextResponse.json({ error: 'walletAddress required' }, { status: 400 });
    const { nonce, expiresAt } = await createNonce(walletAddress);
    return NextResponse.json({ nonce, expiresAt });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'failed' }, { status: 500 });
  }
}

export const POST = withRateLimit(handler, RATE_LIMITS.auth);


