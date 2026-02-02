# Lucid - Privacy-Preserving Capsule Protocol on Solana

> **People disappear. Intent should not.**

Lucid is a **privacy-preserving capsule protocol on Solana Devnet**, where assets remain delegated, conditions stay private inside **Magicblock Ephemeral Rollup (ER)**, and execution happens automatically when silence becomes truth.

## What is Lucid?

Lucid solves a critical problem: **what happens to your digital assets and intentions when you can no longer manage them?** Instead of trusted third parties or legal documents, Lucid uses:

- **Persistent Capsule accounts on Solana Devnet** – Capsule state lives on-chain
- **Private execution logic inside Magicblock ER** – Conditions (offline, timer, beneficiaries) are checked privately in the Ephemeral Rollup
- **Automated execution via Magic Actions** – When conditions are met, a crank runs a Magic Action that executes on Devnet (e.g. SOL transfer to beneficiaries)

### Key Points

- **Capsule on Devnet**: Capsule metadata, owner, beneficiaries, and delegation state are stored on Solana Devnet.
- **Delegation to ER**: Capsule PDA can be delegated to Magicblock ER for private monitoring.
- **No ZK proofs required**: Privacy and execution are achieved via Magicblock ER + Magic Actions (no Noir ZK in this version).
- **Automatic execution**: When inactivity period is met, execution is triggered (owner signs for SOL transfer; future: crank + Magic Action).

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
- **Smart contract**: Anchor (Rust)
- **Wallet**: Solana Wallet Adapter (Phantom, Backpack, etc.)
- **RPC**: Helius API
- **Private execution**: Magicblock Ephemeral Rollups (delegation + Magic Action flow)

## Project Structure

```
Lucid_solana/
├── app/                 # Next.js app (landing, create, capsules, dashboard)
├── components/          # Navbar, Footer
├── config/              # Solana connection (getSolanaConnection, getProgramId)
├── constants/           # Program ID, Magicblock ER, storage keys
├── lib/                 # solana.ts, helius.ts, program.ts
├── lucid_program/       # Anchor program (Rust)
├── idl/                 # lucid_program.json
├── types/               # IntentCapsule, Beneficiary, WalletActivity
├── utils/               # intent encoding, validation
└── deploy-full.sh       # Single script: install Rust/Solana/Anchor + build + deploy (Linux/WSL)
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

## Solana Program (Anchor)

- **create_capsule** – Create capsule on Devnet (owner, inactivity period, intent data).
- **update_intent** – Update intent data (owner only).
- **execute_intent** – Execute when inactivity period is met (owner signs; no ZK proof).
- **update_activity** – Refresh last activity timestamp (heartbeat).
- **deactivate_capsule** – Deactivate capsule (owner only).
- **delegate_capsule** – Delegate capsule PDA to Magicblock ER (optional validator).
- **undelegate_capsule** – Commit and undelegate capsule from ER back to base layer.
- **schedule_execute_intent** – Schedule crank to run execute_intent at intervals (Magicblock ScheduleTask).
- **sample_price** – Read Pyth Lazer / ephemeral oracle price feed (build with `--features oracle`).
- **recreate_capsule** – Create a new capsule after one has been executed.

### Deployment (Devnet) – 현재 배포 상태

| 항목 | 값 |
|------|-----|
| **Cluster** | https://api.devnet.solana.com |
| **Program Id** | `BiAB1qZpx8kDgS5dJxKFdCJDNMagCn8xfj4afNhRZWms` |
| **IDL account** | `4We1GF8ooak6nVm2AWoo2rYf6uYr2dBs9ijaPD2Bm52c` |
| **Deploy tx** | `3FujWQjdq7WXqu5ehdxwaszhw7xdr2EjKsYj7w6btmFFDzqcsxdzqrZhqF3eAB6oYuZ5AXgQin3SHNU4bEUxZAhX` |

프론트엔드에서 동일 Program Id를 쓰려면 `.env.local`에 `NEXT_PUBLIC_PROGRAM_ID=BiAB1qZpx8kDgS5dJxKFdCJDNMagCn8xfj4afNhRZWms` 로 설정.  
배포 후 빌드된 IDL을 쓰려면 WSL에서 `cp lucid_program/target/idl/lucid_program.json idl/` 로 복사.

### Build & Deploy (optional)

**단일 스크립트**: 프로젝트 루트의 `deploy-full.sh`가 Rust/Solana/Anchor 설치부터 빌드·배포·IDL 복사까지 한 번에 수행합니다. (Linux/WSL에서 실행.)

Solana/Anchor 빌드는 **Windows에서는 Solana CLI(`build-sbf`)가 없어 실패**할 수 있습니다. **WSL(Ubuntu)** 에서 진행하는 것을 권장합니다.

---

### WSL에서 빌드·배포하는 법

WSL(Ubuntu) 터미널에서 아래 순서대로 진행하면 됩니다.

#### 방법 A: 한 번에 (권장)

1. **WSL 터미널 열기** (Windows 경로는 `/mnt/c/...` 로 접근)
2. **프로젝트 루트로 이동**
   ```bash
   cd /mnt/c/Users/PC_1M/Desktop/Lucid\ Magicblock/Lucid_solana
   ```
3. **전체 배포 스크립트 실행** (Rust / Solana CLI / Anchor 없으면 설치 후 빌드·배포·IDL 복사까지 수행)
   ```bash
   chmod +x deploy-full.sh
   ./deploy-full.sh
   ```
   - 키페어 없으면 새로 만들기/시드 복구 선택
   - Devnet SOL 부족하면 airdrop 요청
   - 끝나면 `idl/lucid_program.json` 이 갱신되고, `NEXT_PUBLIC_PROGRAM_ID` 안내가 나옴

#### 방법 B: 수동 (이미 도구 설치된 경우)

1. **프로그램 디렉터리로 이동**
   ```bash
   cd /mnt/c/Users/PC_1M/Desktop/Lucid\ Magicblock/Lucid_solana/lucid_program
   ```

2. **도구 확인** (없으면 아래 “필요 도구 설치” 참고)
   ```bash
   rustc --version
   solana --version
   anchor --version
   ```

3. **Devnet 설정 및 SOL**
   ```bash
   solana config set --url devnet
   solana airdrop 2
   ```

4. **빌드**
   ```bash
   anchor build
   ```
   - **`constant_time_eq` / edition2024 에러** 나오면: README 아래 “`edition2024` / Cargo 1.84 에러” 참고.  
     `lucid_program/Cargo.toml` 에 패치가 있으므로, 캐시 정리 후 다시 시도:
     ```bash
     rm -f Cargo.lock
     rm -rf ~/.cargo/registry/src/index.crates.io-*/constant_time_eq-0.4.2
     anchor build
     ```

5. **배포**
   ```bash
   anchor deploy
   ```
   - 온체인 IDL 업로드가 **DeclaredProgramIdMismatch** 로 실패하면 프로그램만 배포:
     ```bash
     anchor deploy --skip-idl
     ```

6. **IDL을 프론트엔드로 복사**
   ```bash
   cp target/idl/lucid_program.json ../idl/
   ```

7. **프론트엔드 `.env.local` 에 Program ID 반영**
   - 배포 시 출력된 Program ID 또는 `solana address -k target/deploy/lucid_program-keypair.json` 값으로  
     `NEXT_PUBLIC_PROGRAM_ID=...` 설정.

#### 필요 도구 설치 (WSL Ubuntu, 한 번만)

```bash
# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"

