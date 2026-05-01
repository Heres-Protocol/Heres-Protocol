# Stellar Expansion Plan

## Goal

Add `stellar` as a first-class network alongside the current Solana flow, while preserving the existing Solana capsule model for users who only need Solana-native custody.

## Current Constraints

- Wallet connection is Solana-only.
- Capsule execution is implemented as an Anchor program on Solana.
- Beneficiary chain support is limited to `solana | evm`.
- Automation assumes Solana accounts, Solana vaults, and Magicblock execution.
- BTC/ETH support today means Solana SPL representations, not Stellar-issued assets.

## Recommended Delivery Order

1. Finish and stabilize Solana BTC/ETH capsules.
2. Introduce shared chain abstractions in the app and APIs.
3. Add Stellar beneficiary support before adding Stellar custody.
4. Add full Stellar custody/execution only after the product model for Stellar assets is fixed.

## Phase 1: Shared App Model

Update these areas first:

- `types/index.ts`
  - Extend beneficiary chain enum to include `stellar`.
- `utils/validation.ts`
  - Add Stellar address validation.
- `utils/intent.ts`
  - Preserve `assetSymbol`, `assetMint`, and add a future `assetIssuer` field for Stellar-issued assets.
- `lib/assets.ts`
  - Add a Stellar asset registry shape separate from Solana mint metadata.

Suggested shape:

```ts
type BeneficiaryChain = 'solana' | 'evm' | 'stellar'

type StellarAssetRef = {
  code: string
  issuer: string
}
```

## Phase 2: Stellar Beneficiary Delivery

This is the lowest-risk Stellar milestone.

- Keep custody on Solana.
- Allow a beneficiary to be a Stellar address.
- Add a Stellar delivery worker outside the Solana program.

Implication:

- Solana execution still determines eligibility.
- Post-execution delivery converts or routes the designated amount to the Stellar beneficiary.
- This should be treated similarly to the current EVM CCIP path, but with a Stellar-specific worker.

## Phase 3: Stellar Custody

This is the large architectural change.

New components required:

- Stellar wallet/signing integration in the web and Android clients.
- A Stellar custody account model.
- A Stellar execution worker or contract path.
- A persistence layer that tracks capsule state across Solana and Stellar.

Open design decision:

- Use a Stellar smart-contract path.
- Use an off-chain signed execution worker with Stellar custody accounts.

Without settling that decision first, implementation will fragment quickly.

## Product Decision Needed Before Coding

The team needs a hard answer for what `BTC` and `ETH` on Stellar mean:

1. Anchor-issued Stellar assets.
2. Wrapped assets bridged from another chain.
3. Off-platform accounting labels that settle elsewhere.

Every downstream implementation depends on this choice:

- Validation rules
- Balance fetchers
- Deposit/withdraw flows
- Execution path
- Compliance and disclosures

## File-Level Impact

- `app/providers.tsx`
  - Split wallet providers by chain.
- `app/create/page.tsx`
  - Add chain-aware asset and beneficiary forms.
- `app/capsules/page.tsx`
  - Render Stellar beneficiaries and Stellar asset labels.
- `lib/solana.ts`
  - Keep Solana-specific program calls isolated.
- `lib/crank.ts`
  - Move non-Solana delivery logic behind chain adapters.
- `mobile-android/...`
  - Add chain-aware create form and signing flow.

## Recommendation

Short term:

- Ship Solana BTC/ETH capsules first.

Next:

- Add Stellar as a beneficiary target before attempting Stellar-native custody.

Only after that:

- Build full Stellar custody and execution as a separate milestone.
