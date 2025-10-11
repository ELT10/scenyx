import { PublicKey } from '@solana/web3.js';

export function buildSolanaPayURL(params: {
  recipient: string;
  splToken: string;
  amount: string; // decimal string
  reference: string; // public key
  label?: string;
  message?: string;
}) {
  const { recipient, splToken, amount, reference, label, message } = params;
  const url = new URL('solana:');
  url.pathname = new PublicKey(recipient).toBase58();
  url.searchParams.set('amount', amount);
  url.searchParams.set('spl-token', new PublicKey(splToken).toBase58());
  url.searchParams.set('reference', new PublicKey(reference).toBase58());
  if (label) url.searchParams.set('label', label);
  if (message) url.searchParams.set('message', message);
  return url.toString();
}