# Solana CLI (2.x)
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Anchor (0.32.x)
cargo install --git https://github.com/coral-xyz/anchor avm --locked
avm install 0.32.1
avm use 0.32.1
```

매 터미널마다 Solana/Anchor 경로가 필요하면 `~/.bashrc` 또는 `~/.zshrc` 에 추가:
```bash
export PATH="$HOME/.cargo/bin:$HOME/.local/share/solana/install/active_release/bin:$PATH"
```

#### 오라클 기능 포함 빌드 (선택)

Pyth Lazer 가격 피드(`sample_price`)를 쓰려면:
```bash
anchor build -- --features oracle
```

---

#### Windows에서 바로 빌드하려면

- [Solana CLI 설치](https://docs.anza.xyz/cli/install) 후 `anchor build` 실행.
- 또는 WSL에서 위 순서대로 진행.

**`constant_time_eq` / `blake3` / `edition2024` / Cargo 1.84 에러**

- **증상**: `failed to download constant_time_eq v0.4.2` 또는 `failed to parse manifest .../blake3-1.8.3/Cargo.toml` · `feature 'edition2024' is required ... not stabilized in this version of Cargo (1.84.0)`.
- **원인**: `anchor build`는 Solana/Anchor 툴체인의 Cargo 1.84를 사용합니다. 전이 의존성 `constant_time_eq v0.4.2`와 `blake3 v1.8.3`이 edition 2024를 요구하거나, 캐시에 해당 버전 참조가 깨진 상태로 남아 있을 수 있습니다.
- **해결 (패치 적용됨)**: 워크스페이스 루트 `lucid_program/Cargo.toml`에 `[patch.crates-io]`로 **constant_time_eq**는 git 0.3.1, **blake3**는 git tag 1.8.2(edition2021)로 대체해 두었습니다. 아래 순서대로 **캐시·락 제거 후** 빌드하면 됩니다.

  **WSL에서:**
  ```bash
  cd /mnt/c/Users/PC_1M/Desktop/Lucid\ Magicblock/Lucid_solana/lucid_program

  # 1) 락/캐시 제거 (0.4.2 참조 제거)
  rm -f Cargo.lock
  rm -rf ~/.cargo/registry/src/index.crates.io-*/constant_time_eq-0.4.2
  rm -rf ~/.cargo/registry/cache/index.crates.io-*/constant_time_eq*
  rm -rf ~/.cargo/registry/src/index.crates.io-*/blake3-1.8.3
  rm -rf ~/.cargo/registry/cache/index.crates.io-*/blake3*

  # 2) 빌드 (패치로 constant_time_eq 0.3.1, blake3 1.8.2 사용)
  anchor build
  ```

  캐시 경로가 다르면 `~/.cargo/registry/src/` 아래에서 `constant_time_eq`, `blake3` 관련 디렉터리를 모두 지운 뒤 다시 `anchor build` 하면 됩니다.
- **대안**: Solana/Anchor 툴체인이 Cargo 1.85+를 쓰는 버전으로 올라가면, 해당 패치를 제거해도 됩니다.

## Magicblock anchor-counter 예제와의 비교

공식 예제 [magicblock-engine-examples/anchor-counter](https://github.com/magicblock-labs/magicblock-engine-examples/tree/main/anchor-counter) README 기준으로 정리했습니다.

| 항목 | anchor-counter (예제) | Lucid (본 프로젝트) |
|------|------------------------|---------------------|
| **Rust SDK** | `cargo add ephemeral-rollups-sdk` | `ephemeral-rollups-sdk = { version = "0.8", features = ["anchor"] }` (동일) |
| **Delegation 방식** | `#[delegate]` on **program**, 수동 `delegate_account(..., pda_seeds, 0, 30000)` CPI | `#[delegate]` on **Accounts struct** + `ctx.accounts.delegate_pda(seeds, DelegateConfig)` (SDK Anchor 헬퍼 사용) |
| **Delegation 후 트랜잭션** | `@magicblock-labs/ephemeral-rollups-sdk`로 **ER provider** 사용, `providerEphemeralRollup.sendAndConfirm(tx)` 로 저지연 실행 | 현재는 **일반 RPC**(Devnet)로 `program.methods.executeIntent().rpc()` 사용. ER 저지연 실행을 쓰려면 프론트에 ER SDK 추가 후 ER provider로 전송하는 경로를 넣을 수 있음 |
| **Undelegate** | 클라이언트에서 `createUndelegateInstruction` 호출 | **구현됨**: `undelegate_capsule` + `lib/solana.ts`의 `undelegateCapsule()` (commit & undelegate from ER) |
| **Crank** | `schedule_increment`로 Magicblock ScheduleTask CPI | **구현됨**: `schedule_execute_intent` + `scheduleExecuteIntent()` (task_id, execution_interval_millis, iterations). 실행 시점에는 owner 서명 필요 |
| **Oracle** | - | **구현됨**: `sample_price` + Pyth Lazer 가격 피드 소비 (빌드 시 `--features oracle` 사용 시 `pyth-solana-receiver-sdk` 연동) |

