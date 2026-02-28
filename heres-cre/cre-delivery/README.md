# Heres CRE Delivery Workflow

This workflow receives Heres CRE dispatch payloads over HTTP and posts delivery status to Heres callback API.

## What it does

1. Trigger: HTTP payload from Heres (`/api/cre/dispatch` sends to CRE webhook URL)
2. Validate required fields (`idempotencyKey`, `capsuleAddress`, `executedAt`, etc.)
3. Post callback to Heres (`/api/cre/callback`) with:
   - `status: delivered` (or `failed` if `forceFailure=true`)
   - `idempotencyKey`, `capsuleAddress`, `executedAt`, `providerMessageId`

## Config files

- `config.staging.json`
- `config.production.json`

Important keys:

- `callbackUrl`: Heres callback endpoint
- `callbackAuthHeader`: Optional static Authorization header
- `providerMessagePrefix`: Prefix for generated `providerMessageId`
- `forceFailure`: Toggle to simulate failure

## Local simulation

From project root (`/Users/yong/snorlax/Heres/heres-cre`):

```bash
bun install --cwd ./cre-delivery
cre workflow simulate cre-delivery \
  --non-interactive \
  --trigger-index 0 \
  --http-payload @/Users/yong/snorlax/Heres/heres-cre/cre-delivery/test-dispatch.json \
  --target staging-settings
```

## Heres app env mapping

Set in `/Users/yong/snorlax/Heres/.env.local`:

- `CHAINLINK_CRE_WEBHOOK_URL=<deployed_cre_http_endpoint>`
- `CHAINLINK_CRE_SIGNING_SECRET=<optional dispatch signing secret>`
- `CHAINLINK_CRE_CALLBACK_SECRET=` (leave empty unless workflow is signing callback body)

If `CHAINLINK_CRE_CALLBACK_SECRET` is set in Heres app, callback API will reject unsigned callbacks with `Invalid callback signature`.
