<!-- 37ff0fc7-8501-4f50-894f-5841715939e1 0b36fd9d-3dbf-498b-a15e-a6bcf162b9be -->
# Backend Plan: Supabase + Solana Wallet Credits (Wallet-only, Stablecoins, Reliable Webhooks)

## Goals

- **Wallet-only auth**: Users authenticate by signing a nonce with a Solana wallet (no email/password).
- **Credits model (deposit 1:1, usage multiplier)**: Deposits in USDC/USDT mint credits at a 1:1 rate (e.g., $10 → 10 credits). Spending uses a configurable conversion so **1 credit equals $0.70** of OpenAI spend by default (i.e., charge = ceil(usage_usd / 0.70) credits). This value is adjustable without redeploy.
- **Reliable payments**: Detect on-chain USDC/USDT transfers to our merchant wallet with no missed transactions.
- **Double-spend safe**: Strong ledger, holds/captures, idempotency, and row locks.
- **Key security**: OpenAI key never leaves backend; per-request budgets enforced.

## High-level Architecture

- **Frontend**: Next.js app router + `@solana/wallet-adapter` for wallet connection and signing; Solana Pay request generation for payments.
- **Backend** (Next.js API routes):
  - Auth: nonce + verify endpoints; issues HttpOnly JWT session.
  - Payments: create-intent; webhook for Helius; status polling.
  - Credits: balance; holds/capture/release; wrappers for feature endpoints.
- **Supabase (Postgres)**: Source of truth for users, wallets, payments, credits ledger, holds, sessions, config settings.
- **Solana infra**: Helius Enhanced Webhooks (account activity) for the merchant wallet; fallback polling by reference if webhook delayed.

## Wallet-only Auth (SIWS)

1. `POST /api/auth/nonce` → server creates a unique nonce tied to `walletAddress` and sets a short-lived nonce record.
2. Client signs `"scenyx login: <nonce>"` with wallet.
3. `POST /api/auth/verify` → server verifies ed25519 signature, upserts `users`+`wallets`, issues **HttpOnly** session cookie (JWT) bound to wallet address + user id.
4. Middleware extracts session from cookie for API auth. Sessions stored/rotated in DB.

Security notes:

- Nonce is single-use, expires in 5 min; store and invalidate atomically.
- JWT includes session id; server checks DB session is valid. Use SameSite=Lax, Secure, HttpOnly.

## Payments (USDC/USDT on Solana)

- **Stablecoin-only**: Accept only allowed SPL token mints (USDC, USDT). Configure mainnet mint addresses in env.
- **Merchant Wallet**: Single merchant public key; derive Associated Token Accounts (ATAs) for each mint.
- **Solana Pay flow (with reference)**:
  - Client requests to buy credits (specify USD or credits).
  - Server creates a payment intent row with a fresh `reference` public key and expected `amount_usd`, `mint`.
  - Server returns Solana Pay params: `recipient`, `splToken`, `amount`, `reference`, `label`, `message`.
  - Client presents QR / sends transfer via wallet using `@solana/pay` (includes `reference`).

### Payment Confirmation

- **Primary**: Helius Enhanced Webhook for the merchant wallet ATA(s):
  - Validates webhook HMAC signature.
  - Filters inbound SPL transfers to our ATA for allowed mints.
  - Looks for known `reference`.
  - Verifies transaction is `finalized`, collects `tx_signature`, `slot`, `amount`, and `mint`.
- **Fallback**: Poll Helius `searchTransactions` by `reference` if client calls `/payments/refresh` and webhook hasn’t arrived.
- **Idempotent crediting**: Unique constraints on `payments.tx_signature` and `payments.reference` ensure single crediting.

## Credits Model (Updated)

We separate the two conversions: deposit-time issuance vs. usage-time deduction.

- **Issuance (deposit → credits)**: 1:1 mapping.
  - Example: 10.00 USDC received → 10.000000 credits issued.
