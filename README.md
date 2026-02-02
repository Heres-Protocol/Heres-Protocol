# Lucid - Privacy-Preserving Capsule Protocol on Solana

> **People disappear. Intent should not.**

Lucid is a **privacy-preserving capsule protocol on Solana Devnet**, where assets remain delegated, conditions stay private inside **Magicblock Ephemeral Rollup (ER)**, and execution happens automatically when silence becomes truth.

## What is Lucid?

Lucid solves a critical problem: **what happens to your digital assets and intentions when you can no longer manage them?** Instead of trusted third parties or legal documents, Lucid uses:

- **Persistent Capsule accounts on Solana Devnet** – Capsule state lives on-chain
- **Private execution logic inside Magicblock ER** – Conditions (offline, timer, beneficiaries) are checked privately in the Ephemeral Rollup
- **Automated execution via Magic Actions** – When conditions are met, execution runs on Devnet (e.g. SOL transfer to beneficiaries)

### Key Points

- **Capsule on Devnet**: Capsule metadata, owner, beneficiaries, and delegation state are stored on Solana Devnet.
- **Delegation to ER**: Capsule PDA can be delegated to Magicblock ER for private monitoring.
- **No ZK proofs required**: Privacy and execution are achieved via Magicblock ER + Magic Actions.
- **Automatic execution**: When inactivity period is met, execution is triggered.

## Architecture (Devnet + Magicblock)

```
┌─────────────────────────────────────┐
│        Solana Devnet                │
│  Capsule Program (Persistent)       │
│  - Capsule metadata, owner,         │
│    beneficiaries, delegation state  │
└─────────────────▲───────────────────┘
                  │ Magic Actions
┌─────────────────┴───────────────────┐
│     Magicblock ER (Private Runtime) │
│  - Private condition checks         │
│  - Offline / timer monitoring       │
│  - Crank → Magic Action → Devnet    │
└─────────────────▲───────────────────┘
                  │
┌─────────────────┴───────────────────┐
│         User Wallet (Devnet)         │
│  Create capsule, delegate, cancel    │
└─────────────────────────────────────┘
```

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS, GSAP
- **Blockchain**: Solana Devnet
- **Smart contract**: Anchor (Rust) – already deployed
- **Wallet**: Solana Wallet Adapter (Phantom, Backpack, etc.)
- **RPC**: Helius API
- **Private execution**: Magicblock Ephemeral Rollups

## Project Structure

```
Lucid_solana/
├── app/                 # Next.js app (landing, create, capsules, dashboard)
├── components/          # Navbar, Footer, AsciiCapsule, CapsuleMediaBlock
├── config/              # Solana connection (getSolanaConnection, getProgramId)
├── constants/           # Program ID, Magicblock ER, storage keys
├── lib/                 # solana.ts, helius.ts, program.ts
├── lucid_program/       # Anchor program (Rust) – source only
├── idl/                 # lucid_program.json
├── types/               # IntentCapsule, Beneficiary, WalletActivity
└── utils/               # intent encoding, validation
```

## Getting Started

1. **Clone and install**
   ```bash
   cd Lucid_solana
   npm install
   ```

2. **Environment**
   Create `.env.local`:
   ```env
   NEXT_PUBLIC_SOLANA_NETWORK=devnet
   NEXT_PUBLIC_HELIUS_API_KEY=your_helius_api_key
   NEXT_PUBLIC_PROGRAM_ID=BiAB1qZpx8kDgS5dJxKFdCJDNMagCn8xfj4afNhRZWms
   ```

3. **Run**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

## Deployed Program (Devnet)

| 항목 | 값 |
|------|-----|
| **Cluster** | https://api.devnet.solana.com |
| **Program Id** | `BiAB1qZpx8kDgS5dJxKFdCJDNMagCn8xfj4afNhRZWms` |

프론트엔드는 위 Program Id를 `.env.local`의 `NEXT_PUBLIC_PROGRAM_ID`로 사용합니다.

## Solana Program (Anchor) – Instruction Reference

- **create_capsule** – Create capsule (owner, inactivity period, intent data).
- **update_intent** – Update intent data (owner only).
- **execute_intent** – Execute when inactivity period is met.
- **update_activity** – Refresh last activity timestamp (heartbeat).
- **deactivate_capsule** – Deactivate capsule (owner only).
- **delegate_capsule** – Delegate capsule PDA to Magicblock ER.
- **undelegate_capsule** – Commit and undelegate from ER.
- **schedule_execute_intent** – Schedule crank (Magicblock ScheduleTask).
- **recreate_capsule** – Create a new capsule after one has been executed.

## Magicblock ER (Devnet)

- **Delegation program**: `DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh`
- **Router**: `https://devnet-router.magicblock.app`
- Constants: `constants/index.ts` (`MAGICBLOCK_ER`)

## License

MIT.
