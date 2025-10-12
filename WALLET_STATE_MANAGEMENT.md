# Wallet State Management Implementation

## Overview
This document describes the implementation of proper wallet disconnect and wallet change handling to ensure session cookies are properly cleared and users are always authenticated with the correct wallet.

## Problem Statement
Previously, when a user disconnected their wallet or connected a different wallet, the session cookie would persist. This created security issues:
1. Users could see balance even when disconnected
2. When connecting a new wallet, the old session persisted without re-verification
3. Failed verification didn't properly disconnect the wallet

## Solution Implemented

### 1. Server-Side Changes

#### `lib/session.ts`
- **Enhanced `getSession()`**: Now returns wallet address along with user ID
- **Added `getSessionWithWalletVerification()`**: Optional function to verify wallet address matches session

```typescript
// Session now includes wallet address
return { 
  id: data.id, 
  userId: data.user_id,
  walletAddress: wallet?.address || null
};
```

#### `lib/withCreditGuard.ts`
- **Added optional wallet verification**: New parameter `verifyWalletAddress` allows endpoints to verify wallet address from `x-wallet-address` header
- **Enhanced security**: Automatically validates wallet matches session if enabled

#### `app/api/auth/session/route.ts` (NEW)
- **New endpoint**: `GET /api/auth/session`
- Returns current session status and wallet address
- Used by client to validate wallet matches session

### 2. Client-Side Changes

#### `components/WalletControls.tsx`
Complete rewrite to handle all wallet state scenarios:

**Key Features:**

1. **Wallet Disconnect Handling**
   - Detects when wallet disconnects via `useEffect` watching `publicKey`
   - Automatically calls `/api/auth/logout` to clear session cookie
   - Clears internal state and dispatches `auth-changed` event

