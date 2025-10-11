import { supabaseAdmin } from './supabaseAdmin';
import bs58 from 'bs58';
import nacl from 'tweetnacl';

const NONCE_TTL_MS = 5 * 60 * 1000;

export async function createNonce(walletAddress: string) {
  const nonce = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + NONCE_TTL_MS).toISOString();
  await supabaseAdmin
    .from('nonces')
    .upsert({ wallet_address: walletAddress, nonce, expires_at: expiresAt })
    .throwOnError();
  return { nonce, expiresAt };
}

export async function verifySignature(walletAddress: string, nonce: string, signatureB58: string) {
  const { data, error } = await supabaseAdmin
    .from('nonces')
    .select('nonce, expires_at')
    .eq('wallet_address', walletAddress)
    .single();
  if (error || !data) return { ok: false, error: 'nonce not found' } as const;
  if (new Date(data.expires_at).getTime() < Date.now()) return { ok: false, error: 'nonce expired' } as const;
  if (data.nonce !== nonce) return { ok: false, error: 'nonce mismatch' } as const;

  const message = new TextEncoder().encode(`scenyx login: ${nonce}`);
  const publicKey = bs58.decode(walletAddress);
  const signature = bs58.decode(signatureB58);
  const ok = nacl.sign.detached.verify(message, signature, publicKey);
  if (!ok) return { ok: false, error: 'invalid signature' } as const;

  // Invalidate nonce
  await supabaseAdmin.from('nonces').delete().eq('wallet_address', walletAddress);
  return { ok: true } as const;
}