- **Usage (OpenAI spend → credits deducted)**: governed by a configurable factor `CREDIT_USD_PER_CREDIT` (default 0.70).
  - Example: $1.00 OpenAI cost → ceil(1.00 / 0.70) = 1.428572… → 1.429 credits deducted.

Precision & rounding:

- Use micro-units for both USD and credits to avoid float errors (1 credit = 1_000_000 microcredits; $1 = 1_000_000 microUSD).
- Deduction uses `ceil` to ensure we never undercharge due to rounding.

### Configurability

- Store `CREDIT_USD_PER_CREDIT` in a `settings` table as microUSD per credit (e.g., 700_000 for $0.70).
- Cache in memory for 30s; admin can change without redeploy.
- Keep an env fallback `CREDIT_USD_PER_CREDIT=0.70` if DB setting missing.

### Holds/Captures under variable factor

- On hold creation, snapshot the factor into the hold row as `credit_usd_per_credit_micros_at_hold`.
- Estimate required credits for the feature using the snapshotted factor and create a hold.
- On capture, compute actual credits with the same snapshotted factor; if needed amount > held amount, either:
  - a) attempt an in-transaction hold increase (re-check balance), or
  - b) fail with 402 requiring a new hold (simpler initial behavior).
- If the factor changes after hold creation, snapshotting prevents surprises for both sides.

## API Surface

- Auth
  - `POST /api/auth/nonce` { walletAddress }
  - `POST /api/auth/verify` { walletAddress, signature, nonce }
  - `POST /api/auth/logout`
- Payments
  - `POST /api/payments/create-intent` { credits|usd, mint } → { recipient, splToken, amount, reference }
  - `POST /api/webhooks/hel-activity` (Helius webhook target)
  - `GET /api/payments/refresh?reference=…` → poll by reference
- Credits
  - `GET /api/credits/balance`
- Usage (wrappers)
  - `POST /api/usage/hold` { feature, estCredits } → { holdId }
  - `POST /api/usage/capture` { holdId, actualCredits }
  - `POST /api/usage/release` { holdId }

## Integrating with Existing Feature Routes

Wrap existing endpoints (e.g., `app/api/generate-threads/route.ts`, `generate-video/route.ts`, `generate-script/route.ts`) with `withCreditGuard({ estimateFn, chargeFn })`:

- Before calling OpenAI: compute an upper-bound estimate in USD from model limits → convert to credits using current factor → create a hold.
- Call OpenAI using server-side key only.
- After: compute actual USD usage from `response.usage`; convert to credits using factor snapshotted at hold → capture exact credits; release remainder.
- On errors/timeouts: auto-release hold.

## OpenAI Costing

- Centralize model pricing in `lib/pricing.ts` (usd per 1k tokens / per image / per minute, etc.).
- `lib/openai.ts` wraps SDK calls and returns `usage` in USD micros.
- Convert USD usage to credits using factor per above.
- Enforce per-request budget caps calculated in credits: `maxCredits = ceil(maxUsd / factor)`.

## Database Schema (Supabase)

Tables (simplified):

- `users` (id uuid pk, created_at)
- `wallets` (id uuid pk, user_id fk, address text unique, network text)
- `sessions` (id uuid pk, user_id fk, nonce text, expires_at timestamptz)
- `accounts` (id uuid pk, user_id fk unique, balance_microcredits bigint default 0)
- `payments` (

id uuid pk, user_id fk, reference text unique, tx_signature text unique,

mint text, amount_tokens bigint, amount_usd_micros bigint,

credited_microcredits bigint, status text, created_at, confirmed_at

)

- `credit_holds` (

id uuid pk, account_id fk, amount_microcredits bigint,

status text, expires_at, idempotency_key text unique,

credit_usd_per_credit_micros_at_hold bigint, created_at

)

- `credits_ledger` (

id bigserial pk, account_id fk, type text,

amount_microcredits bigint, hold_id uuid, payment_id uuid,

usage_id uuid, created_at

)