2. **Wallet Address Change Detection**
   - Checks if connected wallet matches session wallet via `/api/auth/session`
   - If mismatch detected, automatically logs out
   - Shows "Wallet changed. Please reconnect..." status
   - Requires manual reconnection (doesn't auto-verify with new wallet)

3. **Verification Failure Handling**
   - On any verification error, calls `wallet.disconnect()`
   - Also calls logout to clear session
   - Prevents authenticated state with failed verification

4. **Session Validation**
   - On wallet connect, first checks for existing session
   - Validates session wallet matches connected wallet
   - Only proceeds with new verification if needed

**State Flow:**
```
Wallet Connect → Check Session → 
  If Session Exists:
    If Wallet Matches → Done ✓
    If Wallet Differs → Logout + Require Reconnect
  If No Session:
    Request Nonce → Sign Message → Verify → 
      Success → Store wallet + Dispatch event ✓
      Failure → Logout + Disconnect wallet
      
Wallet Disconnect → Logout + Clear state + Dispatch event
```

#### `components/HeaderCredits.tsx`
- **Added `auth-changed` event listener**: Refreshes balance when auth state changes
- **Added authentication state tracking**: Tracks `isAuthenticated` based on balance API response
- **Conditional rendering**: Hides credits display and "Manage" button when user is not authenticated
- Ensures balance display updates immediately on logout/wallet change

#### `app/credits/page.tsx`
- **Added authentication check**: Validates user is authenticated before showing page
- **Added redirect logic**: Automatically redirects to homepage if user is not authenticated
- **Added loading state**: Shows loading indicator while checking authentication
- Prevents unauthorized access to credits management page

### 3. Event System

Custom events dispatched on auth state changes:
- **`auth-changed`**: Fired when user logs out or wallet changes
- **`creditsUpdated`**: Existing event for credit balance changes

Components listen to these events to stay synchronized.

## Security Improvements

1. **Session-Wallet Binding**: Sessions now track which wallet they belong to
2. **Automatic Cleanup**: Cookies are cleared immediately on disconnect
3. **Change Detection**: Switching wallets requires re-authentication
4. **Verification Enforcement**: Failed verification = forced disconnect
5. **Server-Side Validation**: Optional wallet address verification on protected endpoints

## Testing Scenarios

### Test 1: Normal Connection Flow
1. Open app (not connected)
2. Click "Select Wallet"
3. Connect wallet and sign message
4. ✓ Balance should display
5. ✓ Cookie should be set

### Test 2: Wallet Disconnect
1. Connect wallet and verify (have active session)
2. Disconnect wallet from extension or UI
3. ✓ Cookie should be cleared immediately
4. ✓ Balance should show "—"
5. ✓ `/api/auth/logout` should be called (check Network tab)

### Test 3: Wallet Change
1. Connect Wallet A and verify (have active session)
2. Disconnect and connect Wallet B
3. ✓ Status should show "Wallet changed. Please reconnect..."
4. ✓ Old session should be cleared
5. ✓ Must sign message with Wallet B to authenticate
6. ✓ Balance should update to Wallet B's balance

### Test 4: Verification Failure
1. Open dev tools and simulate verification failure:
   - Modify `/api/auth/verify` to return 401
   - Or reject the signature request
2. Try to connect wallet
3. ✓ Wallet should disconnect automatically
4. ✓ Error status should display
5. ✓ Cookie should be cleared

### Test 5: Page Reload with Session
1. Connect wallet and verify
2. Reload page
3. ✓ If wallet still connected, session should be validated
4. ✓ Balance should display immediately (no re-sign)
5. ✓ If wallet disconnected, session should be cleared

### Test 6: Page Reload with Different Wallet
1. Connect Wallet A and verify
2. Switch to Wallet B in extension (without disconnecting)
3. Reload page
4. ✓ Should detect mismatch and logout
5. ✓ Should require re-verification with Wallet B

### Test 7: Session Expiry
1. Connect and verify
2. Manually expire session in database or wait for expiry
3. Try to use protected endpoint
4. ✓ Should return 401 unauthorized
5. ✓ Client should handle gracefully

### Test 8: Cookie Persistence After Disconnect
**This was the original bug - now fixed**
1. Connect wallet and verify (cookie created)
2. Disconnect wallet
3. Check cookies in dev tools
4. ✓ `scenyx_session` cookie should be deleted
5. ✓ Balance should not display

### Test 9: Credits Page Access Control
1. Open app without connecting wallet
2. Try to navigate to `/credits` page
3. ✓ Should redirect to homepage immediately
4. ✓ Should not show credits page content

### Test 10: Header Credits Visibility
1. Open app without connecting wallet
2. ✓ Header should NOT show "Credits | X.XX cr | Manage"
3. Connect wallet and verify
4. ✓ Header should now show credits and manage button
5. Disconnect wallet
6. ✓ Header credits should disappear immediately

## API Endpoints Modified

- `GET /api/auth/session` - NEW: Check session and get wallet address
- `POST /api/auth/logout` - Existing: Clear session cookie
- All protected endpoints using `withCreditGuard` - Now support optional wallet verification

## Client Components Modified

- `components/WalletControls.tsx` - Complete rewrite for state management
- `components/HeaderCredits.tsx` - Added auth-changed listener

## Files Changed

1. `lib/session.ts` - Enhanced session with wallet address
2. `lib/withCreditGuard.ts` - Added optional wallet verification
3. `app/api/auth/session/route.ts` - NEW endpoint
4. `components/WalletControls.tsx` - Complete wallet state handling
5. `components/HeaderCredits.tsx` - Auth change listener + conditional rendering
6. `app/credits/page.tsx` - Authentication check + redirect to homepage
7. `app/layout.tsx` - Fixed WalletProvider to wrap entire body

## Migration Notes

No database migrations required. Changes are code-only.

## Future Enhancements

1. **Multi-wallet support**: Allow users to link multiple wallets to one account
2. **Session management UI**: Show active sessions and allow revoking
3. **Activity logging**: Track wallet connections/disconnections
4. **Stricter validation**: Enable `verifyWalletAddress: true` on all critical endpoints
5. **Rate limiting**: Add rate limits on verification attempts per wallet

