import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSession } from '@/lib/session';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const { reference, signature } = await req.json();
    if (!reference || !signature) {
      return NextResponse.json({ error: 'reference and signature required' }, { status: 400 });
    }

    // Find the pending payment by reference and user
    const { data: payment, error: fetchError } = await supabaseAdmin
      .from('payments')
      .select('id, user_id, status, tx_signature')
      .eq('reference', reference)
      .eq('user_id', session.userId)
      .single();

    if (fetchError || !payment) {
      return NextResponse.json({ error: 'payment not found' }, { status: 404 });
    }

    if (payment.status !== 'pending') {
      return NextResponse.json({ 
        error: 'payment not pending', 
        status: payment.status,
        signature: payment.tx_signature 
      }, { status: 400 });
    }

    // Update the signature (if not already set)
    if (!payment.tx_signature) {
      const { error: updateError } = await supabaseAdmin
        .from('payments')
        .update({ tx_signature: signature })
        .eq('id', payment.id);

      if (updateError) {
        // Check if it's a duplicate signature error
        if (updateError.code === '23505') {
          return NextResponse.json({ 
            status: 'duplicate_signature',
            message: 'This transaction signature is already associated with another payment'
          }, { status: 409 });
        }
        throw updateError;
      }
    }

    return NextResponse.json({ 
      status: 'updated',
      signature: signature,
      payment_id: payment.id 
    });
  } catch (e: any) {
    console.error('Update signature error:', e);
    return NextResponse.json({ error: e.message || 'failed' }, { status: 500 });
  }
}

