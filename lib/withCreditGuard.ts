import { NextRequest, NextResponse } from 'next/server';
import { getSession, getSessionWithWalletVerification } from '@/lib/session';
import { createHold, captureHold, releaseHold, requireAccountId } from '@/lib/credits';

type Handler = (req: NextRequest) => Promise<NextResponse>;

export interface CreditGuardContext {
  userId: string;
  accountId: string;
  holdId: string;
  estimatedUsdMicros: bigint;
}

export function withCreditGuard<TBody = any>(params: {
  estimateUsdMicros: (body: TBody) => Promise<number>;
  runWithUsageUsdMicros: (body: TBody, req: NextRequest, context: CreditGuardContext) => Promise<{ 
    response: NextResponse; 
    usageUsdMicros: number;
    keepHold?: boolean; // If true, hold is kept active for later finalization
  }>;
  verifyWalletAddress?: boolean; // Optional: verify wallet address from header matches session
}): Handler {
  const { estimateUsdMicros, runWithUsageUsdMicros, verifyWalletAddress = false } = params;
  return async function handler(req: NextRequest) {
    let session;
    
    if (verifyWalletAddress) {
      // Extra security: verify wallet address from header matches session
      const walletAddressHeader = req.headers.get('x-wallet-address');
      session = await getSessionWithWalletVerification(walletAddressHeader || undefined);
    } else {
      session = await getSession();
    }
    
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

    const context: CreditGuardContext = {
      userId: session.userId,
      accountId,
      holdId: holdId!,
      estimatedUsdMicros: estUsdMicros,
    };

    try {
      const { response, usageUsdMicros, keepHold } = await runWithUsageUsdMicros(body, req, context);
      
      // If keepHold is true, don't finalize the hold yet
      // It will be finalized later (e.g., when async video generation completes)
      if (keepHold) {
        console.log('⏳ Keeping hold active for later finalization:', holdId);
        return response;
      }
      
      // Normal flow: capture or release based on usage
      await captureHold(holdId!, BigInt(usageUsdMicros));
      return response;
    } catch (e: any) {
      await releaseHold(holdId!);
      return NextResponse.json({ error: e.message || 'failed' }, { status: 500 });
    }
  };
}


