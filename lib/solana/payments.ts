import { Connection, PublicKey, SystemProgram, TransactionResponse, VersionedTransactionResponse } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from '@solana/spl-token';

type TransactionWithMeta = VersionedTransactionResponse | TransactionResponse;

export class PaymentValidationError extends Error {
  code: string;
  details?: Record<string, unknown>;

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

export type PaymentLookupResult =
  | { state: 'pending' }
  | {
      state: 'valid';
      signature: string;
      reference: string | null;
      amountMicro: number;
      mint: string;
      destinationTokenAccount: string;
      slot: number;
      blockTime: number | null;
      feePayer: string | null;
      transaction: TransactionWithMeta;
    };

interface ValidationConfig {
  usdcMint: string;
  merchantWallet: string;
}

const SYSTEM_PROGRAM_ID = SystemProgram.programId.toBase58();

export async function lookupPaymentBySignature(
  connection: Connection,
  signature: string,
  config: ValidationConfig
): Promise<PaymentLookupResult> {
  const tx = await connection.getTransaction(signature, {
    commitment: 'confirmed',
    maxSupportedTransactionVersion: 0,
  });

  if (!tx) {
    return { state: 'pending' };
  }

  const parsed = parsePaymentTransaction(tx, signature, config);
  return { ...parsed, transaction: tx };
}

function parsePaymentTransaction(
  tx: TransactionWithMeta,
  signature: string,
  { usdcMint, merchantWallet }: ValidationConfig
) {
  if (!tx.meta) {
    throw new PaymentValidationError('missing_meta', 'Transaction metadata unavailable');
  }

  if (tx.meta.err) {
    throw new PaymentValidationError('transaction_failed', 'Transaction execution failed', {
      error: tx.meta.err,
    });
  }

  const accountKeys = extractAccountKeys(tx);
  const instructions = extractInstructions(tx);

  const tokenIx = instructions.find((ix) => accountKeys[ix.programIdIndex] === TOKEN_PROGRAM_ID.toBase58());
  if (!tokenIx) {
    throw new PaymentValidationError('no_token_transfer', 'Transaction does not include an SPL token transfer');
  }

  if (!tokenIx.accounts || tokenIx.accounts.length < 2) {
    throw new PaymentValidationError('invalid_token_instruction', 'Token transfer instruction malformed');
  }

  // Get destination account from instruction
  const destinationAccountIndex = tokenIx.accounts[1];
  const destinationTokenAccount = accountKeys[destinationAccountIndex];
  if (!destinationTokenAccount) {
    throw new PaymentValidationError('missing_destination', 'Destination token account missing from transaction');
  }

  const merchantAta = getAssociatedTokenAddressSync(new PublicKey(usdcMint), new PublicKey(merchantWallet)).toBase58();
  if (destinationTokenAccount !== merchantAta) {
    throw new PaymentValidationError('wrong_destination', 'Transfer destination does not match merchant account', {
      destinationTokenAccount,
      expected: merchantAta,
    });
  }

  // Find the token balance change for the destination account
  const balanceRecord = tx.meta.postTokenBalances?.find((balance) => balance.accountIndex === destinationAccountIndex);
  if (!balanceRecord) {
    throw new PaymentValidationError('missing_token_balance', 'Unable to verify token mint for destination account');
  }

  if (balanceRecord.mint !== usdcMint) {
    throw new PaymentValidationError('wrong_mint', 'Transfer mint does not match expected stablecoin', {
      mint: balanceRecord.mint,
      expected: usdcMint,
    });
  }

  // Calculate amount from balance changes
  const preBalance = tx.meta.preTokenBalances?.find((balance) => balance.accountIndex === destinationAccountIndex);
  const preAmount = preBalance?.uiTokenAmount?.amount ? BigInt(preBalance.uiTokenAmount.amount) : 0n;
  const postAmount = balanceRecord.uiTokenAmount?.amount ? BigInt(balanceRecord.uiTokenAmount.amount) : 0n;
  const transferAmount = postAmount - preAmount;

  if (transferAmount <= 0n) {
    throw new PaymentValidationError('zero_amount', 'Transfer amount must be greater than zero');
  }

  const amount = Number(transferAmount);

  const reference = extractReferenceAccount(instructions, accountKeys);
  const feePayer = accountKeys[0] ?? null;

  return {
    state: 'valid' as const,
    signature,
    reference: reference ?? null,
    amountMicro: amount,
    mint: balanceRecord.mint,
    destinationTokenAccount,
    slot: tx.slot,
    blockTime: tx.blockTime ?? null,
    feePayer,
  };
}

function extractAccountKeys(tx: TransactionWithMeta): string[] {
  const message: any = tx.transaction.message;

  if (typeof message?.getAccountKeys === 'function') {
    const accountKeysFromLookups = tx.meta?.loadedAddresses;
    const keys = message.getAccountKeys({ accountKeysFromLookups });
    const list: string[] = [];
    list.push(...keys.staticAccountKeys.map((key: PublicKey) => key.toBase58()));
    if (keys.accountKeysFromLookups) {
      if (keys.accountKeysFromLookups.writable) {
        list.push(...keys.accountKeysFromLookups.writable.map((key: PublicKey) => key.toBase58()));
      }
      if (keys.accountKeysFromLookups.readonly) {
        list.push(...keys.accountKeysFromLookups.readonly.map((key: PublicKey) => key.toBase58()));
      }
    }
    return list;
  }

  if (Array.isArray(message?.accountKeys)) {
    return message.accountKeys.map((key: PublicKey) => key.toBase58());
  }

  throw new PaymentValidationError('unsupported_message', 'Unsupported transaction message format');
}

type GenericInstruction = {
  programIdIndex: number;
  accounts?: number[];
  data: string | number[] | Buffer;
};

function extractInstructions(tx: TransactionWithMeta): GenericInstruction[] {
  const message: any = tx.transaction.message;
  if (Array.isArray(message?.instructions)) {
    return message.instructions as GenericInstruction[];
  }
  if (Array.isArray(message?.compiledInstructions)) {
    return message.compiledInstructions as GenericInstruction[];
  }
  return [];
}

function decodeInstructionData(data: string | number[] | Buffer): Buffer {
  if (typeof data === 'string') {
    return Buffer.from(data, 'base64');
  }
  if (Buffer.isBuffer(data)) {
    return data;
  }
  if (Array.isArray(data)) {
    return Buffer.from(data);
  }
  return Buffer.alloc(0);
}

function extractReferenceAccount(instructions: GenericInstruction[], accountKeys: string[]) {
  for (const ix of instructions) {
    if (accountKeys[ix.programIdIndex] !== SYSTEM_PROGRAM_ID) continue;
    if (!ix.accounts || ix.accounts.length < 2) continue;

    const data = decodeInstructionData(ix.data);
    if (data.length < 12) continue;

    const instructionType = data.readUInt32LE(0);
    if (instructionType !== 2) continue; // SystemProgram transfer

    const lamports = data.readBigUInt64LE(4);
    if (lamports !== 0n) continue;

    const referenceAccount = accountKeys[ix.accounts[1]];
    if (referenceAccount) {
      return referenceAccount;
    }
  }
  return undefined;
}


