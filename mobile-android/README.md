# Heres Mobile (Android Native MVP)

This module is the Seeker hackathon native Android app scaffold.

## Scope
- Activity auto-measurement (on-chain signals)
- Create/My Capsules/Detail/Extend-ready API wiring
- Notify + one-tap extend flow scaffold

## Current status
- UI: Jetpack Compose MVP screens are in place (Create tab + Monitor tab).
- API integration: wired to Next.js endpoints under `/api/mobile/*`.
- Unsigned tx flow:
  - Build unsigned `create_capsule` tx from app
  - Build unsigned `update_activity` tx from app
  - UI shows tx preview (`base64`) and capsule address
- Wallet signing/send:
  - Solana Mobile Wallet Adapter client is wired in `wallet/WalletSigner.kt`
  - Create/Update screens now have `Sign & Send` actions

## Run
1. Open `mobile-android` in Android Studio Iguana+.
2. Set `API_BASE_URL` in `app/build.gradle.kts` to your deployed Heres host.
3. Build and run on Android 8.0+ device.

## Required next integration
- Verify MWA behavior on physical Seeker device with installed wallet
- Final UX polishing and error handling around wallet rejection/cancel
- dApp Store assets and submission checklist
