import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: NextRequest) {
  const reference = req.nextUrl.searchParams.get('reference');
  if (!reference) return NextResponse.json({ error: 'reference required' }, { status: 400 });
  const { data } = await supabaseAdmin
    .from('payments')
    .select('status, credited_microcredits, tx_signature, confirmed_at')
    .eq('reference', reference)
    .single();
  if (!data) return NextResponse.json({ status: 'not_found' });
  return NextResponse.json(data);
}


