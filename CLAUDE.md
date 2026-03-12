# CLAUDE.md — Simply Wallet Foundation Blueprint

> This file is the architectural context for every Claude Code instance working on this repo.
> Read it fully before making any changes. Follow its conventions strictly.

---

## Product

**Simply Wallet** — a mobile-first Smart Account wallet powered by Safe + Passkeys (WebAuthn).
Users create and manage Safe multisig wallets using biometrics (Face ID / fingerprint) instead of seed phrases.
The app feels like Venmo, not MetaMask. **No gas concept is exposed to users.**

## Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | React | 18.3 |
| Build | Vite | 6.x |
| Language | TypeScript | 5.6 (strict mode) |
| Blockchain | viem | 2.21+ |
| Chain | Base Sepolia (testnet) | chainId: 84532 |
| Auth | WebAuthn / Passkeys | Platform authenticator, ES256 (P-256) |
| Smart Contracts | Safe v1.4.1 | Singleton + Proxy pattern |
| Signer | SafeWebAuthnSignerFactory | P-256 verifier via EIP-7212 |
| Styling | Vanilla CSS | Single file: `src/styles.css` |
| Deployment | Vercel | Auto-preview on push |

## Architecture

### No backend — everything is client-side + on-chain

- All blockchain interactions go through viem's `publicClient` (reads) and `walletClient` (writes via relayer)
- The **relayer** is an EOA whose private key is in the env. It pays gas for all Safe deployments and transactions
- State is persisted in `localStorage` (see `src/lib/storage.ts`)
- Routing is hash-based (`#/join?safe=0x...`, `#/sign?data=...`)

### Key Contract Addresses (Base Sepolia)

```
Safe Singleton:      0x41675C099F32341bf84BFc5382aF534df5C7461a
Safe Proxy Factory:  0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67
Fallback Handler:    0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99
Signer Factory:      0x1d31F259eE307358a26dFb23EB365939E8641195
P256 Verifier:       0xc2b78104907F722DABAc4C69f826a522B2754De4
```

### Relayer

- EOA funded with testnet ETH
- Private key via `VITE_RELAYER_PRIVATE_KEY` env var
- ⚠️ Currently exposed in browser bundle (VITE_ prefix) — PoC limitation
- The relayer pays gas for ALL transactions — users never need gas
- Treasury address = relayer address (temporary)

## Project Structure

```
src/
├── App.tsx                          # Root component, hash router
├── main.tsx                         # React entry point
├── styles.css                       # All styles (single file, mobile-first)
├── vite-env.d.ts
├── lib/
│   ├── encoding.ts                  # EIP-712 Safe tx hashing
│   ├── multisig.ts                  # Multi-sig packing, shareable tx blobs
│   ├── relayer.ts                   # Viem clients, chain config, relayer account
│   ├── router.ts                    # Hash-based routing
│   ├── safe.ts                      # Safe deployment, execTransaction, owner mgmt
│   ├── signer.ts                    # WebAuthn signer proxy deployment
│   ├── storage.ts                   # localStorage persistence (SavedSafe, SavedOwner)
│   └── webauthn.ts                  # Passkey creation & signing (CBOR, P-256)
└── components/
    ├── CreateWallet.tsx              # New wallet flow (passkey → signer → safe)
    ├── JoinWallet.tsx               # Join existing safe as co-signer
    ├── WalletDashboard.tsx          # Main dashboard (balance, send, receive, add owner)
    ├── ApproveTransaction.tsx       # Co-sign a pending tx via QR/link
    └── shared/
        └── SlideToConfirm.tsx       # iOS-style slide-to-confirm widget
```

## Conventions

### Code Style
- **No UI component library** — vanilla React + CSS
- **No state management library** — React useState/useEffect only
- **Inline ABIs** — contract ABIs are defined as `const` arrays in the files that use them (not separate JSON files)
- **Hex types** — use viem's `` `0x${string}` `` type alias for addresses and hex data
- **BigInt** — all on-chain numeric values use native BigInt (`1n`, not `BigNumber`)
- **Error handling** — try/catch with `setError(e.message)` pattern in components
- **No external API calls** — everything is RPC or on-chain (no backend, no REST APIs yet)

### Naming
- **Files:** camelCase for lib (`encoding.ts`), PascalCase for components (`CreateWallet.tsx`)
- **Functions:** camelCase, descriptive (`deploySignerProxy`, `computeSafeTxHash`)
- **Components:** PascalCase, one component per file
- **Constants:** UPPER_SNAKE for contract addresses and ABIs
- **Types/Interfaces:** PascalCase (`SavedSafe`, `ShareableTransaction`)

### Branching
- `main` — production branch, auto-deploys to Vercel
- Feature branches: `feature/<short-description>` (e.g., `feature/multi-token`)
- Each feature branch gets a Vercel preview URL automatically

### Git
- Commit messages: concise, imperative mood (`Add multi-token balance display`)
- One logical change per commit
- Push to feature branch → Vercel preview → human review → merge to main

## Environment Variables

```bash
VITE_RELAYER_PRIVATE_KEY=0x...  # Relayer EOA private key (Base Sepolia funded)
```

## Current Features (already implemented)

1. ✅ Create wallet with Passkey (Face ID)
2. ✅ Deploy Safe proxy on Base Sepolia (relayer pays gas)
3. ✅ Send ETH from Safe (with passkey signature)
4. ✅ Receive ETH (QR code + address display)
5. ✅ Add co-signer (invite via link, new passkey)
6. ✅ Multi-sig transaction flow (share via QR/link, co-sign, execute)
7. ✅ Session persistence via localStorage
8. ✅ Slide-to-confirm UX widget

## Key Patterns to Follow

### Adding a new lib module
1. Create `src/lib/<name>.ts`
2. Import viem clients from `./relayer` if needed
3. Export pure functions, avoid side effects at module level
4. Use explicit types for all function params and returns

### Adding a new component
1. Create `src/components/<Name>.tsx`
2. Use `useState` for local state, props for inputs
3. Follow the phase/status pattern (`type Phase = 'idle' | 'loading' | 'done' | 'error'`)
4. Add styles to `src/styles.css` (not CSS modules, not inline styles)
5. Wire into `App.tsx` via the router or conditional rendering

### Adding a new route
1. Add the route type to `src/lib/router.ts` (`Route` union type)
2. Parse it in `parseRoute()`
3. Handle it in `App.tsx`'s render logic

## ⚠️ Important Constraints

- **Mobile-first**: All UI must work on mobile Safari. Test at 375px width.
- **No npm packages without justification**: The codebase is intentionally minimal. Don't add packages for things that can be done with viem + vanilla JS.
- **Relayer is the gas payer**: Never show gas-related UI to the user. All txs go through the relayer.
- **Base Sepolia only** (for now): Don't add multi-chain support unless specifically tasked.
- **No backend**: Everything runs client-side. If you need persistence, use localStorage via `src/lib/storage.ts`.
