import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifySignature } from '@/lib/siws';
import { createSession } from '@/lib/session';

export async function POST(req: NextRequest) {
  try {
    const { walletAddress, signature, nonce } = await req.json();
    if (!walletAddress || !signature || !nonce) {
      return NextResponse.json({ error: 'missing fields' }, { status: 400 });
    }

    const result = await verifySignature(walletAddress, nonce, signature);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 401 });

    // Upsert user and wallet
    let userId: string | null = null;
    const { data: wallet } = await supabaseAdmin
      .from('wallets')
      .select('id, user_id')
      .eq('address', walletAddress)
      .single();
    if (wallet?.user_id) {
      userId = wallet.user_id;
    } else {
      const { data: userRow, error: userErr } = await supabaseAdmin
        .from('users')
        .insert({})
        .select('id')
        .single();
      if (userErr || !userRow) throw userErr || new Error('Failed to create user');
      userId = userRow.id;
      await supabaseAdmin.from('wallets').insert({ user_id: userId, address: walletAddress, network: 'mainnet-beta' });
    }

    // Ensure account exists
    await supabaseAdmin.rpc('fn_get_or_create_account', { p_user_id: userId });

    await createSession(userId!);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'failed' }, { status: 500 });
  }
}


