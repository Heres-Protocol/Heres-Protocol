/**
 * Simple file-based capsule owner registry for crank.
 * Tracks wallet addresses that have created capsules so the crank can
 * look up their PDAs without getProgramAccounts (which hangs on devnet).
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from 'fs'
import path from 'path'

const REGISTRY_PATH = process.env.NODE_ENV === 'production'
  ? '/tmp/capsule-registry.json'
  : path.join(process.cwd(), '.data', 'capsule-registry.json')

function load(): string[] {
  try {
    if (!existsSync(REGISTRY_PATH)) return []
    return JSON.parse(readFileSync(REGISTRY_PATH, 'utf8'))
  } catch {
    return []
  }
}

function save(owners: string[]) {
  try {
    const dir = path.dirname(REGISTRY_PATH)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    const tmp = `${REGISTRY_PATH}.tmp`
    writeFileSync(tmp, JSON.stringify(owners))
    renameSync(tmp, REGISTRY_PATH)
  } catch (err) {
    console.warn('[capsule-registry] save failed:', err)
  }
}

/** Register a capsule owner (idempotent) */
export function registerCapsuleOwner(ownerPubkey: string) {
  const owners = load()
  if (!owners.includes(ownerPubkey)) {
    owners.push(ownerPubkey)
    save(owners)
    console.log(`[capsule-registry] Registered owner: ${ownerPubkey}`)
  }
}

/** Get all registered capsule owners */
export function getRegisteredOwners(): string[] {
  return load()
}

/** Remove a capsule owner (after capsule is fully distributed) */
export function unregisterCapsuleOwner(ownerPubkey: string) {
  const owners = load().filter(o => o !== ownerPubkey)
  save(owners)
}
