import { isValidSolanaAddress } from '@/config/solana'

export type MobileActivityScoreResponse = {
  wallet: string
  lastActivityAt: number | null
  txCount24h: number
  tokenEvents24h: number
  score: number
  recommendedAction: 'extend' | 'monitor'
}

export type MobileCapsuleStatus = 'active' | 'expired' | 'executed' | 'inactive'

export type MobileCapsuleListItem = {
  capsuleAddress: string
  owner: string
  status: MobileCapsuleStatus
  inactivitySeconds: number
  lastActivityAt: number
  executedAt: number | null
  nextInactivityDeadline: number
}

function toMs(timestamp: unknown): number | null {
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp) || timestamp <= 0) return null
  return timestamp > 1_000_000_000_000 ? timestamp : timestamp * 1000
}

function countTokenEvents(tx: any): number {
  if (!tx || typeof tx !== 'object') return 0

  let count = 0
  if (Array.isArray(tx.tokenTransfers)) count += tx.tokenTransfers.length

  const events = (tx as { events?: any }).events
  if (events && typeof events === 'object') {
    for (const key of ['swap', 'nft', 'transfer', 'compressed']) {
      const value = events[key]
      if (Array.isArray(value)) count += value.length
      else if (value && typeof value === 'object') count += 1
    }
  }

  return count
}

export function buildActivityScore(wallet: string, txs: any[]): MobileActivityScoreResponse {
  const now = Date.now()
  const cutoff = now - 24 * 60 * 60 * 1000

  const normalized = Array.isArray(txs) ? txs : []
  const tx24h = normalized.filter((tx) => {
    const ts =
      toMs(tx?.timestamp) ??
      toMs(tx?.blockTime) ??
      toMs(tx?.tx?.blockTime)
    return ts !== null && ts >= cutoff
  })

  const tokenEvents24h = tx24h.reduce((sum, tx) => sum + countTokenEvents(tx), 0)

  const txScore = Math.min(60, tx24h.length * 12)
  const tokenScore = Math.min(40, tokenEvents24h * 5)
  const score = Math.max(0, Math.min(100, txScore + tokenScore))

  const latestMs = normalized.reduce<number | null>((acc, tx) => {
    const ts =
      toMs(tx?.timestamp) ??
      toMs(tx?.blockTime) ??
      toMs(tx?.tx?.blockTime)
    if (ts === null) return acc
    if (acc === null) return ts
    return ts > acc ? ts : acc
  }, null)

  return {
    wallet,
    lastActivityAt: latestMs,
    txCount24h: tx24h.length,
    tokenEvents24h,
    score,
    recommendedAction: score >= 60 ? 'extend' : 'monitor',
  }
}

export function computeCapsuleStatus(input: {
  isActive: boolean
  lastActivity: number
  inactivityPeriod: number
  executedAt: number | null
}): MobileCapsuleStatus {
  if (input.executedAt && input.executedAt > 0) return 'executed'
  if (!input.isActive) return 'inactive'

  const nowSec = Math.floor(Date.now() / 1000)
  const deadline = input.lastActivity + input.inactivityPeriod
  return deadline <= nowSec ? 'expired' : 'active'
}

export function validateWalletQuery(wallet: string | null): { ok: boolean; error?: string } {
  if (!wallet) return { ok: false, error: 'Missing wallet query parameter' }
  if (!isValidSolanaAddress(wallet)) return { ok: false, error: 'Invalid wallet address' }
  return { ok: true }
}
