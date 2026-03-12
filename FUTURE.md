# Future Improvements

## Pending Transactions (requires backend/DB)
- Shared pending transaction queue visible to all signers
- Real-time sync between devices (Supabase realtime or WebSocket)
- Push notifications when a new tx needs signing

## Address Book (requires backend/DB)
- Shared address book across all wallet signers
- Labels/nicknames for addresses
- Recent recipients auto-saved

## Multi-Token Support
- ERC-20 token balances and transfers
- Token selector in send flow
- Token list management (add custom tokens)
- Display portfolio value in USD

## ENS Subdomains per Safe (requires backend/DB + ENS setup)
- User picks a name when creating a Safe (e.g. "laSafeDeAugusto")
- App registers it as a subdomain: `laSafeDeAugusto.simplysafe.eth`
- Requires owning `simplysafe.eth` (or chosen parent domain) and a resolver setup
- Subdomain → Safe address resolution on-chain
- Needs DB to track name availability / reservations
- Consider: name validation rules, transfer/rename policy, reverse resolution

## Additional Features
- Gas estimation and fee display
- Transaction simulation before execution
- Owner removal and threshold changes
- Safe module management
- WalletConnect integration
- Mobile native app (React Native)
- ENS name resolution
- Batch transactions