- `settings` (

key text primary key,

value_text text,

updated_at timestamptz default now()

)

Indexes & constraints:

- Unique on `wallets.address`.
- Unique on `payments.reference`, `payments.tx_signature`.
- Index on `credits_ledger.account_id, created_at`.
- Enforce non-negative `accounts.balance_microcredits` via transactional checks.

Balance derivation:

- Maintain `accounts.balance_microcredits` with atomic updates inside transactions plus append ledger row for audit.

## Env & Config

- `SOLANA_CLUSTER=mainnet-beta`
- `MERCHANT_WALLET_ADDRESS=` (pubkey)
- `USDC_MINT=`, `USDT_MINT=`
- `HELIUS_API_KEY=`, `HELIUS_WEBHOOK_SECRET=`
- `OPENAI_API_KEY=` (server only)
- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server only)
- New: `CREDIT_USD_PER_CREDIT` (default `0.70`), DB override in `settings`:`credit_usd_per_credit_micros`

## Security & Abuse Prevention

- Verify Helius webhook HMAC; reject if invalid.
- Only accept finalized transactions to our merchant ATA with allowed mints and correct decimals > 0.
- Enforce idempotency on: payments (reference/signature), holds (idempotency key), captures.
- All OpenAI calls from server; never expose keys to client; validate user session for all API routes.
- Set strict budgets per endpoint (max tokens/images/duration) and rate-limit per user.

## Operational Considerations

- Cron (or scheduled route) to:
  - Expire old nonces and sessions.
  - Expire and auto-release stale holds.
  - Reconcile payments older than N minutes by reference polling.
- Observability: log every ledger mutation with correlation id; store raw webhook payloads.

## Minimal Formulas & Pseudocode

Issuance (deposit → credits):

```ts
const MICRO = 1_000_000n;
const creditsIssuedMicro = BigInt(usdReceivedMicro); // 1:1 in micro units
```

Deduction (usage → credits):

```ts
// factorMicro = credit USD value in microUSD per 1 credit, e.g., 700_000 for $0.70
const creditsToDeductMicro = ceilDiv(BigInt(usageUsdMicro) * MICRO, BigInt(factorMicro));
```

Hold creation (snapshot factor):

```ts
const factorMicro = await getCreditUsdPerCreditMicro();
const estCreditsMicro = ceilDiv(BigInt(estUsdMicro) * MICRO, BigInt(factorMicro));
insert hold { amount_microcredits: estCreditsMicro, credit_usd_per_credit_micros_at_hold: factorMicro };
```

Capture:

```ts
const factorAtHold = hold.credit_usd_per_credit_micros_at_hold;
const actualCreditsMicro = ceilDiv(BigInt(actualUsdMicro) * MICRO, BigInt(factorAtHold));
// capture up to hold; if > hold, attempt increase or 402
```

Helper:

```ts
function ceilDiv(a: bigint, b: bigint) { return (a + b - 1n) / b; }
```

## Test Plan

- Unit: signature verify, pricing conversion, ledger math; boundary rounding with ceil.
- Integration: deposit $10 → 10 credits; $1 spend deducts 1.429 credits; duplicate webhook; partial payments; refunds.
- Feature: wrapper correctly holds/captures around OpenAI calls (success/fail/timeout) with snapshotted factor.

## Rollout

- Start with USDC only; add USDT once stable.
- Enable webhook + fallback polling; monitor for dropped events.
- Adjust `CREDIT_USD_PER_CREDIT` via `settings` as needed; ensure UI displays current effective rate.

### To-dos

- [ ] Review current API routes to map where credit checks will hook in
- [ ] Lay out Supabase tables, enums, and RLS policies for wallet and credit tracking
- [ ] Describe Solana payment detection, Helius webhook integration, and credit conversion
- [ ] Detail services/workers for credit issuance, usage debits, and idempotency
- [ ] Plan protections for OpenAI key usage and monitoring/testing strategy