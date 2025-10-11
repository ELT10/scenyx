import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSession } from '@/lib/session';

const DEFAULT_LIMIT = 25;

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from('payments')
      .select('created_at, status, amount_usd_micros, credited_microcredits, tx_signature, reference, type')
      .eq('user_id', session.userId)
      .order('created_at', { ascending: false })
      .limit(DEFAULT_LIMIT);

    if (error) throw error;

    // Filter out cancelled payments (pending without signature)
    // Keep pending WITH signature (user can verify these)
    const filteredPayments = (data ?? []).filter(payment => {
      // Always show confirmed and failed payments
      if (payment.status !== 'pending') return true;
      
      // For pending: only show if has signature (real tx waiting for verification)
      // Hide if no signature (user cancelled in wallet)
      return payment.tx_signature !== null;
    });

    return NextResponse.json({ payments: filteredPayments });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'failed' }, { status: 500 });
  }
}


