# Heres - Privacy-Preserving Capsule Protocol on Solana

> **People disappear. Intent should not.**

Heres is a **privacy-preserving capsule protocol on Solana Devnet**, where assets remain delegated, conditions stay private inside **Magicblock Ephemeral Rollup (ER)** or **Private Ephemeral Rollup (PER / TEE)**, and execution happens automatically when silence becomes truth.

---

## Background

As digital asset ownership grows, a critical gap has emerged: **what happens to your crypto and your intentions when you can no longer manage them?** Traditional estate planning rarely covers bearer assets controlled by private keys. Wills and executors often lack both the technical means and legal clarity to access wallets, and leaving keys in a safe or with a lawyer creates security and privacy risks. At the same time, **confidential computing** (keeping data private during computation) has become a major focus in crypto infrastructure, enabling sensitive logic to run without exposing conditions or beneficiaries on a public ledger. Heres sits at the intersection: it uses **time-locked intent capsules** on Solana with **private execution** via Magicblock’s Ephemeral Rollups (ER) and Private Ephemeral Rollups (PER / TEE), so your “if I go silent” instructions are enforced automatically and privately.

---

## Market Research & Trends

Our design and positioning are informed by published research and ecosystem reports from analysts and VCs.

### Digital asset inheritance & estate planning

