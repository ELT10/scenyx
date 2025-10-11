import { NextRequest, NextResponse } from 'next/server';
import { createNonce } from '@/lib/siws';

export async function POST(req: NextRequest) {
  try {
    const { walletAddress } = await req.json();
    if (!walletAddress) return NextResponse.json({ error: 'walletAddress required' }, { status: 400 });
    const { nonce, expiresAt } = await createNonce(walletAddress);
    return NextResponse.json({ nonce, expiresAt });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'failed' }, { status: 500 });
  }
}


