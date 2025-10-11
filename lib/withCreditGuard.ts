import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createHold, captureHold, releaseHold, requireAccountId } from '@/lib/credits';

type Handler = (req: NextRequest) => Promise<NextResponse>;

export function withCreditGuard<TBody = any>(params: {
  estimateUsdMicros: (body: TBody) => Promise<number>;
  runWithUsageUsdMicros: (body: TBody, req: NextRequest) => Promise<{ response: NextResponse; usageUsdMicros: number }>;
}): Handler {
  const { estimateUsdMicros, runWithUsageUsdMicros } = params;
  return async function handler(req: NextRequest) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const idempotencyKey = req.headers.get('Idempotency-Key') || crypto.randomUUID();
    
    let accountId: string;
    try {
      console.log('Getting account for user:', session.userId);
      accountId = await requireAccountId(session.userId);
      console.log('Account ID:', accountId);
    } catch (e: any) {
      console.log('❌ Failed to get account:', e);
      if (e.code === 'PGRST202' || e.message?.includes('not found in the schema cache')) {
        return NextResponse.json({ 
          error: 'Credit system not initialized. Please run database migrations.' 
        }, { status: 500 });
      }
      throw e;
    }
    
    const body = (await req.json().catch(() => ({}))) as TBody;
    const estUsdMicros = BigInt(await estimateUsdMicros(body));
    console.log('Estimated cost (USD micros):', estUsdMicros.toString());

    let holdId: string | null = null;
    try {
      console.log('Creating hold:', { accountId, estUsdMicros: estUsdMicros.toString(), idempotencyKey });
      const { holdId: h } = await createHold(accountId, estUsdMicros, idempotencyKey);
      holdId = h;
      console.log('Hold created:', holdId);
    } catch (e: any) {
      console.log('❌ Hold creation failed:', e);
      console.log('Error code:', e.code);
      console.log('Error message:', e.message);
      
      // Check if it's a function not found error
      if (e.code === 'PGRST202' || e.message?.includes('not found in the schema cache')) {
        console.log('⚠️ Database functions not created yet - run migration 0008');
        return NextResponse.json({ 
          error: 'Credit system not initialized. Please run database migrations.' 
        }, { status: 500 });
      }
      
      // Check if it's actually insufficient credits
      if (e.code === '53400' || e.message?.includes('Insufficient credits')) {
        return NextResponse.json({ error: 'insufficient credits', details: e.message }, { status: 402 });
      }
      
      // Other errors
      return NextResponse.json({ error: e.message || 'failed to create hold' }, { status: 500 });
    }

    try {
      const { response, usageUsdMicros } = await runWithUsageUsdMicros(body, req);
      await captureHold(holdId!, BigInt(usageUsdMicros));
      return response;
    } catch (e: any) {
      await releaseHold(holdId!);
      return NextResponse.json({ error: e.message || 'failed' }, { status: 500 });
    }
  };
}


