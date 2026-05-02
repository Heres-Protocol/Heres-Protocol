# Production Readiness Plan

## Current Assessment

Heres is no longer in a hackathon-only shape, but it is still not ready to be treated as a dependable production service.

The largest blockers are not UI polish. They are operational:

- Network and asset configuration were partially hardcoded around `devnet`.
- Secret delivery state depends on local file storage by default.
- Automation exists, but there is limited runtime health visibility.
- There is no explicit production checklist for key management, failover, and incident response.

This pass fixes the first and third issues in code and defines the remaining work.

## Changes Completed In This Pass

- Generalized Solana network selection so the app, RPC selection, Helius endpoints, and explorer links derive from `NEXT_PUBLIC_SOLANA_NETWORK`.
- Added generic token mint env support via `NEXT_PUBLIC_BTC_MINT` and `NEXT_PUBLIC_ETH_MINT`, while preserving legacy `*_DEVNET_MINT` compatibility.
- Updated UI copy so production deployments do not still present themselves as permanently tied to devnet.
- Added `GET /api/health` for operational checks covering RPC, cron auth, crank wallet presence, CRE webhook presence, and CRE store mode.

## Gaps That Still Block Real Production

### P0: Custody and execution safety

- `CRANK_WALLET_PRIVATE_KEY` is process-env based.
  This is acceptable for prototyping, but for production it should come from a managed secret store with rotation and access audit.
- Automation execution currently depends on a single runtime path.
  You need an explicit runbook for Magicblock path failure, RPC degradation, and replay/idempotency handling.
- There is no staged release flow for contract upgrades and migration.
  Mainnet deployment needs versioned program rollout, rollback criteria, and upgrade authority policy.

### P0: Durable server-side state

- CRE secret registry and delivery ledger still default to `.data/cre-store.json`.
  That is not durable enough for multi-instance or serverless production.
- Production target should be:
  - Redis/Postgres-backed secret metadata and delivery ledger.
  - Encrypted payload material kept in a dedicated secret system or isolated encrypted store.
  - Backup and restore procedures tested.

### P0: Monitoring and incident response

- `GET /api/health` now exists, but you still need external monitoring.
- Required next step:
  - Alert on `status=fail`.
  - Alert on repeated CRE delivery failures.
  - Alert on crank backlog growth and RPC failure rate.
  - Record structured logs for every execution and delivery attempt.

### P1: Security hardening

- Review all cron and dispatch routes for consistent auth, replay protection, and rate limiting.
- Add signature verification or source allowlisting for internal automation callers where possible.
- Audit encrypted payload lifecycle:
  - client-side encryption assumptions
  - secret hash verification
  - callback authenticity
  - payload retention/deletion policy

### P1: Data and support operations

- There is no explicit user-facing audit trail model for “created / delegated / executed / delivered / failed”.
- There is no support/admin workflow documented for stuck deliveries or partial execution outcomes.
- Define operator procedures for:
  - failed CRE delivery retries
  - beneficiary disputes
  - invalid recipient email correction
  - vault execution verification

### P1: Product and legal readiness

- This product touches inheritance and delivery of sensitive credentials.
- Before broad release, define:
  - jurisdiction scope
  - terms and disclosures
  - what is and is not guaranteed
  - recovery limitations
  - privacy retention policy

## Recommended Execution Order

1. Move environment from implicit devnet assumptions to explicit environment profiles:
   - `development`
   - `staging`
   - `production`
2. Replace file-backed CRE state with shared durable storage.
3. Add structured logging and external uptime/error monitoring.
4. Define key management and automation failover runbooks.
5. Run a staging dress rehearsal with:
   - real RPC failover
   - crank failure simulation
   - CRE callback failure simulation
   - replay/idempotency validation
6. Only then treat mainnet as launch-candidate infrastructure.

## Concrete Next Engineering Tasks

- Introduce a Redis/Postgres implementation for `lib/cre/store.ts`.
- Add structured log fields for capsule address, owner, execution timestamp, idempotency key, and provider message ID.
- Add rate limiting to cron-like endpoints.
- Add a staging config matrix and deployment checklist.
- Add smoke tests that hit `/api/health` and execute an end-to-end capsule flow against staging.

## Launch Standard

Heres should be considered “production-ready” only when:

- network selection is explicit and environment-scoped
- automation is authenticated and observable
- CRE state is durable across instances
- failure handling is documented and tested
- mainnet rollout can be performed and rolled back deliberately
