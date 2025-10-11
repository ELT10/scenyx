import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSession } from '@/lib/session';
import { Keypair, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';

const USDC_MINT = process.env.USDC_MINT as string;
const MERCHANT_WALLET = process.env.MERCHANT_WALLET_ADDRESS as string;

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const { usd } = await req.json();
    if (!USDC_MINT || !MERCHANT_WALLET) return NextResponse.json({ error: 'server not configured' }, { status: 500 });
    const mintAddress = USDC_MINT; // USDC only for now
    if (typeof usd !== 'number' || usd <= 0) return NextResponse.json({ error: 'invalid amount' }, { status: 400 });

    // Create a unique reference pubkey
    const referenceKey = Keypair.generate().publicKey.toBase58();

    // Compute merchant's USDC ATA
    const merchantPubkey = new PublicKey(MERCHANT_WALLET);
    const usdcMintPubkey = new PublicKey(mintAddress);
    const merchantATA = getAssociatedTokenAddressSync(usdcMintPubkey, merchantPubkey);

    // Persist payment intent (pending)
    const amountUsdMicros = Math.round(usd * 1_000_000);
    const { data: payment, error } = await supabaseAdmin
      .from('payments')
      .insert({
        user_id: session.userId,
        reference: referenceKey,
        mint: mintAddress,
        amount_tokens: usd * 1_000_000,
        amount_usd_micros: amountUsdMicros,
        status: 'pending'
      })
      .select('id, reference')
      .single();
    if (error || !payment) throw error || new Error('failed to create payment');

    return NextResponse.json({
      recipient: merchantATA.toBase58(),
      splToken: mintAddress,
      amount: usd.toFixed(6),
      reference: referenceKey,
      label: 'Scenyx Credits',
      message: 'Purchase credits',
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'failed' }, { status: 500 });
  }
}


