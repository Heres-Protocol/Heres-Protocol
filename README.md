# Lucid - Privacy-Preserving Capsule Protocol on Solana

> **People disappear. Intent should not.**

Lucid is a **privacy-preserving capsule protocol on Solana Devnet**, where assets remain delegated, conditions stay private inside **Magicblock Ephemeral Rollup (ER)** or **Private Ephemeral Rollup (PER / TEE)**, and execution happens automatically when silence becomes truth.

## What is Lucid?

Lucid solves a critical problem: **what happens to your digital assets and intentions when you can no longer manage them?** Instead of trusted third parties or legal documents, Lucid uses:

- **Persistent Capsule accounts on Solana Devnet** – Capsule state lives on-chain
- **Private execution logic inside Magicblock ER** – Conditions (offline, timer, beneficiaries) are checked privately in the Ephemeral Rollup
- **Automated execution via Magic Actions** – When conditions are met, execution runs on Devnet (e.g. SOL transfer to beneficiaries)

### Key Points

- **Capsule on Devnet**: Capsule metadata, owner, beneficiaries, and delegation state are stored on Solana Devnet.
- **Delegation to ER/PER**: Capsule PDA can be delegated to Magicblock ER or PER (TEE validator by default) for private monitoring.
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
- **Private execution**: Magicblock Ephemeral Rollups (ER/PER); TEE auth via `@magicblock-labs/ephemeral-rollups-sdk` (getAuthToken, getTeeConnection)

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

## WSL에서 컨트랙트 수동 배포

WSL에서 Solana/Anchor 툴체인이 설치된 상태에서 아래 순서대로 실행하면 됩니다.

1. **빌드**
   ```bash
   cd Lucid_solana/lucid_program
   anchor build
   ```

2. **클러스터·지갑 확인**
   ```bash
   solana config get
   solana address
   solana balance
   ```
   Devnet 사용 시: `solana config set --url devnet`. 배포용 지갑에 DEV SOL이 있어야 합니다.

3. **배포 (둘 중 하나만 실행)**
   - **최초 배포**: Devnet에 이 프로그램이 아직 없을 때
     ```bash
     anchor deploy --provider.cluster devnet
     ```
   - **업그레이드**: 이미 같은 Program Id(`BiAB1qZpx8kDgS5dJxKFdCJDNMagCn8xfj4afNhRZWms`)로 배포된 적이 있을 때 (코드 수정 후 다시 올릴 때)
     ```bash
     anchor upgrade target/deploy/lucid_program.so --program-id BiAB1qZpx8kDgS5dJxKFdCJDNMagCn8xfj4afNhRZWms --provider.cluster devnet
     ```

4. **IDL을 Next.js 앱으로 복사**
   ```bash
   cp lucid_program/target/idl/lucid_program.json Lucid_solana/idl/
   ```
   (WSL 기준: 프로젝트 루트가 `Lucid_solana`라면 `cp target/idl/lucid_program.json ../idl/`)

5. **수수료 설정 1회 (배포/업그레이드 후)**  
   **앱에서:** 지갑 연결 → 대시보드(`/dashboard`) 이동 → 상단 "수수료 설정 (배포 후 1회)" 카드에서 **Initialize Fee Config** 버튼 클릭. (Fee config가 이미 있으면 "초기화됨"으로 표시됨.)  
   **직접 호출:** authority 지갑으로 `initFeeConfig(수수료_수령_지갑, 50_000_000, 300)` 호출 또는 CLI로 해당 instruction 전송.  
   (50_000_000 lamports = 0.05 SOL, 300 bps = 3%)

이후 프론트엔드 `.env.local`의 `NEXT_PUBLIC_PROGRAM_ID`가 위 Program Id와 같으면 됩니다.

---

## Deployed Program (Devnet)

| 항목 | 값 |
|------|-----|
| **Cluster** | https://api.devnet.solana.com |
| **Program Id** | `BiAB1qZpx8kDgS5dJxKFdCJDNMagCn8xfj4afNhRZWms` |

프론트엔드는 위 Program Id를 `.env.local`의 `NEXT_PUBLIC_PROGRAM_ID`로 사용합니다.

## 자동 실행 (서명 불필요)

캡슐 생성 시 **SOL이 vault PDA에 락업**됩니다. 비활성 기간이 만족되면 **아무나** `execute_intent`를 호출할 수 있으며, **owner 서명이 필요 없습니다**. 크랭크·봇·플랫폼이 조건을 확인한 뒤 트랜잭션만 보내면 실행됩니다. (호출자가 트랜잭션 수수료만 부담.)

## Platform fees (하이브리드 수수료)

- **생성 수수료**: 캡슐 생성 시 **0.05 SOL**을 플랫폼 지갑으로 징수.
- **실행 수수료**: 실행 시 전송 금액의 **3%**를 플랫폼으로 징수.

**수수료 수령 지갑**: `Covn3moA8qstPgXPgueRGMSmi94yXvuDCWTjQVBxHpzb` (기본값, `constants/index.ts`).

**배포 후 1회**: authority 지갑으로 `init_fee_config(수수료_수령_지갑, 50_000_000, 300)` 호출  
(50_000_000 lamports = 0.05 SOL, 300 bps = 3%).  
이후 `update_fee_config(creation_fee_lamports, execution_fee_bps)`로 authority만 수수료 변경 가능.

`.env.local`에서 `NEXT_PUBLIC_PLATFORM_FEE_RECIPIENT`로 다른 지갑을 지정할 수 있음.  
상수: `constants/index.ts` (`PLATFORM_FEE`, `SOLANA_CONFIG.PLATFORM_FEE_RECIPIENT`).

## Solana Program (Anchor) – Instruction Reference

- **init_fee_config** – 수수료 설정 초기화 (배포 후 1회, authority만).
- **update_fee_config** – 수수료 변경 (authority만).
- **create_capsule** – Create capsule (owner, inactivity period, intent data). 생성 수수료 징수.
- **update_intent** – Update intent data (owner only).
- **execute_intent** – Execute when inactivity period is met. 실행 수수료 징수.
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
