'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { createTransferInstruction, getAssociatedTokenAddressSync } from '@solana/spl-token';
import GlowButton from '@/components/GlowButton';
import TerminalPanel from '@/components/TerminalPanel';
import TerminalInput from '@/components/TerminalInput';
import DataGrid from '@/components/DataGrid';
import StatusBadge from '@/components/StatusBadge';
import { notifyCreditsUpdated } from '@/lib/client/events';

const EXPLORER_BASE = 'https://solscan.io/tx/';

function formatMicro(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '0.000000';
  return (amount / 1_000_000).toFixed(6);
}

function truncateSignature(signature: string | null): string {
  if (!signature) return '—';
  if (signature.length <= 12) return signature;
  return `${signature.slice(0, 6)}...${signature.slice(-6)}`;
}

type HistoryEntry = {
  created_at: string;
  status: 'pending' | 'confirmed' | 'failed';
  amount_usd_micros: number | null;
  credited_microcredits: number | null;
  tx_signature: string | null;
  reference: string | null;
  type?: 'intent' | 'manual';
};

type VerifyResponse = {
  status: string;
  signature: string;
  reference?: string | null;
  credited?: boolean;
  amount_microcredits?: number;
  type?: 'intent' | 'manual';
  message?: string;
  code?: string;
  error?: string;
};

