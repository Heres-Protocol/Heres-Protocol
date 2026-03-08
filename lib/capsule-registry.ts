/**
 * Capsule owner registry backed by Upstash Redis.
 * Tracks wallet addresses that have created capsules so the crank can
 * look up their PDAs without getProgramAccounts (which hangs on devnet).
 *
 * Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars.
 * Falls back to file-based storage in local dev if env vars are missing.
 */
import { Redis } from '@upstash/redis'

const REDIS_KEY = 'capsule-owners'

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

// ---------------------------------------------------------------------------
// File-based fallback for local dev (no Redis configured)
// ---------------------------------------------------------------------------
function loadLocal(): string[] {
  try {
    const fs = require('fs')
    const path = require('path')
    const p = path.join(process.cwd(), '.data', 'capsule-registry.json')
    if (!fs.existsSync(p)) return []
    return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch {
    return []
  }
}

function saveLocal(owners: string[]) {
  try {
    const fs = require('fs')
    const path = require('path')
    const dir = path.join(process.cwd(), '.data')
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    const p = path.join(dir, 'capsule-registry.json')
    const tmp = `${p}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(owners))
    fs.renameSync(tmp, p)
  } catch (err) {
    console.warn('[capsule-registry] local save failed:', err)
  }
}

// ---------------------------------------------------------------------------
// Public API (async — callers must await)
// ---------------------------------------------------------------------------

/** Register a capsule owner (idempotent) */
export async function registerCapsuleOwner(ownerPubkey: string): Promise<void> {
  const redis = getRedis()
  if (!redis) {
    const owners = loadLocal()
    if (!owners.includes(ownerPubkey)) {
      owners.push(ownerPubkey)
      saveLocal(owners)
      console.log(`[capsule-registry] Registered owner (local): ${ownerPubkey}`)
    }
    return
  }
  const added = await redis.sadd(REDIS_KEY, ownerPubkey)
  if (added) console.log(`[capsule-registry] Registered owner: ${ownerPubkey}`)
}

/** Get all registered capsule owners */
export async function getRegisteredOwners(): Promise<string[]> {
  const redis = getRedis()
  if (!redis) return loadLocal()
  return await redis.smembers(REDIS_KEY)
}

/** Remove a capsule owner (after capsule is fully distributed) */
export async function unregisterCapsuleOwner(ownerPubkey: string): Promise<void> {
  const redis = getRedis()
  if (!redis) {
    const owners = loadLocal().filter(o => o !== ownerPubkey)
    saveLocal(owners)
    return
  }
  await redis.srem(REDIS_KEY, ownerPubkey)
}