- **공통**: 계정을 delegation 프로그램에 위임한 뒤, ER에서 저지연으로 트랜잭션 실행 가능.
- **Lucid 차이**: 캡슐은 “의도 실행”(inactivity 기간 만료 후 SOL 전송) 용도이며, `delegate_capsule`로 캡슐 PDA를 ER에 위임해 조건을 ER에서 비공개로 검사하고, 실행은 Devnet에서 `execute_intent`로 수행합니다.

## Magicblock ER (Devnet)

- **Delegation program**: `DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh`
- **Router (devnet)**: `https://devnet-router.magicblock.app`
- **Validators (examples)**: Asia, EU, US, TEE – see [Magicblock quickstart](https://docs.magicblock.gg/pages/ephemeral-rollups-ers/how-to-guide/quickstart).

Constants are in `constants/index.ts` (`MAGICBLOCK_ER`).

### Crank (ScheduleTask)

- **문서**: [Magicblock Cranks](https://docs.magicblock.gg/pages/tools/crank/introduction)
- **예제**: [magicblock-engine-examples/crank-counter](https://github.com/magicblock-labs/magicblock-engine-examples/tree/main/crank-counter)
- **Lucid**: `schedule_execute_intent(task_id, execution_interval_millis, iterations)`로 `execute_intent` 크랭크 등록. 실제 실행 시에는 owner가 서명해야 하므로, 크랭크는 “주기적 실행 시도” 용도로 사용.

### Oracle (Pyth Lazer)

- **문서/예제**: [real-time-pricing-oracle](https://github.com/magicblock-labs/real-time-pricing-oracle)
- **Lucid**: `sample_price(price_update_account)`로 Pyth Lazer 가격 피드 읽기. 프로그램 빌드 시 `cargo build --features oracle` 또는 `anchor build -- --features oracle` 사용. Devnet SOL/USD 피드 주소 등은 real-time-pricing-oracle README 참고.

## One-Line Summary (Devnet)

**Lucid is a privacy-preserving capsule protocol on Solana Devnet: assets stay delegated, conditions stay private inside Magicblock ER, and execution happens automatically when silence becomes truth.**

## License

MIT.
