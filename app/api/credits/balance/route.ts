import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET() {
  console.log('\n=== BALANCE CHECK ===');
  const session = await getSession();
  if (!session) {
    console.log('❌ No session');
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  console.log('User ID:', session.userId);
  
  const { data: account, error } = await supabaseAdmin
    .from('accounts')
    .select('balance_microcredits')
    .eq('user_id', session.userId)
    .single();
  
  if (error) {
    console.log('❌ Account fetch error:', error);
  }
  
  const balanceMicro = account?.balance_microcredits ?? 0;
  console.log('Balance (micro):', balanceMicro);
  console.log('Balance (credits):', (balanceMicro / 1_000_000).toFixed(6));
  console.log('=== BALANCE CHECK COMPLETE ===\n');
  
  return NextResponse.json({ balance_microcredits: balanceMicro, balance: (balanceMicro / 1_000_000).toFixed(6) });
}


