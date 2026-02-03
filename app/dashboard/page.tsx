'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Database,
  RefreshCw,
  Settings,
  Signal,
  Sparkles,
  User,
} from 'lucide-react'
import { PublicKey } from '@solana/web3.js'
import { useWallet } from '@solana/wallet-adapter-react'
import { getProgramId, getSolanaConnection } from '@/config/solana'
import { SOLANA_CONFIG, PLATFORM_FEE } from '@/constants'
import { getEnhancedTransactions } from '@/lib/helius'
import { initFeeConfig } from '@/lib/solana'
import { getFeeConfigPDA } from '@/lib/program'

type CapsuleEvent = {
  signature: string
  blockTime: number | null
  status: 'success' | 'failed'
  label: string
  logs: string[]
  capsuleAddress: string
  owner: string | null
  tokenDelta: string | null
  solDelta: number | null
  proofBytes: number | null
}

type CapsuleRow = {
  id: string
  kind: 'capsule' | 'event'
  capsuleAddress: string
  owner: string | null
  status: string
  inactivitySeconds: number | null
  lastActivityMs: number | null
  executedAtMs: number | null
  payloadSize: number | null
  signature: string | null
  isActive: boolean | null
  events: CapsuleEvent[]
  tokenDelta: string | null
  solDelta: number | null
  proofBytes: number | null
}

const formatNumber = (value: number) => value.toLocaleString('en-US')

const formatDuration = (seconds: number | null) => {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return '—'
  const days = seconds / (60 * 60 * 24)
  if (days < 1) return `${Math.max(1, Math.round(seconds / 3600))}h`
  if (days < 30) return `${Math.round(days)}d`
  return `${Math.round(days / 30)}mo`
}

const formatDateTime = (timestampMs: number | null) => {
  if (!timestampMs) return '—'
  return new Date(timestampMs).toLocaleString()
}

const timeAgo = (timestampMs: number | null) => {
  if (!timestampMs) return '—'
  const diff = Math.max(0, Date.now() - timestampMs)
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

const maskAddress = (address: string) =>
  address.length > 10 ? `${address.slice(0, 4)}...${address.slice(-4)}` : address

const copyToClipboard = (text: string) => {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text)
  }
}

function CopyButton({ value, className }: { value: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => copyToClipboard(value)}
      className={`inline-flex shrink-0 items-center justify-center rounded p-1 text-lucid-muted transition-colors hover:bg-lucid-surface/80 hover:text-lucid-accent ${className ?? ''}`}
      title="Copy"
      aria-label="Copy to clipboard"
    >
      <Copy className="h-4 w-4" />
    </button>
  )
}

const detectInstruction = (logs?: string[] | null) => {
  if (!logs || logs.length === 0) return 'system'
  const text = logs.join(' ')
  if (/create_capsule|CreateCapsule/i.test(text)) return 'create_capsule'
  if (/execute_intent|ExecuteIntent/i.test(text)) return 'execute_intent'
  if (/update_intent|UpdateIntent/i.test(text)) return 'update_intent'
  if (/update_activity|UpdateActivity/i.test(text)) return 'update_activity'
  if (/deactivate_capsule|DeactivateCapsule/i.test(text)) return 'deactivate_capsule'
  if (/recreate_capsule|RecreateCapsule/i.test(text)) return 'recreate_capsule'
  return 'system'
}

const instructionLabel = (instruction: string) => {
  switch (instruction) {
    case 'create_capsule':
      return 'Capsule Created'
    case 'execute_intent':
      return 'Capsule Executed'
    case 'update_intent':
      return 'Intent Updated'
    case 'update_activity':
      return 'Activity Updated'
    case 'deactivate_capsule':
      return 'Capsule Deactivated'
    case 'recreate_capsule':
      return 'Capsule Recreated'
    default:
      return 'System Update'
  }
}

const statusTone = (status: string, kind: CapsuleRow['kind']) => {
  const normalized = status.toLowerCase()
  if (kind === 'event') {
    if (normalized.includes('executed')) return 'bg-lucid-accent/20 text-lucid-accent'
    if (normalized.includes('created')) return 'bg-lucid-accent/20 text-lucid-accent'
    if (normalized.includes('updated')) return 'bg-lucid-purple/20 text-lucid-purple'
    if (normalized.includes('deactivated')) return 'bg-red-500/20 text-red-400'
    return 'bg-lucid-surface text-lucid-muted'
  }
  if (normalized.includes('active')) return 'bg-lucid-accent/20 text-lucid-accent'
  if (normalized.includes('expired')) return 'bg-red-500/20 text-red-400'
  if (normalized.includes('executed')) return 'bg-lucid-accent/20 text-lucid-accent'
  return 'bg-lucid-surface text-lucid-muted'
}

const statusFromInstruction = (instruction: string) => {
  switch (instruction) {
    case 'create_capsule':
    case 'recreate_capsule':
      return 'Created'
    case 'execute_intent':
      return 'Executed'
    case 'update_intent':
      return 'Updated'
    case 'update_activity':
      return 'Activity'
    case 'deactivate_capsule':
      return 'Deactivated'
    default:
      return 'System'
  }
}