export default function CreditsPage() {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [balance, setBalance] = useState('0.000000');
  const [loadingBalance, setLoadingBalance] = useState(false);

  const [usdAmount, setUsdAmount] = useState('10');
  const [addCreditsBusy, setAddCreditsBusy] = useState(false);
  const [addCreditsStatus, setAddCreditsStatus] = useState<string | null>(null);
  const [currentSignature, setCurrentSignature] = useState<string | null>(null);

  const [verifyInput, setVerifyInput] = useState('');
  const [verifyStatus, setVerifyStatus] = useState<VerifyResponse | null>(null);
  const [verifyBusy, setVerifyBusy] = useState(false);

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [retryingSignature, setRetryingSignature] = useState<string | null>(null);
  const [retryStatus, setRetryStatus] = useState<VerifyResponse | null>(null);

  const explorerUrl = useMemo(() => (currentSignature ? `${EXPLORER_BASE}${currentSignature}` : null), [currentSignature]);
  
  const pendingPayments = useMemo(() => 
    history.filter(p => p.status === 'pending' && p.tx_signature), 
    [history]
  );

  const loadBalance = useCallback(async () => {
    try {
      setLoadingBalance(true);
      const res = await fetch('/api/credits/balance');
      if (!res.ok) throw new Error('failed to load balance');
      const data = await res.json();
      setBalance(data.balance ?? '0.000000');
    } catch (err) {
      console.error('Failed to load balance', err);
    } finally {
      setLoadingBalance(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      setHistoryBusy(true);
      const res = await fetch('/api/payments/history');
      if (!res.ok) throw new Error('failed to load history');
      const data = await res.json();
      setHistory(data.payments ?? []);
    } catch (err) {
      console.error('Failed to load history', err);
    } finally {
      setHistoryBusy(false);
    }
  }, []);

  useEffect(() => {
    if (publicKey) {
      void loadBalance();
      void loadHistory();
    } else {
      setBalance('0.000000');
      setHistory([]);
    }
  }, [publicKey, loadBalance, loadHistory]);

  const handleAddCredits = useCallback(async () => {
    setAddCreditsStatus(null);
    setVerifyStatus(null);
    setRetryStatus(null);
    setCurrentSignature(null);

    if (!publicKey || !sendTransaction) {
      setAddCreditsStatus('Connect your wallet to continue.');
      return;
    }

    const amountNumber = Number(usdAmount);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      setAddCreditsStatus('Enter a positive USD amount.');
      return;
    }

    try {
      setAddCreditsBusy(true);
      setAddCreditsStatus('Creating payment intent...');

      const intentRes = await fetch('/api/payments/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usd: amountNumber }),
      });

      const intentJson = await intentRes.json();
      if (!intentRes.ok) throw new Error(intentJson.error || 'Failed to create payment intent');

      const merchantATA = new PublicKey(intentJson.recipient);
      const usdcMint = new PublicKey(intentJson.splToken);
      const reference = new PublicKey(intentJson.reference);
      const amountTokens = Math.round(amountNumber * 1_000_000);

      const userATA = getAssociatedTokenAddressSync(usdcMint, publicKey);

      const transaction = new Transaction().add(
        createTransferInstruction(userATA, merchantATA, publicKey, amountTokens)
      );

      transaction.add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: reference,
          lamports: 0,
        })
      );

      setAddCreditsStatus('Approve the transfer in your wallet.');
      const signature = await sendTransaction(transaction, connection, { skipPreflight: true });
      setCurrentSignature(signature);
      setAddCreditsStatus('Transaction sent. Storing signature...');

      // Store signature immediately (before waiting for confirmation)
      // This ensures we can retry verification if RPC times out
      try {
        await fetch('/api/payments/update-signature', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reference: intentJson.reference, signature }),
        });
      } catch (updateErr) {
        console.warn('Failed to store signature, will retry during confirm', updateErr);
      }

      setAddCreditsStatus('Awaiting on-chain confirmation...');
      await connection.confirmTransaction(signature, 'confirmed');

      setAddCreditsStatus('On-chain confirmation received. Finalizing payment...');

      const confirmRes = await fetch('/api/payments/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature }),
      });

      const confirmJson = await confirmRes.json();
      if (!confirmRes.ok) {
        throw new Error(confirmJson.error || confirmJson.message || 'Failed to confirm payment');
      }

      if (confirmJson.status === 'pending') {
        setAddCreditsStatus('Payment pending. Check history soon.');
      } else if (confirmJson.status === 'already_confirmed') {
        setAddCreditsStatus('This payment was already credited.');
      } else if (confirmJson.status === 'confirmed') {
        setAddCreditsStatus('Credits added successfully!');
      } else {
        setAddCreditsStatus(`Payment status: ${confirmJson.status}`);
      }

      await Promise.all([loadBalance(), loadHistory()]);
      notifyCreditsUpdated(); // Trigger header balance update
    } catch (err: any) {
      console.error('Add credits error', err);
      setAddCreditsStatus(err?.message || 'Failed to add credits');
    } finally {
      setAddCreditsBusy(false);
    }
  }, [publicKey, sendTransaction, usdAmount, connection, loadBalance, loadHistory]);

  const handleVerify = useCallback(async () => {
    setVerifyStatus(null);
    setRetryStatus(null);
    setVerifyBusy(true);
    try {
      const signature = verifyInput.trim();
      if (!signature) {
        throw new Error('Enter a signature to verify');
      }

      const res = await fetch('/api/payments/verify-signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature }),
      });

      const json = (await res.json()) as VerifyResponse;
      if (!res.ok) {
        throw new Error(json?.message || json?.error || 'Verification failed');
      }

      setVerifyStatus(json);
      await Promise.all([loadBalance(), loadHistory()]);
      notifyCreditsUpdated(); // Trigger header balance update
    } catch (err: any) {
      setVerifyStatus({ status: 'error', signature: verifyInput, message: err.message });
    } finally {
      setVerifyBusy(false);
    }
  }, [verifyInput, loadBalance, loadHistory]);

  const handleRetryVerification = useCallback(async (signature: string) => {
    setRetryingSignature(signature);
    setRetryStatus(null);
    try {
      const res = await fetch('/api/payments/verify-signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature }),
      });

      const json = (await res.json()) as VerifyResponse;
      if (!res.ok && res.status !== 400) {
        throw new Error(json?.message || json?.error || 'Verification failed');
      }

      await Promise.all([loadBalance(), loadHistory()]);
      notifyCreditsUpdated(); // Trigger header balance update

      if (json.status === 'confirmed' || json.status === 'already_confirmed') {
        setRetryStatus({ ...json, message: 'Payment verified and credited successfully!' });
      } else if (json.status === 'pending') {
        setRetryStatus({ ...json, message: 'Transaction is still pending on-chain. Please try again in a moment.' });
      } else {
        setRetryStatus(json);
      }
    } catch (err: any) {
      setRetryStatus({ status: 'error', signature, message: err.message });
    } finally {
      setRetryingSignature(null);
    }
  }, [loadBalance, loadHistory]);

  const renderStatus = (entry: HistoryEntry) => {
    if (entry.status === 'confirmed') return <StatusBadge status="completed" />;
    if (entry.status === 'pending') return <StatusBadge status="in_progress" />;
    return <StatusBadge status="failed" />;
  };

  return (
    <div className="container mx-auto max-w-5xl py-12 px-4 space-y-8">
      <div className="text-center">
        <h1 className="text-3xl uppercase tracking-[0.3em] text-[var(--text-primary)] mb-2">Credits & Billing</h1>
        <p className="text-sm text-[var(--text-muted)]">Manage balance, add credits, self-verify payments, and review history.</p>
      </div>

      <TerminalPanel title="ACCOUNT BALANCE" status="active">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-[var(--text-muted)]">Current Balance</div>
            <div className="text-3xl font-mono text-[var(--text-primary)]">{balance} credits</div>
          </div>
          <GlowButton onClick={loadBalance} disabled={loadingBalance} loading={loadingBalance} className="w-full md:w-auto">
            [ REFRESH BALANCE ]
          </GlowButton>
        </div>
      </TerminalPanel>

      <TerminalPanel title="ADD CREDITS" status="active">
        <div className="space-y-4">
          <DataGrid columns={2} gap="md">
            <TerminalInput
              label="USD Amount"
              value={usdAmount}
              onChange={(e) => setUsdAmount(e.target.value)}
              disabled={addCreditsBusy}
            />
            <div className="flex items-end">
              <GlowButton
                onClick={handleAddCredits}
                disabled={addCreditsBusy || !publicKey}
                loading={addCreditsBusy}
                className="w-full"
              >
                [ ADD CREDITS ]
              </GlowButton>
            </div>
          </DataGrid>

          {currentSignature && (
            <div className="text-xs text-[var(--text-muted)]">
              Transaction Signature:{' '}
              {explorerUrl ? (
                <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--accent-cyan)] underline">
                  {currentSignature}
                </a>
              ) : (
                currentSignature
              )}
            </div>
          )}

          {addCreditsStatus && (
            <div className="border border-[var(--border-dim)] bg-black bg-opacity-40 p-4 text-xs text-[var(--text-muted)]">
              {addCreditsStatus}
            </div>
          )}
        </div>
      </TerminalPanel>

      <TerminalPanel title="VERIFY BY TRANSACTION SIGNATURE" status="active">
        <div className="space-y-4">
          <div className="text-xs text-[var(--text-muted)]">
            Paste a Solana transaction signature for a USDC transfer to our merchant wallet. We will validate and credit if eligible.
          </div>
          <DataGrid columns={2} gap="md">
            <TerminalInput
              label="Transaction Signature"
              value={verifyInput}
              onChange={(e) => setVerifyInput(e.target.value)}
              disabled={verifyBusy}
            />
            <div className="flex items-end">
              <GlowButton onClick={handleVerify} disabled={verifyBusy || !verifyInput.trim()} loading={verifyBusy} className="w-full">
                [ VERIFY & CREDIT ]
              </GlowButton>
            </div>
          </DataGrid>
          {verifyStatus && (
            <div className="border border-[var(--border-dim)] bg-black bg-opacity-40 p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span>Status</span>
                <span className="uppercase text-[var(--accent-cyan)]">{verifyStatus.status}</span>
              </div>
              {verifyStatus.code && (
                <div className="flex items-center justify-between">
                  <span>Code</span>
                  <span>{verifyStatus.code}</span>
                </div>
              )}
              {verifyStatus.reference && (
                <div className="flex items-center justify-between">
                  <span>Reference</span>
                  <span>{verifyStatus.reference}</span>
                </div>
              )}
              {verifyStatus.amount_microcredits !== undefined && (
                <div className="flex items-center justify-between">
                  <span>Amount Credited</span>
                  <span>{formatMicro(verifyStatus.amount_microcredits)} credits</span>
                </div>
              )}
              {verifyStatus.type && (
                <div className="flex items-center justify-between">
                  <span>Type</span>
                  <span className="uppercase">{verifyStatus.type}</span>
                </div>
              )}
              {verifyStatus.message && (
                <div 
                  className="text-xs text-center"
                  style={{
                    color: verifyStatus.status === 'confirmed' || verifyStatus.status === 'already_confirmed'
                      ? 'var(--accent-green)'
                      : verifyStatus.status === 'pending'
                      ? 'var(--accent-yellow)'
                      : 'var(--accent-red)'
                  }}
                >
                  {verifyStatus.message}
                </div>
              )}
            </div>
          )}
        </div>
      </TerminalPanel>

      {pendingPayments.length > 0 && (
        <TerminalPanel title="PENDING PAYMENTS - RETRY VERIFICATION" status="active">
          <div className="space-y-3">
            <div className="text-xs text-[var(--text-muted)]">
              These payments were sent but not yet confirmed. Click "Verify Now" to retry verification and credit.
            </div>
            {retryStatus && (
              <div className="border border-[var(--border-dim)] bg-black bg-opacity-40 p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span>Status</span>
                  <span className="uppercase text-[var(--accent-cyan)]">{retryStatus.status}</span>
                </div>
                {retryStatus.code && (
                  <div className="flex items-center justify-between">
                    <span>Code</span>
                    <span>{retryStatus.code}</span>
                  </div>
                )}
                {retryStatus.reference && (
                  <div className="flex items-center justify-between">
                    <span>Reference</span>
                    <span>{retryStatus.reference}</span>
                  </div>
                )}
                {retryStatus.amount_microcredits !== undefined && (
                  <div className="flex items-center justify-between">
                    <span>Amount Credited</span>
                    <span>{formatMicro(retryStatus.amount_microcredits)} credits</span>
                  </div>
                )}
                {retryStatus.type && (
                  <div className="flex items-center justify-between">
                    <span>Type</span>
                    <span className="uppercase">{retryStatus.type}</span>
                  </div>
                )}
                {retryStatus.message && (
                  <div 
                    className="text-xs text-center"
                    style={{
                      color: retryStatus.status === 'confirmed' || retryStatus.status === 'already_confirmed'
                        ? 'var(--accent-green)'
                        : retryStatus.status === 'pending'
                        ? 'var(--accent-yellow)'
                        : 'var(--accent-red)'
                    }}
                  >
                    {retryStatus.message}
                  </div>
                )}
              </div>
            )}
            {pendingPayments.map((payment) => (
              <div
                key={payment.tx_signature}
                className="border border-[#000] bg-[#00000085] p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-[var(--text-muted)]">Amount:</span>
                      <span className="text-[var(--text-primary)] font-semibold">
                        {formatMicro(payment.amount_usd_micros)} USD
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[var(--text-muted)]">Sent:</span>
                      <span className="text-[var(--text-primary)]">
                        {new Date(payment.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[var(--text-muted)]">Signature:</span>
                      <a
                        href={`${EXPLORER_BASE}${payment.tx_signature}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--accent-cyan)] underline break-all text-[10px] font-mono"
                      >
                        {payment.tx_signature}
                      </a>
                    </div>
                  </div>
                  <GlowButton
                    onClick={() => handleRetryVerification(payment.tx_signature!)}
                    disabled={retryingSignature === payment.tx_signature}
                    loading={retryingSignature === payment.tx_signature}
                    className="!text-xs whitespace-nowrap"
                    variant="primary"
                  >
                    {retryingSignature === payment.tx_signature ? 'VERIFYING...' : '[ VERIFY NOW ]'}
                  </GlowButton>
                </div>
              </div>
            ))}
          </div>
        </TerminalPanel>
      )}

      <TerminalPanel title="PAYMENT HISTORY" status="active">
        <div className="flex justify-between items-center mb-4 text-xs text-[var(--text-muted)]">
          <span>Showing most recent payments</span>
          <GlowButton onClick={loadHistory} loading={historyBusy} disabled={historyBusy} className="!text-xs">
            [ REFRESH HISTORY ]
          </GlowButton>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="uppercase tracking-widest text-[var(--text-muted)]">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Credits</th>
                <th className="px-3 py-2">Reference</th>
                <th className="px-3 py-2">Signature</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 && !historyBusy ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-[var(--text-muted)]">
                    No payments yet.
                  </td>
                </tr>
              ) : (
                history.map((entry, idx) => (
                  <tr key={`${entry.tx_signature ?? entry.reference ?? idx}-${entry.created_at}`} className="border-t border-[var(--border-dim)]">
                    <td className="px-3 py-2 whitespace-nowrap">{new Date(entry.created_at).toLocaleString()}</td>
                    <td className="px-3 py-2">{renderStatus(entry)}</td>
                    <td className="px-3 py-2 font-mono">{formatMicro(entry.credited_microcredits)}</td>
                    <td className="px-3 py-2 font-mono break-all">{entry.reference ?? '—'}</td>
                    <td className="px-3 py-2 font-mono">
                      {entry.tx_signature ? (
                        <a
                          href={`${EXPLORER_BASE}${entry.tx_signature}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--accent-cyan)] underline"
                          title={entry.tx_signature}
                        >
                          {truncateSignature(entry.tx_signature)}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </TerminalPanel>
    </div>
  );
}


