# Heres CRE Integration Notes

Last updated: 2026-02-28

## Overview

This document summarizes the CRE integration work completed today for Heres.
The previous `premium` naming was migrated to `cre` across app code, APIs, services, and tests.

## What Was Implemented Today

1. Naming migration (`premium` -> `cre`)
- `lib/premium/*` -> `lib/cre/*`
- `utils/premiumAuth.ts` -> `utils/creAuth.ts`
- `utils/premiumCrypto.ts` -> `utils/creCrypto.ts`
- `tests/premium-auth.test.mts` -> `tests/cre-auth.test.mts`
- `/api/cron/reconcile-premium-delivery` -> `/api/cron/reconcile-cre-delivery`

2. Required CRE delivery flow on create
- Intent Statement delivery is no longer optional.
- Representative email + access code are required in the create flow.
- Client stores CRE metadata in intent payload under `cre`.
- Backward compatibility is kept by also reading legacy `premium` data for old capsules.

3. API/auth consistency updates
- Signed message helpers renamed to CRE terms.
- Header renamed to `x-cre-signature` for delivery status and callback validation.
- Env keys renamed:
  - `PREMIUM_DISPATCH_SECRET` -> `CRE_DISPATCH_SECRET`
  - `PREMIUM_STORE_PATH` -> `CRE_STORE_PATH`

4. CRE workflow package rename
- `heres-cre/premium-delivery` -> `heres-cre/cre-delivery`
- Workflow names updated:
  - `cre-delivery-staging`
  - `cre-delivery-production`

## Current CRE Flow

1. User creates capsule with Intent Statement, representative email, and access code.
2. Intent Statement is encrypted in-browser.
3. App calls `POST /api/intent-delivery/register` with owner signature.
4. Server stores secret payload and returns `secretRef/secretHash/recipientEmailHash`.
5. Capsule stores CRE metadata on-chain (`cre`, with legacy read support for `premium`).
6. On execution, reconcile triggers CRE dispatch.
7. CRE callback updates ledger status (`delivered` / `failed`).
8. Owner can check status from capsule detail via signed status request.

## Main Endpoints

- `POST /api/intent-delivery/register`
- `GET /api/intent-delivery/status`
- `POST /api/cre/dispatch`
- `POST /api/cre/callback`
- `GET|POST /api/cron/reconcile-cre-delivery`

## Required Environment Variables

- `CHAINLINK_CRE_WEBHOOK_URL`
- `CHAINLINK_CRE_SIGNING_SECRET`
- `CHAINLINK_CRE_CALLBACK_SECRET`
- `CRE_DISPATCH_SECRET` (or `CRON_SECRET` fallback in dispatch route)
- `CRE_STORE_PATH` (optional; defaults to `.data/cre-store.json`)

## Verification Log (Today)

### Static verification
- `npm run test` passed
  - lint: passed
  - typecheck: passed
  - `test:cre`: 3 passed, 0 failed

### Runtime E2E (local)
- Executed local API flow with dev server:
  - register -> mock CRE dispatch -> callback
- Observed results:
  - `register_ok` with generated `secretRef`
  - `mock_ok status=delivered`
  - ledger file entry status: `delivered`
- Additional endpoint checks:
  - `/api/cre/dispatch` without auth -> `401`
  - `/api/cre/dispatch` invalid capsule -> `400`
  - `/api/cron/reconcile-cre-delivery` with auth -> `200`

## Notes

- Legacy `premium` payload reading is intentionally retained for backward compatibility.
- New code paths should use only `cre` naming.
