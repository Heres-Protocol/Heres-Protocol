import 'server-only'

import { Redis } from '@upstash/redis'
import { CreDeliveryLedgerRecord, CreSecretRecord } from '@/lib/cre/types'

// Redis keys
const SECRET_PREFIX = 'cre:secret:'       // cre:secret:{secretRef} → CreSecretRecord
const SECRET_INDEX = 'cre:secret-refs'    // SET of all secretRefs
const DELIVERY_PREFIX = 'cre:delivery:'   // cre:delivery:{idempotencyKey} → CreDeliveryLedgerRecord
const DELIVERY_INDEX = 'cre:delivery-keys' // SET of all idempotencyKeys
const DELIVERY_BY_CAPSULE = 'cre:delivery-by-capsule:' // cre:delivery-by-capsule:{addr} → SET of idempotencyKeys

// ---------------------------------------------------------------------------
// Redis client
// ---------------------------------------------------------------------------
function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

// ---------------------------------------------------------------------------
// File-based fallback for local dev
// ---------------------------------------------------------------------------
function getLocalPath(): string {
  const path = require('path')
  return path.join(process.cwd(), '.data', 'cre-store.json')
}

type LocalState = {
  secrets: CreSecretRecord[]
  deliveries: CreDeliveryLedgerRecord[]
}

function loadLocal(): LocalState {
  try {
    const fs = require('fs')
    const p = getLocalPath()
    if (!fs.existsSync(p)) return { secrets: [], deliveries: [] }
    return JSON.parse(fs.readFileSync(p, 'utf8')) as LocalState
  } catch {
    return { secrets: [], deliveries: [] }
  }
}

function saveLocal(state: LocalState) {
  try {
    const fs = require('fs')
    const path = require('path')
    const p = getLocalPath()
    const dir = path.dirname(p)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    const tmp = `${p}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2))
    fs.renameSync(tmp, p)
  } catch (err) {
    console.warn('[CRE store] local save failed:', err)
  }
}

// ---------------------------------------------------------------------------
// Secrets
// ---------------------------------------------------------------------------

export async function upsertCreSecret(secret: CreSecretRecord): Promise<CreSecretRecord> {
  const redis = getRedis()
  if (!redis) {
    const state = loadLocal()
    const idx = state.secrets.findIndex(s => s.secretRef === secret.secretRef)
    if (idx >= 0) state.secrets[idx] = secret
    else state.secrets.push(secret)
    saveLocal(state)
    return secret
  }
  await redis.set(`${SECRET_PREFIX}${secret.secretRef}`, JSON.stringify(secret))
  await redis.sadd(SECRET_INDEX, secret.secretRef)
  return secret
}

export async function getCreSecret(secretRef: string): Promise<CreSecretRecord | null> {
  const redis = getRedis()
  if (!redis) {
    const state = loadLocal()
    return state.secrets.find(s => s.secretRef === secretRef) ?? null
  }
  const raw = await redis.get<string>(`${SECRET_PREFIX}${secretRef}`)
  if (!raw) return null
  return typeof raw === 'string' ? JSON.parse(raw) as CreSecretRecord : raw as unknown as CreSecretRecord
}

export async function listCreSecrets(): Promise<CreSecretRecord[]> {
  const redis = getRedis()
  if (!redis) {
    return loadLocal().secrets
  }
  const refs = await redis.smembers(SECRET_INDEX)
  if (!refs.length) return []
  const pipeline = redis.pipeline()
  for (const ref of refs) pipeline.get(`${SECRET_PREFIX}${ref}`)
  const results = await pipeline.exec()
  return results
    .filter((r): r is string | CreSecretRecord => r != null)
    .map(r => typeof r === 'string' ? JSON.parse(r) as CreSecretRecord : r as CreSecretRecord)
}

// ---------------------------------------------------------------------------
// Delivery Ledger
// ---------------------------------------------------------------------------

function coalesceNonEmpty(nextValue: string | undefined, existingValue: string | undefined): string {
  if (typeof nextValue === 'string' && nextValue.trim().length > 0) return nextValue
  return existingValue ?? ''
}

export async function upsertDeliveryLedger(
  idempotencyKey: string,
  patch: Partial<CreDeliveryLedgerRecord> & {
    capsuleAddress: string
    owner?: string
    executedAt: number
    recipientEmail?: string
    secretRef?: string
    status: CreDeliveryLedgerRecord['status']
  }
): Promise<CreDeliveryLedgerRecord> {
  const now = Date.now()
  const existing = await getDeliveryLedger(idempotencyKey)
  const next: CreDeliveryLedgerRecord = {
    idempotencyKey,
    capsuleAddress: patch.capsuleAddress,
    owner: coalesceNonEmpty(patch.owner, existing?.owner),
    executedAt: patch.executedAt,
    recipientEmail: coalesceNonEmpty(patch.recipientEmail, existing?.recipientEmail),
    secretRef: coalesceNonEmpty(patch.secretRef, existing?.secretRef),
    status: patch.status,
    attempts: patch.attempts ?? existing?.attempts ?? 0,
    providerMessageId: patch.providerMessageId ?? existing?.providerMessageId,
    lastError: patch.lastError ?? existing?.lastError,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }

  const redis = getRedis()
  if (!redis) {
    const state = loadLocal()
    const idx = state.deliveries.findIndex(d => d.idempotencyKey === idempotencyKey)
    if (idx >= 0) state.deliveries[idx] = next
    else state.deliveries.push(next)
    saveLocal(state)
    return next
  }

  await redis.set(`${DELIVERY_PREFIX}${idempotencyKey}`, JSON.stringify(next))
  await redis.sadd(DELIVERY_INDEX, idempotencyKey)
  await redis.sadd(`${DELIVERY_BY_CAPSULE}${patch.capsuleAddress}`, idempotencyKey)
  return next
}

export async function getDeliveryLedger(idempotencyKey: string): Promise<CreDeliveryLedgerRecord | null> {
  const redis = getRedis()
  if (!redis) {
    const state = loadLocal()
    return state.deliveries.find(d => d.idempotencyKey === idempotencyKey) ?? null
  }
  const raw = await redis.get<string>(`${DELIVERY_PREFIX}${idempotencyKey}`)
  if (!raw) return null
  return typeof raw === 'string' ? JSON.parse(raw) as CreDeliveryLedgerRecord : raw as unknown as CreDeliveryLedgerRecord
}

export async function listDeliveryByCapsule(capsuleAddress: string): Promise<CreDeliveryLedgerRecord[]> {
  const redis = getRedis()
  if (!redis) {
    return loadLocal().deliveries
      .filter(d => d.capsuleAddress === capsuleAddress)
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }
  const keys = await redis.smembers(`${DELIVERY_BY_CAPSULE}${capsuleAddress}`)
  if (!keys.length) return []
  const pipeline = redis.pipeline()
  for (const key of keys) pipeline.get(`${DELIVERY_PREFIX}${key}`)
  const results = await pipeline.exec()
  return results
    .filter((r): r is string | CreDeliveryLedgerRecord => r != null)
    .map(r => typeof r === 'string' ? JSON.parse(r) as CreDeliveryLedgerRecord : r as CreDeliveryLedgerRecord)
    .sort((a, b) => b.updatedAt - a.updatedAt)
}