const decodeCapsuleAccount = (data: Uint8Array) => {
  if (!data || data.length < 60) return null

  const readI64 = (bytes: Uint8Array, start: number): bigint => {
    let result = 0n
    for (let i = 0; i < 8; i += 1) {
      result |= BigInt(bytes[start + i]) << BigInt(i * 8)
    }
    if (result & (1n << 63n)) {
      result = result - (1n << 64n)
    }
    return result
  }

  const readU32 = (bytes: Uint8Array, start: number): number => {
    return bytes[start] | (bytes[start + 1] << 8) | (bytes[start + 2] << 16) | (bytes[start + 3] << 24)
  }

  let offset = 8
  const ownerBytes = data.slice(offset, offset + 32)
  const owner = new PublicKey(ownerBytes)
  offset += 32
  const inactivityPeriod = Number(readI64(data, offset))
  offset += 8
  const lastActivity = Number(readI64(data, offset))
  offset += 8
  const intentDataLength = readU32(data, offset)
  offset += 4
  const intentDataBytes = data.slice(offset, offset + intentDataLength)
  offset += intentDataLength
  const isActive = data[offset] === 1
  offset += 1
  const hasExecutedAt = data[offset] === 1
  offset += 1
  let executedAt: number | null = null
  if (hasExecutedAt) {
    executedAt = Number(readI64(data, offset))
  }

  return {
    owner,
    inactivityPeriod,
    lastActivity,
    intentData: new Uint8Array(intentDataBytes),
    isActive,
    executedAt,
  }
}

const fetchAllSignatures = async (
  connection: ReturnType<typeof getSolanaConnection>,
  address: PublicKey,
  pageSize = 100,
  maxPages = 200
) => {
  let all: Awaited<ReturnType<typeof connection.getSignaturesForAddress>> = []
  let before: string | undefined
  let page = 0

  while (page < maxPages) {
    const batch = await connection.getSignaturesForAddress(address, {
      limit: pageSize,
      ...(before ? { before } : {}),
    })

    all = all.concat(batch)
    if (batch.length < pageSize) break
    before = batch[batch.length - 1]?.signature
    if (!before) break
    page += 1
  }

  return all
}

const getSignatureFromTx = (tx: any) =>
  tx?.signature ||
  tx?.transactionSignature ||
  tx?.transaction?.signatures?.[0] ||
  tx?.signatures?.[0] ||
  tx?.tx?.signature ||
  ''

const getBlockTimeFromTx = (tx: any) => {
  const timestamp = tx?.timestamp ?? tx?.blockTime ?? tx?.tx?.blockTime ?? tx?.transaction?.blockTime
  if (!timestamp) return null
  return typeof timestamp === 'number' ? timestamp : parseInt(String(timestamp), 10)
}

/** Fetch all enhanced transactions from Helius (paginated). */
const fetchAllEnhancedTransactions = async (address: string, pageSize = 100, maxPages = 120) => {
  let all: any[] = []
  let before: string | undefined
  for (let page = 0; page < maxPages; page += 1) {
    const batch = await getEnhancedTransactions(address, pageSize, before)
    all = all.concat(batch)
    if (batch.length < pageSize) break
    const lastSig = getSignatureFromTx(batch[batch.length - 1])
    if (!lastSig) break
    before = lastSig
  }
  return all
}

const toTxRecordFromRpc = (info: any, tx: any) => ({
  signature: info.signature,
  blockTime: info.blockTime ?? null,
  err: info.err ?? tx?.meta?.err ?? null,
  logs: tx?.meta?.logMessages || [],
  message: tx?.transaction?.message || null,
  meta: tx?.meta || null,
})

const toTxRecordFromEnhanced = (tx: any) => ({
  signature: getSignatureFromTx(tx),
  blockTime: getBlockTimeFromTx(tx),
  err: tx?.err ?? tx?.meta?.err ?? tx?.transactionError ?? null,
  logs: tx?.meta?.logMessages || tx?.logs || [],
  message: tx?.transaction?.message || tx?.tx?.message || tx?.message || null,
  meta: tx?.meta || null,
})

const getAccountKeysFromMessage = (message: any) => {
  if (!message) return []
  if (Array.isArray(message.accountKeys)) {
    return message.accountKeys.map((key: any) =>
      typeof key === 'string' ? key : key?.toBase58?.() || String(key)
    )
  }
  if (message.getAccountKeys) {
    const keys = message.getAccountKeys()
    const allKeys = [
      ...(keys.staticAccountKeys || []),
      ...(keys.accountKeysFromLookups?.writable || []),
      ...(keys.accountKeysFromLookups?.readonly || []),
    ]
    return allKeys.map((key: any) => (typeof key === 'string' ? key : key?.toBase58?.()))
  }
  return []
}

const getInstructionList = (message: any) => {
  if (!message) return []
  return message.instructions || message.compiledInstructions || []
}

const noticeSign = (value: number) => (value > 0 ? '+' : '')

const getTokenDeltaFromMeta = (meta: any) => {
  const pre = meta?.preTokenBalances || []
  const post = meta?.postTokenBalances || []
  const byMint = new Map<string, { pre: number; post: number }>()
  pre.forEach((balance: any) => {
    if (!balance?.mint) return
    const amount = Number(balance?.uiTokenAmount?.uiAmount || 0)
    byMint.set(balance.mint, { pre: amount, post: 0 })
  })
  post.forEach((balance: any) => {
    if (!balance?.mint) return
    const amount = Number(balance?.uiTokenAmount?.uiAmount || 0)
    const current = byMint.get(balance.mint) || { pre: 0, post: 0 }
    current.post = amount
    byMint.set(balance.mint, current)
  })
  const first = Array.from(byMint.entries()).find(([, value]) => value.pre !== value.post)
  if (!first) return null
  const [mint, value] = first
  const delta = value.post - value.pre
  return `${noticeSign(delta)}${delta.toFixed(4)} ${maskAddress(mint)}`
}

