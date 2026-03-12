# 🗺️ Development Plan — Simply Wallet

> From PoC to product. 9 features, organized in 4 phases by dependency order.

---

## Architecture Decision: Backend

Several features require persistence. Recommended stack:
- **Supabase** (DB + Auth + Realtime) — consistent with CoBuilders' existing tooling
- Tables needed: `safes`, `signers`, `ens_names`, `tx_history_cache`
- Realtime subscriptions for pending tx sync

**Set up Supabase project before Phase 2.**

---

## Phase 1 — Core Client-Side Features (no backend needed)

These build on the existing PoC and are purely client-side / on-chain.

### 1.1 Multi-Token Support (#2)
- **Complexity:** Medium
- **Depends on:** Nothing (extends current send flow)
- **Tasks:**
  - Fetch ERC-20 balances via multicall (use token list like Uniswap default + custom)
  - Token selector component in send flow
  - Balance display per token on main screen
  - USD pricing via CoinGecko/DeFiLlama API (no key needed)
- **Note:** This is a prerequisite for Swaps (#1) and Chain Abstraction (#3)

### 1.2 Transaction History (#8)
- **Complexity:** Medium
- **Depends on:** Multi-Token (#1.1) for token display
- **Tasks:**
  - Fetch tx history from Safe Transaction Service API (safe-client-gateway) or index from on-chain events
  - Display: date, operation type, amount, token, chain, status
  - Filters by token and chain
  - Pagination / infinite scroll
- **Data source:** Safe Transaction Service has a public API per chain — no DB needed for reads

### 1.3 Re-send from History (#7)
- **Complexity:** Low
- **Depends on:** Transaction History (#1.2)
- **Tasks:**
  - "Send again" button on each history entry
  - Pre-fill recipient, amount, token, chain — all editable
  - 2-3 taps to confirm
  - Reuse existing send flow

### 1.4 Settings — Signer Management (#9)
- **Complexity:** High ⚠️
- **Depends on:** Nothing (but sensitive — needs careful UX)
- **Tasks:**
  - Settings screen showing current owners + threshold
  - "Switch to Ledger" flow: add Ledger as new owner → remove Passkey owner (2 Safe txs, or batched via MultiSend)
  - If threshold > 1, requires other signers to approve → ties into pending tx queue (Phase 2)
  - For PoC/MVP with threshold=1: simpler, single signer can swap themselves
- **⚠️ Risk:** If user removes their only signer without adding another, Safe is bricked. Must enforce validation.

---

## Phase 1.5 — Gas Abstraction

The relayer already pays for deploy txs. This phase extends that to **all user-facing operations** so the user never needs gas.

### 1.5 Gas Abstraction (#10)
- **Complexity:** Medium-High
- **Depends on:** Existing relayer infrastructure
- **Tasks:**
  - Relayer pays gas for all Safe transactions (execTransaction, addOwner, swaps, bridges)
  - UI shows **zero gas fees** — no "gas" concept exposed to users
  - Remove any "gas estimation" displays from the UI — the user doesn't care
  - Relayer balance monitoring + alerts when running low
  - Rate limiting to prevent abuse (e.g., max N txs per Safe per hour)
  - Future: recoup gas costs via swap fees (#1) or subscription model
- **UX principle:** If the user ever sees "gas", we failed. The app should feel like Venmo, not MetaMask.
- **Cost consideration:** On Base, gas is cheap (~$0.001-0.01 per tx). At scale, swap fees should cover relayer costs comfortably.

---

## Phase 2 — Persistence & Session (requires Supabase)

### 2.0 Supabase Setup (prerequisite)
- Create project, define schema:
  ```sql
  -- Core tables
  safes (id, address, chain_id, name, created_at, ens_name)
  safe_devices (id, safe_id, credential_id, device_name, created_at)
  ```
- RLS policies: device-based auth (credential_id as identity)

### 2.1 Session Persistence / Remember Wallet (#5)
- **Complexity:** Low-Medium
- **Depends on:** Supabase setup
- **Tasks:**
  - On Safe creation: store Safe address + credential_id in Supabase + localStorage
  - On app load: check localStorage → if Safe exists, skip creation flow
  - Device-to-Safe mapping in DB (one device can have multiple Safes)
  - Safe selector if user has multiple
- **Note:** localStorage alone works for single-device, but DB enables multi-device recovery

### 2.2 Improved Add Signer Flow (#4)
- **Complexity:** Medium-High
- **Depends on:** Session persistence (#2.1), Signer Management (#1.4)
- **Tasks:**
  - Step-by-step wizard: "Invite signer" → generate invite link/QR
  - New signer opens link → creates Passkey → signer proxy deployed
  - Original owner approves adding new signer (Safe tx: `addOwnerWithThreshold`)
  - Handle case: invitee doesn't have app → link goes to app with onboarding
  - DB stores pending invites with expiry
- **UX consideration:** The invite link should work as a deep link on mobile

---

## Phase 3 — DeFi & Cross-Chain

### 3.1 Swaps with Uniswap + Protocol Fee (#1)
- **Complexity:** High
- **Depends on:** Multi-Token (#1.1)
- **Tasks:**
  - Integrate Uniswap Universal Router or SwapRouter02
  - Quote fetching via Uniswap SDK or Quoter contract
  - Fee mechanism: wrap swap in a batch tx (MultiSend):
    1. Approve token to router
    2. Execute swap
    3. Transfer fee % to CoBuilders treasury address
  - Fee config: start with fixed % (e.g., 0.3%), make configurable later
  - Slippage settings, price impact warning
- **Fee architecture options:**
  - **Option A:** Fee-on-input — take fee from input amount before swap
  - **Option B:** Fee-on-output — take fee from output after swap
  - Recommendation: **Fee-on-input** (simpler, user sees exact cost upfront)
- **Legal note:** Check if fee collection requires any compliance considerations

### 3.2 Chain Abstraction via Across (#3)
- **Complexity:** Very High ⚠️
- **Depends on:** Multi-Token (#1.1), Session Persistence (#2.1)
- **Tasks:**
  - Integrate Across Protocol SDK for bridging
  - UX: user selects origin chain + destination chain when sending
  - Under the hood: Across bridge tx executed from Safe
  - "Preferred chain" setting per Safe (consolidation target)
  - Balance aggregation: show unified balance across chains
  - Status tracking: bridge txs have a fill time (~2-10 min for Across)
- **Complexity drivers:**
  - Need Safe deployed on multiple chains (or deploy on-demand)
  - Need to track bridge status (Across API)
  - Gas on destination chain (who pays?)
  - Error handling if bridge fails/stalls
- **Recommendation:** Start with a simple "Bridge" feature (explicit), evolve to transparent abstraction later

---

## Phase 4 — Identity & ENS

### 4.1 ENS Subdomain per Safe (#6)
- **Complexity:** High
- **Depends on:** Supabase (#2.0), Safe creation flow
- **Tasks:**
  - Register parent domain (e.g., `cobuilders.eth`) on mainnet — one-time
  - On Safe creation: user picks a name → validate availability (DB check + on-chain)
  - Register subdomain: `name.cobuilders.eth` → resolves to Safe address
  - Display ENS as primary identifier in UI
  - Accept ENS in send flow (resolve to address)
- **Architecture options:**
  - **On-chain subdomains (mainnet):** ~$5-15 gas per registration, authoritative, but mainnet cost
  - **Off-chain resolver (CCIP-Read / EIP-3668):** gasless registration, stored in DB, resolved via gateway. Much cheaper. Used by cb.id, uni.eth, etc.
  - **Recommendation:** Off-chain resolver — gasless, instant, scales. Use something like [NameStone](https://namestone.xyz) or build custom CCIP gateway
- **Cross-chain:** If Safes are on Base but ENS is on mainnet, off-chain resolver handles this naturally (gateway returns the Base address)

---

## 📊 Summary Matrix

| # | Feature | Phase | Complexity | Needs DB | Depends On |
|---|---------|-------|------------|----------|------------|
| 2 | Multi-Token Support | 1 | Medium | ❌ | — |
| 8 | Transaction History | 1 | Medium | ❌ | #2 |
| 7 | Re-send from History | 1 | Low | ❌ | #8 |
| 9 | Settings / Signer Mgmt | 1 | High | ❌ | — |
| 10 | Gas Abstraction | 1.5 | Med-High | ❌ | Relayer |
| 5 | Session Persistence | 2 | Low-Med | ✅ | Supabase |
| 4 | Add Signer Flow | 2 | Med-High | ✅ | #5, #9 |
| 1 | Swaps + Fee (0.5%) | 3 | High | ❌ | #2 |
| 3 | Chain Abstraction | 3 | Very High | ✅ | #2, #5 |
| 6 | ENS Subdomains | 4 | High | ✅ | Supabase |

---

## ⏱️ Rough Estimates (solo dev time, no QA)

| Phase | Features | Estimate |
|-------|----------|----------|
| Phase 1 | Multi-Token, History, Re-send, Settings | 2-3 weeks |
| Phase 1.5 | Gas Abstraction | 1 week |
| Phase 2 | Supabase + Session + Add Signer | 1.5-2 weeks |
| Phase 3 | Swaps + Chain Abstraction | 3-4 weeks |
| Phase 4 | ENS Subdomains | 1-2 weeks |
| **Total** | | **~9-12 weeks** |

*Estimates assume 1 senior dev, familiar with Safe + viem. Chain abstraction is the wildcard — could stretch.*

---

## ✅ Decisions Made

| Decision | Answer |
|----------|--------|
| **Product name** | **Simply Wallet** |
| **Parent ENS domain** | TBD (placeholder) |
| **Swap fee** | 0.5% (placeholder) |
| **Treasury address** | Relayer EOA (temporary, until dedicated multisig) |
| **Initial chains** | Base + Ethereum + Arbitrum |
| **ENS approach** | Off-chain resolver (CCIP-Read) — recommended |
| **Gas UX** | Fully abstracted — user never sees gas |

## 🚨 Still Open

1. **Parent ENS domain** — pick and register when ready
2. **Final swap fee %** — validate with team before launch
3. **Dedicated treasury multisig** — set up before mainnet
