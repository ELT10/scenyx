import { supabaseAdmin } from '@/lib/supabaseAdmin';

const MICRO = BigInt(1_000_000);

export async function getCreditUsdPerCreditMicro(): Promise<bigint> {
  const { data } = await supabaseAdmin.from('settings').select('value_text').eq('key', 'credit_usd_per_credit_micros').single();
  const fallback = BigInt(Math.round((parseFloat(process.env.CREDIT_USD_PER_CREDIT || '0.70') || 0.70) * 1_000_000));
  if (!data?.value_text) return fallback;
  const parsed = BigInt(data.value_text);
  return parsed > BigInt(0) ? parsed : fallback;
}

export function ceilDiv(a: bigint, b: bigint) { return (a + b - BigInt(1)) / b; }

export async function requireAccountId(userId: string): Promise<string> {
  const { data, error } = await supabaseAdmin.rpc('fn_get_or_create_account', { p_user_id: userId });
  if (error || !data) throw error || new Error('failed to get account');
  return data as unknown as string;
}

export async function createHold(accountId: string, estUsdMicros: bigint, idempotencyKey: string) {
  const factor = await getCreditUsdPerCreditMicro();
  const estCreditsMicro = ceilDiv(BigInt(estUsdMicros) * MICRO, factor);
  const { data, error } = await supabaseAdmin.rpc('fn_create_hold', {
    p_account_id: accountId,
    p_amount_micro: estCreditsMicro.toString(),
    p_idempotency_key: idempotencyKey,
    p_factor_micros: factor.toString(),
  });
  if (error || !data) throw error || new Error('failed to create hold');
  return { holdId: data as unknown as string, amountMicro: estCreditsMicro, factor };
}

export async function captureHold(holdId: string, actualUsdMicros: bigint) {
  // Fetch hold to get snapshotted factor and account
  const { data: hold } = await supabaseAdmin
    .from('credit_holds')
    .select('id, account_id, amount_microcredits, credit_usd_per_credit_micros_at_hold')
    .eq('id', holdId)
    .single();
  
  if (!hold) throw new Error('hold not found');
  
  const factor = BigInt(hold.credit_usd_per_credit_micros_at_hold);
  const need = ceilDiv(BigInt(actualUsdMicros) * MICRO, factor);
  
  // If actual usage exceeds hold, try to increase hold
  if (need > BigInt(hold.amount_microcredits)) {
    const additional = need - BigInt(hold.amount_microcredits);
    console.log('⚠️ Actual usage exceeds hold estimate');
    console.log('Hold amount:', hold.amount_microcredits);
    console.log('Needed:', need.toString());
    console.log('Additional required:', additional.toString());
    
    // Check if user has sufficient balance for additional amount
    const { data: account } = await supabaseAdmin
      .from('accounts')
      .select('balance_microcredits')
      .eq('id', hold.account_id)
      .single();
    
    if (!account || BigInt(account.balance_microcredits) < additional) {
      console.log('❌ Insufficient balance for additional hold');
      throw new Error(`Actual usage exceeded estimate. Need ${additional.toString()} more microcredits but only have ${account?.balance_microcredits ?? 0}`);
    }
    
    // Increase hold by deducting additional from balance
    console.log('✅ Increasing hold by', additional.toString(), 'microcredits');
    
    const { error: increaseError } = await supabaseAdmin.rpc('fn_increase_hold', {
      p_hold_id: holdId,
      p_additional_micro: additional.toString(),
    });
    
    if (increaseError) {
      console.log('❌ Failed to increase hold:', increaseError);
      throw new Error('Failed to increase hold for actual usage');
    }
    
    console.log('✅ Hold increased successfully');
  }
  
  await supabaseAdmin.rpc('fn_capture_hold', { p_hold_id: holdId, p_capture_micro: need.toString() }).throwOnError();
  return { capturedMicro: need };
}

export async function releaseHold(holdId: string) {
  await supabaseAdmin.rpc('fn_release_hold', { p_hold_id: holdId }).throwOnError();
}


