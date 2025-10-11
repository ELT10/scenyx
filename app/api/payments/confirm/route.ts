import { NextRequest, NextResponse } from 'next/server';
import { Connection } from '@solana/web3.js';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSession } from '@/lib/session';
import { lookupPaymentBySignature, PaymentValidationError } from '@/lib/solana/payments';

type PaymentRow = {
  id: string;
  user_id: string;
  status: 'pending' | 'confirmed' | 'failed';
  amount_usd_micros: number;
  credited_microcredits: number | null;
  tx_signature: string | null;
  reference: string | null;
  type: 'intent' | 'manual';
};

const USDC_MINT = process.env.USDC_MINT as string;
const MERCHANT_WALLET = process.env.MERCHANT_WALLET_ADDRESS as string;
const RPC_URL = process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

export async function POST(req: NextRequest) {
  try {
    console.log('\n=== PAYMENT CONFIRM REQUEST ===');
    const session = await getSession();
    if (!session) {
      console.log('❌ No session found');
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    console.log('✅ Session found:', session.userId);

    const { signature } = await req.json();
    console.log('Signature:', signature);
    if (!signature) return NextResponse.json({ error: 'signature required' }, { status: 400 });
    
    // Validate signature format (Solana signatures are base58, 87-88 chars)
    if (typeof signature !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{87,88}$/.test(signature)) {
      console.log('❌ Invalid signature format');
      return NextResponse.json({ error: 'invalid signature format' }, { status: 400 });
    }
    
    if (!USDC_MINT || !MERCHANT_WALLET) return NextResponse.json({ error: 'server not configured' }, { status: 500 });

    const connection = new Connection(RPC_URL, 'confirmed');

    let lookup;
    try {
      console.log('🔍 Looking up transaction on-chain...');
      lookup = await lookupPaymentBySignature(connection, signature, {
        usdcMint: USDC_MINT,
        merchantWallet: MERCHANT_WALLET,
      });
      console.log('✅ Transaction lookup result:', lookup.state);
    } catch (err) {
      console.log('❌ Transaction lookup error:', err);
      if (err instanceof PaymentValidationError) {
        return NextResponse.json({ status: 'invalid', code: err.code, message: err.message, details: err.details ?? null }, { status: 400 });
      }
      throw err;
    }

    if (lookup.state === 'pending') {
      console.log('⏳ Transaction still pending on-chain');
      return NextResponse.json({ status: 'pending' });
    }

    const reference = lookup.reference;
    const amountMicro = lookup.amountMicro;
    console.log('📊 Payment details - Amount:', amountMicro, 'Reference:', reference ?? 'null');

    let paymentRow: PaymentRow | null = null;

    // Try to find payment by reference first (with user_id filter for security)
    if (reference) {
      console.log('🔎 Looking up payment by reference:', reference);
      const { data, error } = await supabaseAdmin
        .from('payments')
        .select('id, user_id, status, amount_usd_micros, credited_microcredits, tx_signature, reference, type')
        .eq('reference', reference)
        .eq('user_id', session.userId)  // Only allow user to confirm their own payments
        .single<PaymentRow>();

      if (error && error.code !== 'PGRST116') {
        console.log('❌ Database error:', error);
        throw error;
      }

      paymentRow = data ?? null;
      console.log('Payment row found by reference:', paymentRow ? `ID: ${paymentRow.id}, Status: ${paymentRow.status}` : 'null');
    }

    // If no reference or no payment found, try to find by signature (with user_id filter)
    if (!paymentRow) {
      console.log('🔎 Looking up payment by signature:', signature);
      const { data, error } = await supabaseAdmin
        .from('payments')
        .select('id, user_id, status, amount_usd_micros, credited_microcredits, tx_signature, reference, type')
        .eq('tx_signature', signature)
        .eq('user_id', session.userId)  // Only allow user to confirm their own payments
        .single<PaymentRow>();

      if (error && error.code !== 'PGRST116') {
        console.log('❌ Database error:', error);
        throw error;
      }

      paymentRow = data ?? null;
      console.log('Payment row found by signature:', paymentRow ? `ID: ${paymentRow.id}, Status: ${paymentRow.status}` : 'null');
    }

    if (!paymentRow) {
      console.log('💰 Atomically creating manual payment and issuing credits');
      console.log('Input:', {
        user_id: session.userId,
        signature,
        amount: amountMicro,
        mint: lookup.mint,
      });
      
      // Use atomic function to create payment + issue credits in single transaction
      const { data: result, error: manualError } = await supabaseAdmin.rpc('fn_create_manual_payment_and_issue_credits', {
        p_user_id: session.userId,
        p_signature: signature,
        p_amount_microcredits: amountMicro,
        p_mint: lookup.mint,
      });

      if (manualError) {
        console.log('❌ Manual payment error:', manualError);
        
        // Handle signature already credited for different user
        if (manualError.code === '42501') {
          return NextResponse.json({ status: 'forbidden', message: 'Signature already credited for another user' }, { status: 403 });
        }
        
        throw manualError;
      }

      console.log('✅ Manual payment result:', result);
      console.log('=== MANUAL PAYMENT COMPLETE ===\n');
      
      return NextResponse.json({
        status: result?.already_existed ? 'already_confirmed' : 'confirmed',
        signature,
        reference: null,
        amount_microcredits: result?.amount_microcredits ?? amountMicro,
        credited: true,
        type: result?.type ?? 'manual',
        new_balance_microcredits: result?.new_balance_microcredits,
      });
    }

    if (paymentRow.status === 'confirmed') {
      console.log('⚠️ Payment already confirmed');
      return NextResponse.json({ status: 'already_confirmed', reference, amount_microcredits: paymentRow.credited_microcredits, signature: paymentRow.tx_signature });
    }

    if (paymentRow.status !== 'pending') {
      console.log('⚠️ Payment not pending, status:', paymentRow.status);
      return NextResponse.json({ status: 'invalid_state', reference, current_status: paymentRow.status }, { status: 400 });
    }

    const creditsMicro = amountMicro;
    console.log('🎯 Atomically confirming payment and issuing credits:', {
      payment_id: paymentRow.id,
      signature,
      amount: creditsMicro
    });

    // Use atomic function to confirm + issue credits in single transaction
    const { data: result, error: confirmError } = await supabaseAdmin.rpc('fn_confirm_payment_and_issue_credits', {
      p_payment_id: paymentRow.id,
      p_signature: signature,
      p_amount_microcredits: creditsMicro,
      p_request_user_id: session.userId,
    });

    if (confirmError) {
      console.log('❌ Atomic confirm error:', confirmError);
      
      // Handle already confirmed case
      if (confirmError.message?.includes('already confirmed') || confirmError.message?.includes('duplicate key')) {
        return NextResponse.json({ status: 'already_confirmed', reference, signature }, { status: 409 });
      }
      
      throw confirmError;
    }

    console.log('✅ Payment confirmed and credited atomically:', result);
    console.log('=== PAYMENT CONFIRM COMPLETE ===\n');
    
    return NextResponse.json({
      status: result?.status ?? 'confirmed',
      reference,
      signature,
      amount_microcredits: creditsMicro,
      credited: true,
      type: paymentRow.type ?? 'intent',
      new_balance_microcredits: result?.new_balance_microcredits,
    });
  } catch (e: any) {
    console.log('❌ CONFIRM ERROR:', e);
    console.log('=== PAYMENT CONFIRM FAILED ===\n');
    return NextResponse.json({ error: e.message || 'failed' }, { status: 500 });
  }
}