- **Scale of the problem:** Nearly 20% of all bitcoin is estimated to be lost or stranded, often due to lost keys or owners dying without succession plans. With digital asset market cap exceeding $3T and 14–17% of U.S. adults holding crypto, unplanned wealth transfer is a growing issue ([CoinDesk](https://www.coindesk.com/opinion/2024/12/18/crypto-s-estate-planning-problem-a-wake-up-call), [CNBC/Wealth Management](https://www.wealthmanagement.com/estate-planning/bitcoin-after-death-2025-estate-guide)).
- **Planning gaps:** Only about 24% of Americans have wills, and most wills do not address digital assets or authorize executors to access them. Cryptocurrencies are bearer assets: without proper documentation and access design, heirs cannot recover holdings ([Fidelity](https://www.fidelity.com/learning-center/wealth-management-insights/crypto-and-estate-planning), [BDO](https://www.bdo.com/insights/tax/dont-let-volatile-digital-assets-blow-up-a-clients-estate-plan)).
- **Implication for Heres:** We focus on **programmatic intent**: define conditions (e.g. inactivity period, beneficiaries) once; execution is automatic when conditions are met, without relying on heirs to discover keys or courts to interpret documents.

### Decentralized confidential computing (DeCC) & TEEs

- **Investment and momentum:** Over **$1 billion** has been invested into Decentralized Confidential Computing (DeCC) projects. The space is converging around ZKPs, MPC, FHE, and **Trusted Execution Environments (TEEs)** as core primitives for private computation on public chains ([Messari – The Privacy Layer: DeCC](https://messari.io/report/the-privacy-layer-understanding-the-inner-workings-of-decentralized-confidential-computing)).
- **TEE role:** TEEs provide hardware-enforced isolation so that conditions and data can be evaluated **in use** without exposing them on-chain. Messari and others describe TEEs as a practical way to achieve confidential execution with low overhead, and note projects like Secret Network, Phala, and TEN using TEEs for private smart contracts and rollups ([Cointelegraph – TEE explained](https://cointelegraph.com/news/trusted-execution-environments-tee-explained-the-future-of-secure-blockchain-applications)).
- **Implication for Heres:** We use Magicblock’s **PER (TEE)** so that inactivity checks and beneficiary logic run inside a trusted environment; only execution outcomes are committed to Solana. No ZK proofs are required for this flow.

### Solana ecosystem

- **Adoption and infra:** Solana has seen strong developer growth, high DEX share, and institutional interest (e.g. CME futures, tokenized funds). Chain GDP and stablecoin usage on Solana have grown sharply ([Messari State of Solana](https://messari.io/report/state-of-solana-q1-2025), [Helius Ecosystem Report](https://helius.dev/blog/solana-ecosystem-report-h1-2025)).
- **Implication for Heres:** We build on Solana for speed, low fees, and a clear program model; we integrate Helius for RPC and Magicblock for private execution so capsules are both persistent on-chain and privately monitored off-chain.

---

## Overview

**Heres** is a protocol that lets you create **Intent Capsules** on Solana: you lock SOL (or define NFT intents), set an **inactivity period** and **beneficiaries**, and delegate the capsule to Magicblock ER or PER (TEE). Your **conditions stay private** inside the rollup; when you have been inactive long enough, **execution is automatic** (e.g. SOL sent to beneficiaries). No third-party executor holds your keys; the program and the private runtime enforce your intent.

| Layer | Role |
|-------|------|
| **Solana Devnet** | Persistent capsule state (owner, vault, inactivity, delegation). |
| **Magicblock ER / PER (TEE)** | Private monitoring of conditions; triggers Magic Actions when conditions are met. |
| **User** | Create capsule, delegate to PER/ER, (optionally) heartbeat; execution is permissionless once conditions are satisfied. |

---

## Problem

1. **Digital asset succession:** Crypto is bearer-asset: whoever holds the keys controls the funds. If you disappear or become incapacitated, heirs often cannot access assets, and keys in wills or with lawyers are a security and privacy risk.
2. **Transparent conditions:** Putting “if I don’t log in for X days, send Y to Z” on a public chain exposes beneficiaries and timing to everyone.
3. **Trust in executors:** Relying on a person or institution to execute your wishes adds counterparty risk and delay; you want **programmatic, automatic** execution when conditions are met.

---

## Solution

Heres combines:

1. **Persistent capsules on Solana** – Capsule account holds owner, vault (locked SOL), inactivity period, and intent data; delegation state is on-chain.
2. **Private execution logic** – Conditions (inactivity, beneficiaries) are evaluated inside Magicblock **ER** or **PER (TEE)**; only the fact that conditions were satisfied and execution occurred is visible on-chain.
3. **Automatic execution** – When the inactivity period is satisfied, **anyone** can call `execute_intent`; no owner signature is required. A crank/bot can watch and submit the transaction; execution fees are taken from the transferred amount.

Result: **Intent remains private, execution is deterministic and automatic.**

---

## Key Features

- **Zero trust executor** – No third party holds your keys; the capsule program and vault enforce transfers when conditions are met.
- **Compliant privacy** – Conditions and beneficiaries stay inside PER (TEE) / ER; only execution results are committed to Devnet.
- **Permissionless execution** – After the inactivity period, any crank or user can trigger `execute_intent`; the program handles distribution and platform revenue.
- **PER (TEE) by default** – Delegation defaults to the TEE validator so monitoring is confidential.
- **Business model** – One-time creation fee and a percentage of the amount transferred at execution.
- **Token & NFT intents** – Support for SOL splits to multiple beneficiaries and for NFT assignment intents (with SOL/USD trend as reference where applicable).

---

## How It Works

1. **Create** – You define intent (e.g. total SOL, beneficiaries, inactivity period in days). SOL is locked in the capsule vault; creation fee is paid to the platform.
2. **Delegate** – You delegate the capsule PDA to Magicblock ER or PER (TEE). Private runtime starts monitoring (e.g. last activity vs inactivity threshold).
3. **Heartbeat (optional)** – You can call `update_activity` to refresh “last activity” and postpone execution.
4. **Execution** – When `last_activity + inactivity_period` has passed, **the crank runs automatically** (or anyone can submit `execute_intent`). The program checks time condition on-chain, deducts execution fee, and distributes SOL from the vault to beneficiaries. For NFT intents, logic can be extended similarly.
5. **Post-execution** – Capsule can be deactivated or recreated via `recreate_capsule` for a new intent.

### Automatic execution (no one needs to visit)

When conditions are met, execution and distribution happen **without the creator or beneficiaries visiting the app**. Two options:

#### 1. MagicBlock Crank (recommended — on-chain, no external cron)

When you **delegate** the capsule to PER (TEE) from the capsule detail page, the system performs **two separate transactions**:

**Step 1: Delegation** – The capsule PDA is delegated to the Ephemeral Rollup (ER) delegation program on Solana Devnet. This transaction is sent to Solana Devnet and transfers ownership of the capsule account to the MagicBlock delegation program.

**Step 2: Crank Scheduling** – After successful delegation, a **separate transaction is sent to the ER** (via TEE RPC) to schedule automatic execution using MagicBlock's [ScheduleTask](https://docs.magicblock.app/pages/tools/crank/introduction). The crank runs `execute_intent` at intervals (e.g. every 15 min) **on the Ephemeral Rollup**. When `last_activity + inactivity_period` is satisfied, execution happens automatically — **no off-chain cron or user visit required**.

- **Flow:** Create capsule → **[Step 1]** Delegate to PER (TEE) on Devnet → **[Step 2]** Schedule crank on ER via TEE RPC → MagicBlock runs the crank on the rollup.
- **Docs:** [MagicBlock Crank — Introduction](https://docs.magicblock.app/pages/tools/crank/introduction), [Implementation](https://docs.magicblock.app/pages/tools/crank/implementation), [crank-counter example](https://github.com/magicblock-labs/magicblock-engine-examples/tree/main/crank-counter).
- **Code:** `lib/solana.ts` (`scheduleExecuteIntentViaTee`), `lib/tee.ts` (`getTeeConnection`), `app/capsules/[address]/page.tsx` (after delegate, schedule crank).

#### 2. Off-chain cron (fallback)

For capsules that were **not** delegated, or as a fallback, you can use the API so a cron job calls `execute_intent` for eligible capsules on the Solana base layer.

- **Endpoint:** `GET` or `POST` `/api/cron/execute-intent`. Optional: send `Authorization: Bearer <CRON_SECRET>` if `CRON_SECRET` is set.
- **No Vercel Cron required (Vercel Cron is a paid feature).** Use a **free external cron** to hit your deployed API every 15 minutes, for example:
  - [cron-job.org](https://cron-job.org): create a job, URL `https://heres.vercel.app/api/cron/execute-intent`, method GET or POST, schedule `*/15 * * * *` (every 15 min). If you set `CRON_SECRET`, add header `Authorization: Bearer <your-secret>`.
  - [Uptime Robot](https://uptimerobot.com): monitor or HTTP check to the same URL every 15 minutes.
- **Env:** Set `CRANK_WALLET_PRIVATE_KEY` to the crank wallet’s secret key (base58, base64, or JSON array of 64 bytes). This wallet pays the transaction fee for each `execute_intent`; it does not need to hold SOL beyond fees. Optionally set `CRON_SECRET` to protect the endpoint.

Code: `lib/crank.ts` (eligible capsules, execute), `app/api/cron/execute-intent/route.ts` (HTTP handler).

### How we use Solana, Magicblock, and Helius

| Partner | How we use it | Code & links |
|--------|----------------|---------------|
| **Solana** | We run the **Heres program** on Solana Devnet: capsule accounts (owner, vault, inactivity period, intent data), PDAs for vault and fee config, and all instructions (`create_capsule`, `execute_intent`, `delegate_capsule`, etc.) are executed on-chain. The frontend uses the Solana connection (via Helius RPC) and Anchor to build and sign transactions. | **Contract:** [heres_program/src/lib.rs](https://github.com/Joseph-hackathon/Project-x/blob/main/heres_program/programs/heres_program/src/lib.rs) · **Program on Devnet:** [Explorer](https://explorer.solana.com/address/BiAB1qZpx8kDgS5dJxKFdCJDNMagCn8xfj4afNhRZWms?cluster=devnet) · **App:** [config/solana.ts](https://github.com/Joseph-hackathon/Project-x/blob/main/config/solana.ts), [lib/program.ts](https://github.com/Joseph-hackathon/Project-x/blob/main/lib/program.ts), [lib/solana.ts](https://github.com/Joseph-hackathon/Project-x/blob/main/lib/solana.ts) |
| **Magicblock** | We use **Ephemeral Rollups (ER)** and **Private Ephemeral Rollup (PER / TEE)** for private condition monitoring. The capsule PDA is delegated to Magicblock via `delegate_capsule` (default validator: TEE). The private runtime checks inactivity and beneficiaries; only execution results are committed to Devnet via Magic Actions. TEE auth uses `getAuthToken` and optional `verifyTeeRpcIntegrity` from the Magicblock SDK. | **Contract (delegate):** [heres_program/src/lib.rs](https://github.com/Joseph-hackathon/Project-x/blob/main/heres_program/programs/heres_program/src/lib.rs) · **App:** [lib/solana.ts](https://github.com/Joseph-hackathon/Project-x/blob/main/lib/solana.ts) (`delegateCapsule`, `undelegateCapsule`), [lib/tee.ts](https://github.com/Joseph-hackathon/Project-x/blob/main/lib/tee.ts) (TEE auth), [constants/index.ts](https://github.com/Joseph-hackathon/Project-x/blob/main/constants/index.ts) (`MAGICBLOCK_ER`, `PER_TEE`) |
| **Helius** | We use Helius for **RPC** (primary Solana connection with fallback to public RPC), **Enhanced Transactions API** for the dashboard (parsed capsule create/execute events and history), and **DAS API** for NFT listing when creating NFT capsules. | **Config:** [config/solana.ts](https://github.com/Joseph-hackathon/Project-x/blob/main/config/solana.ts) (`getSolanaConnection`), [constants/index.ts](https://github.com/Joseph-hackathon/Project-x/blob/main/constants/index.ts) (`HELIUS_CONFIG`) · **App:** [lib/helius.ts](https://github.com/Joseph-hackathon/Project-x/blob/main/lib/helius.ts) (`getEnhancedTransactions`, `getNftsByOwner`) |

- **Contract (Devnet):** Program ID `BiAB1qZpx8kDgS5dJxKFdCJDNMagCn8xfj4afNhRZWms` → [View on Solana Explorer (Devnet)](https://explorer.solana.com/address/BiAB1qZpx8kDgS5dJxKFdCJDNMagCn8xfj4afNhRZWms?cluster=devnet).

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Solana Devnet                          │
│  Heres Program (Persistent)                              │
│  · Capsule: owner, vault (locked SOL), inactivity_period │
│  · intent_data (beneficiaries, amounts); delegation      │
└─────────────────────────▲───────────────────────────────┘
                          │ Magic Actions (execute_intent result)
┌─────────────────────────┴───────────────────────────────┐
│           Magicblock ER / PER (TEE)                      │
│  · Private condition checks (inactivity, beneficiaries)   │
│  · Crank / bot monitors; triggers execution on Devnet    │
└─────────────────────────▲───────────────────────────────┘
                          │ delegate_capsule / heartbeat
┌─────────────────────────┴───────────────────────────────┐
│                 User Wallet (Devnet)                     │
│  Create capsule, delegate to PER/ER, update_activity       │
└─────────────────────────────────────────────────────────┘
```

- **On-chain:** Capsule state, vault; execution is a normal program call once conditions are met.
- **Off-chain (private):** Magicblock ER/PER runs the monitoring logic; only “conditions met → execute” is reflected on-chain via Magic Actions.

---

## User Flow

```
Landing (/)
  → Create Capsule (/create)
      · Connect wallet
      · Choose Token (SOL) or NFT intent
      · Set beneficiaries, amounts, inactivity period (and optional delay)
      · Sign create_capsule → SOL locked in vault, creation fee paid
  → Dashboard (/dashboard)
      · View capsules and recent events (Helius enhanced tx)
      · Open capsule detail
  → Capsule Detail (/capsules/[address])
      · View status (Active / Expired / Executed)
      · Delegate to PER (TEE) for private monitoring
      · SOL price chart (CoinGecko), intent summary
      · Link to Solana Explorer (Capsule ID)
  → When inactive long enough
      · Anyone (e.g. crank) calls execute_intent
      · SOL transferred to beneficiaries; execution fee to platform
```

---

## Tech Stack

- **Frontend:** Next.js 14, React, TypeScript, Tailwind CSS, GSAP
- **Blockchain:** Solana Devnet
- **Smart contract:** Anchor (Rust), deployed
- **Wallet:** Solana Wallet Adapter (Phantom, Backpack, etc.)
- **RPC:** Helius API
- **Private execution:** Magicblock Ephemeral Rollups (ER/PER); TEE auth via `@magicblock-labs/ephemeral-rollups-sdk` (getAuthToken, getTeeConnection)

---

## Project Structure

```
Heres_solana/
├── app/                 # Next.js app (landing, create, capsules, dashboard)
├── components/          # Navbar, Footer, AsciiCapsule, CapsuleMediaBlock
├── config/              # Solana connection (getSolanaConnection, getProgramId)
├── constants/           # Program ID, Magicblock ER/PER, storage keys
├── lib/                 # solana.ts, helius.ts, program.ts, tee.ts
├── heres_program/       # Anchor program (Rust) – source only
├── idl/                 # heres_program.json
├── types/               # IntentCapsule, Beneficiary, WalletActivity
└── utils/               # intent encoding, validation
```

---

## Getting Started

1. **Clone and install**
   ```bash
   cd Heres_solana
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

---

## Deployed Program (Devnet)

| Item | Value |
|------|--------|
| **Cluster** | https://api.devnet.solana.com |
| **Program Id** | `BiAB1qZpx8kDgS5dJxKFdCJDNMagCn8xfj4afNhRZWms` |

Set `NEXT_PUBLIC_PROGRAM_ID` in `.env.local` to this program id.

---

## Automatic Execution (No Owner Signature)

SOL is locked in the capsule **vault PDA** at creation. Once the inactivity period is satisfied, **anyone** may call `execute_intent`; **owner signature is not required**. A crank or bot can submit the transaction; the caller pays only tx fees.

---

## Business Model

- **Creation:** A one-time fee is charged when a capsule is created.
- **Execution:** A percentage of the amount transferred at execution is taken as platform revenue.

---

## Solana Program (Anchor) – Instruction Reference

| Instruction | Description |
|-------------|-------------|
| **create_capsule** | Create capsule (owner, inactivity period, intent data); pays creation fee; locks SOL in vault. |
| **update_intent** | Update intent data (owner only). |
| **execute_intent** | Execute when inactivity period is met; pays execution fee; distributes from vault. |
| **update_activity** | Refresh last activity timestamp (heartbeat). |
| **deactivate_capsule** | Deactivate capsule (owner only). |
| **delegate_capsule** | Delegate capsule PDA to Magicblock ER/PER (default: TEE validator). |
| **undelegate_capsule** | Commit and undelegate from ER. |
| **schedule_execute_intent** | Schedule crank (Magicblock ScheduleTask). |
| **recreate_capsule** | Create a new capsule after one has been executed. |

---

## Magicblock ER / PER (Devnet)

- **Delegation program:** `DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh`
- **Router:** `https://devnet-router.magicblock.app`
- **TEE (PER):** Validator `FnE6VJT5QNZdedZPnCoLsARgBwoE6DeJNjBs2H1gySXA`; TEE RPC/docs in `constants/index.ts` (`MAGICBLOCK_ER`, `PER_TEE`).

---

## License

MIT.