export default function DashboardPage() {
  const wallet = useWallet()
  const [capsules, setCapsules] = useState<CapsuleRow[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [filterMode, setFilterMode] = useState<'all' | 'created' | 'executed' | 'active' | 'expired'>('all')
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest')
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)
  const [zkProofHash, setZkProofHash] = useState<string | null>(null)
  const [zkPublicInputsHash, setZkPublicInputsHash] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [refreshKey, setRefreshKey] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [feeConfigExists, setFeeConfigExists] = useState<boolean | null>(null)
  const [initFeePending, setInitFeePending] = useState(false)
  const [initFeeTx, setInitFeeTx] = useState<string | null>(null)
  const [initFeeError, setInitFeeError] = useState<string | null>(null)
  const [summary, setSummary] = useState({
    total: 0,
    active: 0,
    executed: 0,
    expired: 0,
    proofs: 0,
    successRate: 0,
  })

  useEffect(() => {
    // Magicblock PER (TEE) context / commit (fallback to legacy zk keys)
    const erContextKey = 'er_context_global'
    const erCommitKey = 'er_commit_hash_global'
    const legacyProofKey = 'zk_proof_hash_global'
    const legacyInputsKey = 'zk_inputs_hash_global'
    setZkProofHash(localStorage.getItem(erContextKey) || localStorage.getItem(legacyProofKey))
    setZkPublicInputsHash(localStorage.getItem(erCommitKey) || localStorage.getItem(legacyInputsKey))
  }, [])

  // Check if fee_config PDA exists (배포 후 1회 초기화 여부)
  useEffect(() => {
    let cancelled = false
    const check = async () => {
      try {
        const connection = getSolanaConnection()
        const [feeConfigPDA] = getFeeConfigPDA()
        const account = await connection.getAccountInfo(feeConfigPDA)
        if (!cancelled) setFeeConfigExists(account != null)
      } catch {
        if (!cancelled) setFeeConfigExists(null)
      }
    }
    check()
    return () => { cancelled = true }
  }, [refreshKey])

  const handleInitFeeConfig = useCallback(async () => {
    if (!wallet.publicKey || !SOLANA_CONFIG.PLATFORM_FEE_RECIPIENT) return
    setInitFeePending(true)
    setInitFeeError(null)
    setInitFeeTx(null)
    try {
      const recipient = new PublicKey(SOLANA_CONFIG.PLATFORM_FEE_RECIPIENT)
      const tx = await initFeeConfig(wallet, recipient, PLATFORM_FEE.CREATION_FEE_LAMPORTS, PLATFORM_FEE.EXECUTION_FEE_BPS)
      setInitFeeTx(tx)
      setFeeConfigExists(true)
    } catch (e: any) {
      const msg = e?.message || String(e)
      if (/already in use|AccountDidNotSerialize|0x0/i.test(msg)) {
        setInitFeeError('이미 초기화됨 (Fee config already initialized).')
        setFeeConfigExists(true)
      } else {
        setInitFeeError(msg)
      }
    } finally {
      setInitFeePending(false)
    }
  }, [wallet])

  useEffect(() => {
    let isMounted = true

    const loadDashboard = async () => {
      setIsRefreshing(true)
      try {
        const connection = getSolanaConnection()
        const programId = getProgramId()
        const accounts = await connection.getProgramAccounts(programId, {
          commitment: 'confirmed',
        })

        const decodedCapsules = accounts
          .map((account) => {
            const decoded = decodeCapsuleAccount(account.account.data)
            if (!decoded) return null
            return {
              capsuleAddress: account.pubkey.toBase58(),
              owner: decoded.owner.toBase58(),
              inactivityPeriod: decoded.inactivityPeriod,
              lastActivity: decoded.lastActivity,
              intentData: decoded.intentData,
              isActive: decoded.isActive,
              executedAt: decoded.executedAt,
            }
          })
          .filter(Boolean) as Array<{
          capsuleAddress: string
          owner: string
          inactivityPeriod: number
          lastActivity: number
          intentData: Uint8Array
          isActive: boolean
          executedAt: number | null
        }>

        const nowSeconds = Math.floor(Date.now() / 1000)

        // Collect signatures: RPC first, then add any extra from Helius (Helius does not return raw message/meta needed for parsing)
        let signatureInfos = await fetchAllSignatures(connection, programId)
        if (SOLANA_CONFIG.HELIUS_API_KEY) {
          const enhancedTransactions = await fetchAllEnhancedTransactions(programId.toBase58())
          const heliusSigs = new Set(signatureInfos.map((s) => s.signature))
          for (const tx of enhancedTransactions) {
            const sig = getSignatureFromTx(tx)
            if (sig && !heliusSigs.has(sig)) {
              heliusSigs.add(sig)
              signatureInfos.push({
                signature: sig,
                err: null,
                blockTime: getBlockTimeFromTx(tx) ?? undefined,
                memo: null,
                slot: (tx?.slot ?? tx?.transaction?.slot ?? 0) as number,
              })
            }
          }
        }

        const rpcTransactions = await Promise.all(
          signatureInfos.map(async (signatureInfo) => {
            try {
              const tx = await connection.getTransaction(signatureInfo.signature, {
                commitment: 'confirmed',
                maxSupportedTransactionVersion: 0,
              })
              return { info: signatureInfo, tx }
            } catch {
              return { info: signatureInfo, tx: null }
            }
          })
        )

        const combinedTxMap = new Map<string, ReturnType<typeof toTxRecordFromRpc>>()
        rpcTransactions
          .map(({ info, tx }) => toTxRecordFromRpc(info, tx))
          .forEach((record) => {
            combinedTxMap.set(record.signature, record)
          })

        const transactions = Array.from(combinedTxMap.values())
        const capsuleEvents = new Map<string, CapsuleEvent[]>()
        const eventRows: CapsuleRow[] = []

        let totalProofsSubmitted = 0
        let verifiedProofs = 0

        transactions.forEach((record) => {
          const logs = record.logs || []
          const instruction = detectInstruction(logs)
          if (instruction === 'execute_intent') {
            totalProofsSubmitted += 1
            if (!record.err) verifiedProofs += 1
          }

          const message = record.message
          if (!message) return
          const accountKeys = getAccountKeysFromMessage(message)
          const instructions = getInstructionList(message)
          const programIdStr = programId.toBase58()

          instructions.forEach((ix: any) => {
            const ixProgramId = ix.programId
              ? typeof ix.programId === 'string'
                ? ix.programId
                : ix.programId.toBase58()
              : accountKeys[ix.programIdIndex]
            if (ixProgramId !== programIdStr) return

            let accountIndexes: number[] = []
            if (Array.isArray(ix.accounts) && typeof ix.accounts[0] === 'number') {
              accountIndexes = ix.accounts
            } else if (Array.isArray(ix.accounts)) {
              accountIndexes = ix.accounts.map((key: any) => {
                const keyStr = typeof key === 'string' ? key : key?.toBase58?.()
                return accountKeys.findIndex((k: string) => k === keyStr)
              })
            }

            if (accountIndexes.length < 2) return
            const capsuleKey = accountKeys[accountIndexes[0]]
            const ownerKey = accountKeys[accountIndexes[1]] || null
            if (!capsuleKey) return

            let proofBytes: number | null = null
            if (instruction === 'execute_intent' && ix.data) {
              const dataLength = typeof ix.data === 'string' ? ix.data.length : ix.data?.length || 0
              proofBytes = dataLength || null
            }

            let solDelta: number | null = null
            if (record.meta?.preBalances && record.meta?.postBalances && ownerKey) {
              const ownerIndex = accountKeys.findIndex((key: string) => key === ownerKey)
              if (ownerIndex >= 0) {
                const pre = record.meta.preBalances[ownerIndex] || 0
                const post = record.meta.postBalances[ownerIndex] || 0
                solDelta = (post - pre) / 1_000_000_000
              }
            }

            const tokenDelta = getTokenDeltaFromMeta(record.meta)

            const event: CapsuleEvent = {
              signature: record.signature,
              blockTime: record.blockTime ?? null,
              status: record.err ? 'failed' : 'success',
              label: instructionLabel(instruction),
              logs,
              capsuleAddress: capsuleKey,
              owner: ownerKey,
              tokenDelta,
              solDelta,
              proofBytes,
            }

            const existing = capsuleEvents.get(capsuleKey) || []
            existing.push(event)
            capsuleEvents.set(capsuleKey, existing)

            if (['create_capsule', 'recreate_capsule', 'execute_intent'].includes(instruction)) {
              eventRows.push({
                id: `event:${record.signature}`,
                kind: 'event' as const,
                capsuleAddress: capsuleKey,
                owner: ownerKey,
                status: statusFromInstruction(instruction),
                inactivitySeconds: null,
                lastActivityMs: record.blockTime ? record.blockTime * 1000 : null,
                executedAtMs: instruction === 'execute_intent' && record.blockTime ? record.blockTime * 1000 : null,
                payloadSize: null,
                signature: record.signature,
                isActive: null,
                events: [event],
                tokenDelta,
                solDelta,
                proofBytes,
              } as CapsuleRow)
            }
          })
        })

        const capsuleRows: CapsuleRow[] = decodedCapsules
          .map((capsule) => {
            const executedAtMs = capsule.executedAt ? capsule.executedAt * 1000 : null
            const lastActivityMs = capsule.lastActivity * 1000
            const isExpired = capsule.executedAt === null && capsule.lastActivity + capsule.inactivityPeriod < nowSeconds
            const status = capsule.executedAt
              ? 'Executed'
              : isExpired
              ? 'Expired'
              : 'Active'
            const events = (capsuleEvents.get(capsule.capsuleAddress) || []).sort(
              (a, b) => (b.blockTime || 0) - (a.blockTime || 0)
            )
            const latestSignature = events[0]?.signature || null

            return {
              id: capsule.capsuleAddress,
              kind: 'capsule' as const,
              capsuleAddress: capsule.capsuleAddress,
              owner: capsule.owner,
              status,
              inactivitySeconds: capsule.inactivityPeriod,
              lastActivityMs,
              executedAtMs,
              payloadSize: capsule.intentData.length,
              signature: latestSignature,
              isActive: capsule.isActive,
              events,
              tokenDelta: null,
              solDelta: null,
              proofBytes: null,
            } as CapsuleRow
          })
          .filter((row) => {
            // Exclude waiting state: inactive, not executed, not expired (do not display)
            if (row.kind !== 'capsule') return true
            if (row.status === 'Active' && row.isActive === false) return false
            return true
          })

        const totalEventSignatures = eventRows.length
        const executedEventSignatures = eventRows.filter((row) => row.status === 'Executed').length

        const activeCapsules = capsuleRows.filter((capsule) => capsule.status === 'Active').length
        const executedCapsules = capsuleRows.filter((capsule) => capsule.status === 'Executed').length
        const expiredCapsules = capsuleRows.filter((capsule) => capsule.status === 'Expired').length
        const successRate =
          totalProofsSubmitted > 0 ? (verifiedProofs / totalProofsSubmitted) * 100 : 0

        const combinedRows: CapsuleRow[] = [...capsuleRows, ...eventRows].sort((a, b) => {
          const aTime = a.lastActivityMs ?? a.executedAtMs ?? 0
          const bTime = b.lastActivityMs ?? b.executedAtMs ?? 0
          return bTime - aTime
        })

        if (isMounted) {
          setCapsules(combinedRows)
          setSummary({
            total: totalEventSignatures,
            active: activeCapsules,
            executed: executedEventSignatures,
            expired: expiredCapsules,
            proofs: verifiedProofs,
            successRate,
          })
          setLastUpdated(Date.now())
          setError(null)
        }
      } catch (err) {
        if (isMounted) {
          setError('Unable to load on-chain capsule data. Please check RPC connectivity.')
        }
      } finally {
        if (isMounted) setIsRefreshing(false)
      }
    }

    loadDashboard()

    return () => {
      isMounted = false
    }
  }, [refreshKey])

  const filteredCapsules = useMemo(() => {
    const value = query.trim().toLowerCase()
    const scoped = capsules.filter((capsule) => {
      if (filterMode === 'created' && capsule.status !== 'Created') return false
      if (filterMode === 'executed' && capsule.status !== 'Executed') return false
      if (filterMode === 'active' && capsule.status !== 'Active') return false
      if (filterMode === 'expired' && capsule.status !== 'Expired') return false
      if (!value) return true
      return (
        capsule.capsuleAddress.toLowerCase().includes(value) ||
        capsule.owner?.toLowerCase().includes(value) ||
        capsule.signature?.toLowerCase().includes(value)
      )
    })
    const sorted = scoped.sort((a, b) => {
      const aTime = a.lastActivityMs || a.executedAtMs || 0
      const bTime = b.lastActivityMs || b.executedAtMs || 0
      return sortOrder === 'newest' ? bTime - aTime : aTime - bTime
    })
    return sorted
  }, [capsules, filterMode, query, sortOrder])

  useEffect(() => {
    setCurrentPage(1)
  }, [filterMode, query, sortOrder])

  const pageSize = 10
  const totalPages = Math.max(1, Math.ceil(filteredCapsules.length / pageSize))
  const pageStart = (currentPage - 1) * pageSize
  const pagedCapsules = filteredCapsules.slice(pageStart, pageStart + pageSize)

  const statCards = [
    { label: 'Total Capsules', value: formatNumber(summary.total), tone: 'text-lucid-accent' },
    { label: 'Active Capsules', value: formatNumber(summary.active), tone: 'text-lucid-accent' },
    { label: 'Executed Capsules', value: formatNumber(summary.executed), tone: 'text-lucid-purple' },
    { label: 'PER (TEE) Verified', value: formatNumber(summary.proofs), tone: 'text-lucid-accent' },
  ]

  const programIdStr = SOLANA_CONFIG.PROGRAM_ID
  const rpcLabel = SOLANA_CONFIG.HELIUS_API_KEY ? 'Helius Devnet' : 'Solana Devnet'

  return (
    <div className="min-h-screen bg-hero text-lucid-white">
      <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {error && (
            <div className="mb-6 rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Explorer-style: single header card (name + version + stats + Updated) */}
          <section className="card-lucid p-6 sm:p-8 mb-6">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-baseline gap-4">
                <h1 className="text-2xl font-bold text-lucid-white sm:text-3xl">
                  Heres Capsules
                </h1>
                <span className="rounded-lg border border-lucid-border bg-lucid-surface/80 px-2.5 py-1 text-xs font-medium text-lucid-muted">
                  v1.0
                </span>
                <span className="text-lucid-accent font-semibold">
                  {formatNumber(summary.total)} Capsules
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href="/capsules"
                  className="inline-flex items-center gap-2 rounded-lg border border-lucid-border bg-lucid-card/80 px-4 py-2 text-sm font-medium text-lucid-muted transition-colors hover:border-lucid-accent/40 hover:text-lucid-accent"
                >
                  <User className="h-4 w-4" />
                  My Capsule
                </Link>
                <button
                  type="button"
                  onClick={() => setRefreshKey((k) => k + 1)}
                  disabled={isRefreshing}
                  className="flex items-center gap-3 rounded-lg border border-lucid-border bg-lucid-card/80 px-4 py-2 text-sm text-lucid-muted transition-colors hover:border-lucid-accent/40 hover:text-lucid-accent disabled:opacity-70"
                >
                  <RefreshCw className={`h-4 w-4 shrink-0 ${isRefreshing ? 'animate-spin' : ''}`} />
                  {isRefreshing ? 'Syncing...' : lastUpdated ? `Updated ${timeAgo(lastUpdated)}` : 'Syncing'}
                </button>
              </div>
            </div>
            <p className="mt-3 text-sm text-lucid-muted max-w-xl">
              Track capsule status, PER (TEE) execution, and verification on Solana Devnet.
            </p>
          </section>

          {/* 수수료 설정 초기화: Fee config가 없을 때만 표시 (배포 후 1회만 필요) */}
          {wallet.connected && feeConfigExists === false && (
            <section className="card-lucid p-6 mb-6 border-lucid-accent/30">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-lucid-accent/10 border border-lucid-accent/40 flex items-center justify-center">
                    <Settings className="w-5 h-5 text-lucid-accent" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-lucid-white">수수료 설정 (배포 후 1회)</h2>
                    <p className="text-sm text-lucid-muted mt-0.5">
                      Fee config가 없으면 한 번만 실행하세요. 생성 0.05 SOL, 실행 3%.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleInitFeeConfig}
                  disabled={initFeePending}
                  className="rounded-lg border border-lucid-accent bg-lucid-accent/20 px-4 py-2 text-sm font-medium text-lucid-accent transition hover:bg-lucid-accent/30 disabled:opacity-60"
                >
                  {initFeePending ? '처리 중...' : 'Initialize Fee Config'}
                </button>
              </div>
              {initFeeTx && (
                <p className="mt-3 text-sm text-lucid-accent">
                  성공:{' '}
                  <a
                    href={`https://explorer.solana.com/tx/${initFeeTx}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    트랜잭션 보기
                  </a>
                </p>
              )}
              {initFeeError && (
                <p className="mt-3 text-sm text-amber-400">{initFeeError}</p>
              )}
            </section>
          )}

          {/* Explorer-style: metadata grid (Network, Program ID, Query URL) */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="rounded-xl border border-lucid-border bg-lucid-card/80 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-lucid-muted mb-1">Network</p>
              <p className="text-sm font-medium text-lucid-white truncate">
                {SOLANA_CONFIG.NETWORK ? `Solana ${SOLANA_CONFIG.NETWORK}` : 'Solana Devnet'}
              </p>
            </div>
            <div className="rounded-xl border border-lucid-border bg-lucid-card/80 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-lucid-muted mb-1">Program ID</p>
              <div className="flex items-center gap-1">
                <p className="text-sm font-mono text-lucid-white truncate min-w-0" title={programIdStr}>
                  {maskAddress(programIdStr)}
                </p>
                <CopyButton value={programIdStr} />
              </div>
            </div>
            <div className="rounded-xl border border-lucid-border bg-lucid-card/80 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-lucid-muted mb-1">RPC</p>
              <p className="text-sm font-medium text-lucid-white truncate">{rpcLabel}</p>
            </div>
            <div className="rounded-xl border border-lucid-border bg-lucid-card/80 p-4 sm:col-span-2 lg:col-span-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-lucid-muted mb-1">Index Status</p>
              <p className="text-sm font-medium text-lucid-accent">Live</p>
            </div>
          </section>

          {/* Stats row (Explorer "Signal" style) */}
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
            {statCards.map((card) => (
              <div
                key={card.label}
                className="card-lucid p-5 transition-all hover:border-lucid-accent/30"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-wider text-lucid-muted">{card.label}</p>
                  <Sparkles className="w-4 h-4 text-lucid-accent" />
                </div>
                <div className={`mt-3 text-2xl font-semibold ${card.tone}`}>{card.value}</div>
                <p className="mt-1 text-xs text-lucid-muted">Protocol health</p>
              </div>
            ))}
          </section>

          {/* Explorer-style: tab bar + content */}
          <section className="card-lucid overflow-hidden">
            {/* Tab bar - Explorer "Query | Curators" style */}
            <div className="border-b border-lucid-border">
              <div className="flex flex-wrap gap-0 overflow-x-auto">
                {[
                  { key: 'all', label: 'All' },
                  { key: 'created', label: 'Created' },
                  { key: 'executed', label: 'Executed' },
                  { key: 'active', label: 'Active' },
                  { key: 'expired', label: 'Expired' },
                ].map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setFilterMode(option.key as typeof filterMode)}
                    className={`min-w-[80px] px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                      filterMode === option.key
                        ? 'border-lucid-accent text-lucid-accent'
                        : 'border-transparent text-lucid-muted hover:text-lucid-white'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                <div className="flex items-center gap-2 text-sm text-lucid-muted">
                  <Database className="w-4 h-4 text-lucid-accent" />
                  {formatNumber(filteredCapsules.length)} records
                </div>
                <div className="flex items-center gap-2">
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search by address, owner, or signature"
                    className="w-full sm:w-72 rounded-lg border border-lucid-border bg-lucid-surface/80 px-3 py-2 text-sm text-lucid-white placeholder-lucid-muted focus:outline-none focus:border-lucid-accent/50 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
                    className="rounded-lg border border-lucid-border bg-lucid-surface/80 px-3 py-2 text-xs text-lucid-muted whitespace-nowrap transition hover:border-lucid-accent/40 hover:text-lucid-white"
                  >
                    {sortOrder === 'newest' ? 'Newest' : 'Oldest'}
                  </button>
                </div>
              </div>

            <div className="mt-6 space-y-3">
              {filteredCapsules.length === 0 && (
                <div className="rounded-xl border border-lucid-border bg-lucid-surface/50 px-4 py-8 text-center text-sm text-lucid-muted">
                  No capsules found. Try syncing again or adjust the search query.
                </div>
              )}

              {pagedCapsules.map((capsule) => (
                <div
                  key={capsule.id}
                  className={`rounded-xl border px-4 py-4 transition-colors ${
                    capsule.kind === 'event'
                      ? 'border-lucid-accent/30 bg-lucid-accent/5'
                      : 'border-lucid-border bg-lucid-card/50'
                  }`}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 text-sm text-lucid-muted">
                        <span className="rounded-lg border border-lucid-border bg-lucid-surface/80 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-lucid-muted">
                          {capsule.kind === 'event' ? 'Event' : 'Capsule'}
                        </span>
                        <span
                          className={`rounded-lg px-2 py-1 text-[11px] font-medium uppercase tracking-wider ${statusTone(
                            capsule.status,
                            capsule.kind
                          )}`}
                        >
                          {capsule.status}
                        </span>
                        <span className="font-mono text-lucid-muted break-all max-w-full min-w-0">
                          {capsule.signature ? maskAddress(capsule.signature) : '—'}
                        </span>
                        {capsule.signature && <CopyButton value={capsule.signature} />}
                      </div>
                      <div className="grid gap-2 text-xs text-lucid-muted md:grid-cols-3">
                        <div>
                          <p className="uppercase tracking-wider text-lucid-muted text-[10px] font-medium">Capsule</p>
                          <div className="flex items-center gap-1 min-w-0">
                            <p className="font-mono text-lucid-white break-all truncate">
                              {maskAddress(capsule.capsuleAddress)}
                            </p>
                            <CopyButton value={capsule.capsuleAddress} />
                          </div>
                        </div>
                        <div>
                          <p className="uppercase tracking-wider text-lucid-muted text-[10px] font-medium">Owner</p>
                          <div className="flex items-center gap-1 min-w-0">
                            <p className="font-mono text-lucid-white break-all truncate">
                              {capsule.owner ? maskAddress(capsule.owner) : '—'}
                            </p>
                            {capsule.owner && <CopyButton value={capsule.owner} />}
                          </div>
                        </div>
                        <div>
                          <p className="uppercase tracking-wider text-lucid-muted text-[10px] font-medium">
                            {capsule.kind === 'event' ? 'Created' : 'Inactivity'}
                          </p>
                          <p className="text-lucid-white">
                            {capsule.kind === 'event'
                              ? timeAgo(capsule.lastActivityMs)
                              : formatDuration(capsule.inactivitySeconds)}
                          </p>
                        </div>
                      </div>
                      {capsule.kind === 'event' && (capsule.tokenDelta != null || capsule.solDelta != null || capsule.proofBytes != null) && (
                        <div className="flex flex-wrap gap-3 text-[11px] text-lucid-muted">
                          {capsule.tokenDelta != null && (
                            <span className="font-mono">Token Δ: {capsule.tokenDelta}</span>
                          )}
                          {capsule.solDelta != null && (
                            <span className="font-mono">SOL Δ: {capsule.solDelta.toFixed(4)}</span>
                          )}
                          {capsule.proofBytes != null && (
                            <span>PER (TEE) tx: {capsule.proofBytes} bytes</span>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpandedId(expandedId === capsule.id ? null : capsule.id)}
                      className="inline-flex items-center gap-2 rounded-lg border border-lucid-border bg-lucid-surface/80 px-4 py-2 text-xs text-lucid-muted transition hover:border-lucid-accent/50 hover:text-lucid-accent"
                    >
                      Details
                      {expandedId === capsule.id ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {expandedId === capsule.id && (
                    <div className="mt-4 w-full min-w-0 rounded-xl border border-lucid-border bg-lucid-surface/80 px-4 py-4 text-xs text-lucid-muted space-y-4 overflow-hidden">
                      <div className="grid gap-3 md:grid-cols-2 max-w-full">
                        <div>
                          <p className="text-[10px] font-medium uppercase tracking-wider text-lucid-muted">Capsule</p>
                          <div className="flex items-center gap-1 min-w-0">
                            <p className="font-mono text-lucid-white break-all truncate">{capsule.capsuleAddress}</p>
                            <CopyButton value={capsule.capsuleAddress} />
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] font-medium uppercase tracking-wider text-lucid-muted">Owner</p>
                          <div className="flex items-center gap-1 min-w-0">
                            <p className="font-mono text-lucid-white break-all truncate">{capsule.owner || '—'}</p>
                            {capsule.owner && <CopyButton value={capsule.owner} />}
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] font-medium uppercase tracking-wider text-lucid-muted">Last Activity</p>
                          <p className="text-lucid-white">{formatDateTime(capsule.lastActivityMs)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-medium uppercase tracking-wider text-lucid-muted">Executed At</p>
                          <p className="text-lucid-white">{formatDateTime(capsule.executedAtMs)}</p>
                        </div>
                        {capsule.kind === 'capsule' ? (
                          <>
                            <div>
                              <p className="text-[10px] font-medium uppercase tracking-wider text-lucid-muted">Inactivity Seconds</p>
                              <p className="text-lucid-white">{capsule.inactivitySeconds ?? '—'}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-medium uppercase tracking-wider text-lucid-muted">Payload Size</p>
                              <p className="text-lucid-white">{capsule.payloadSize ? `${capsule.payloadSize} bytes` : '—'}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-medium uppercase tracking-wider text-lucid-muted">Is Active</p>
                              <p className="text-lucid-white">{capsule.isActive == null ? '—' : capsule.isActive ? 'Yes' : 'No'}</p>
                            </div>
                          </>
                        ) : (
                          <>
                            <div>
                              <p className="text-[10px] font-medium uppercase tracking-wider text-lucid-muted">Token Delta</p>
                              <p className="text-lucid-white">{capsule.tokenDelta || '—'}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-medium uppercase tracking-wider text-lucid-muted">SOL Delta</p>
                              <p className="text-lucid-white">{capsule.solDelta == null ? '—' : `${capsule.solDelta.toFixed(4)} SOL`}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-medium uppercase tracking-wider text-lucid-muted">PER (TEE) Tx Bytes</p>
                              <p className="text-lucid-white">{capsule.proofBytes ? `${capsule.proofBytes} bytes` : '—'}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-medium uppercase tracking-wider text-lucid-muted">PER (TEE) Context</p>
                              <div className="flex items-center gap-1 min-w-0">
                                <p className="font-mono text-lucid-white break-all truncate">{zkProofHash || '—'}</p>
                                {zkProofHash && <CopyButton value={zkProofHash} />}
                              </div>
                            </div>
                            <div>
                              <p className="text-[10px] font-medium uppercase tracking-wider text-lucid-muted">PER (TEE) Commit Hash</p>
                              <div className="flex items-center gap-1 min-w-0">
                                <p className="font-mono text-lucid-white break-all truncate">{zkPublicInputsHash || '—'}</p>
                                {zkPublicInputsHash && <CopyButton value={zkPublicInputsHash} />}
                              </div>
                            </div>
                          </>
                        )}
                        <div>
                          <p className="text-[10px] font-medium uppercase tracking-wider text-lucid-muted">Latest Signature</p>
                          <div className="flex items-center gap-1 min-w-0">
                            <p className="font-mono text-lucid-white break-all truncate">{capsule.signature || '—'}</p>
                            {capsule.signature && <CopyButton value={capsule.signature} />}
                          </div>
                        </div>
                      </div>

                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-lucid-muted mb-2">
                          Capsule Events
                        </p>
                        {capsule.events.length === 0 ? (
                          <p className="text-lucid-muted">No transaction events found for this capsule.</p>
                        ) : (
                          <div className="space-y-2">
                            {capsule.events.map((event) => (
                              <div
                                key={`${capsule.id}-${event.signature}`}
                                className="rounded-lg border border-lucid-border bg-lucid-card/80 px-3 py-3"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="text-lucid-white">{event.label}</span>
                                  <span className="text-[10px] text-lucid-muted">
                                    {event.blockTime ? timeAgo(event.blockTime * 1000) : '—'}
                                  </span>
                                </div>
                                <div className="mt-2 flex items-start justify-between gap-2 text-[11px] text-lucid-muted">
                                  <div className="flex min-w-0 items-center gap-1">
                                    <span className="font-mono break-all truncate">{event.signature}</span>
                                    <CopyButton value={event.signature} className="shrink-0" />
                                  </div>
                                  <span className={`shrink-0 ${event.status === 'success' ? 'text-lucid-accent' : 'text-red-400'}`}>
                                    {event.status}
                                  </span>
                                </div>
                                {event.logs.length > 0 && (
                                  <div className="mt-2 max-h-48 overflow-y-auto space-y-1 text-[11px] text-lucid-muted font-mono break-all whitespace-pre-wrap overflow-x-hidden">
                                    {event.logs.map((log, index) => (
                                      <div key={`${event.signature}-${index}`}>{log}</div>
                                    ))}
                                    <p className="text-[10px] text-lucid-muted pt-1">
                                      {event.logs.length} log{event.logs.length !== 1 ? 's' : ''} total
                                    </p>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {filteredCapsules.length > pageSize && (
              <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs text-lucid-muted">
                <button
                  type="button"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="rounded-lg border border-lucid-border bg-lucid-surface/80 px-3 py-1.5 disabled:opacity-40 hover:border-lucid-accent/40 transition"
                >
                  First
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="rounded-lg border border-lucid-border bg-lucid-surface/80 px-3 py-1.5 disabled:opacity-40 hover:border-lucid-accent/40 transition"
                >
                  ‹
                </button>
                <span className="rounded-lg border border-lucid-border bg-lucid-card/80 px-3 py-1.5 text-lucid-white">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage >= totalPages}
                  className="rounded-lg border border-lucid-border bg-lucid-surface/80 px-3 py-1.5 disabled:opacity-40 hover:border-lucid-accent/40 transition"
                >
                  ›
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage >= totalPages}
                  className="rounded-lg border border-lucid-border bg-lucid-surface/80 px-3 py-1.5 disabled:opacity-40 hover:border-lucid-accent/40 transition"
                >
                  Last
                </button>
              </div>
            )}
          </div>
        </section>
        </div>
      </main>
    </div>
  )
}
