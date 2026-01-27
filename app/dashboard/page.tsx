'use client'

import { useEffect, useMemo, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  ChevronDown,
  ChevronUp,
  Database,
  RefreshCw,
  Signal,
  Sparkles,
} from 'lucide-react'
import { PublicKey } from '@solana/web3.js'
import Hero3D from '@/components/Hero3D'
import { getProgramId, getSolanaConnection } from '@/config/solana'
import { SOLANA_CONFIG } from '@/constants'

const WalletMultiButton = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false }
)

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
    if (normalized.includes('executed')) return 'bg-emerald-500/20 text-emerald-200'
    if (normalized.includes('created')) return 'bg-cyan-500/20 text-cyan-200'
    if (normalized.includes('updated')) return 'bg-blue-500/20 text-blue-200'
    if (normalized.includes('deactivated')) return 'bg-rose-500/20 text-rose-200'
    return 'bg-slate-500/20 text-slate-200'
  }
  if (normalized.includes('active')) return 'bg-emerald-500/20 text-emerald-200'
  if (normalized.includes('waiting')) return 'bg-amber-500/20 text-amber-200'
  if (normalized.includes('expired')) return 'bg-rose-500/20 text-rose-200'
  if (normalized.includes('executed')) return 'bg-cyan-500/20 text-cyan-200'
  return 'bg-slate-500/20 text-slate-200'
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

const fetchEnhancedTransactions = async (
  address: string,
  apiKey: string,
  baseUrl: string,
  pageSize = 100,
  maxPages = 120
) => {
  let all: any[] = []
  let before: string | undefined

  for (let page = 0; page < maxPages; page += 1) {
    const url = new URL(`${baseUrl}/addresses/${address}/transactions`)
    url.searchParams.set('api-key', apiKey)
    url.searchParams.set('limit', String(pageSize))
    if (before) url.searchParams.set('before', before)

    const response = await fetch(url.toString())
    if (!response.ok) break
    const data = await response.json()
    const batch = Array.isArray(data)
      ? data
      : data?.transactions || data?.result || data?.data || []

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
  const pathname = usePathname()
  const wallet = useWallet()
  const { publicKey, connected, disconnect, select, wallets } = wallet
  const [showWalletMenu, setShowWalletMenu] = useState(false)
  const [capsules, setCapsules] = useState<CapsuleRow[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [filterMode, setFilterMode] = useState<'all' | 'capsules' | 'events'>('all')
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest')
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)
  const [summary, setSummary] = useState({
    total: 0,
    active: 0,
    waiting: 0,
    executed: 0,
    expired: 0,
    proofs: 0,
    successRate: 0,
  })

  const navLinkClass = (href: string) => {
    const isActive = pathname === href
    return [
      'text-sm transition-colors px-3 py-2 rounded-lg border',
      isActive
        ? 'text-white border-blue-500/60 bg-blue-500/10'
        : 'text-slate-300 hover:text-white border-slate-800/70 hover:border-blue-500/40 bg-slate-900/40',
    ].join(' ')
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (showWalletMenu && !target.closest('.wallet-menu-container')) {
        setShowWalletMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showWalletMenu])

  useEffect(() => {
    let isMounted = true

    const loadDashboard = async () => {
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
        const signatures = await fetchAllSignatures(connection, programId)
        const rpcTransactions = await Promise.all(
          signatures.map(async (signatureInfo) => {
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

        let enhancedTransactions: any[] = []
        if (SOLANA_CONFIG.HELIUS_API_KEY) {
          enhancedTransactions = await fetchEnhancedTransactions(
            programId.toBase58(),
            SOLANA_CONFIG.HELIUS_API_KEY,
            'https://api-devnet.helius-rpc.com/v0'
          )
        }

        const combinedTxMap = new Map<string, ReturnType<typeof toTxRecordFromRpc>>()
        enhancedTransactions
          .map((tx) => toTxRecordFromEnhanced(tx))
          .filter((record) => record.signature)
          .forEach((record) => {
            combinedTxMap.set(record.signature, record as any)
          })

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
              const ownerIndex = accountKeys.findIndex((key) => key === ownerKey)
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
                kind: 'event',
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
              })
            }
          })
        })

        const capsuleRows = decodedCapsules.map((capsule) => {
          const executedAtMs = capsule.executedAt ? capsule.executedAt * 1000 : null
          const lastActivityMs = capsule.lastActivity * 1000
          const isExpired = capsule.executedAt === null && capsule.lastActivity + capsule.inactivityPeriod < nowSeconds
          const status = capsule.executedAt
            ? 'Executed'
            : isExpired
            ? 'Expired'
            : capsule.isActive
            ? 'Active'
            : 'Waiting'
          const events = (capsuleEvents.get(capsule.capsuleAddress) || []).sort(
            (a, b) => (b.blockTime || 0) - (a.blockTime || 0)
          )
          const latestSignature = events[0]?.signature || null

          return {
            id: capsule.capsuleAddress,
            kind: 'capsule',
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
          }
        })

        const combinedRows = [...eventRows, ...capsuleRows]
        const totalEventSignatures = eventRows.length
        const executedEventSignatures = eventRows.filter((row) => row.status === 'Executed').length

        const activeCapsules = capsuleRows.filter((capsule) => capsule.status === 'Active').length
        const executedCapsules = capsuleRows.filter((capsule) => capsule.status === 'Executed').length
        const expiredCapsules = capsuleRows.filter((capsule) => capsule.status === 'Expired').length
        const waitingCapsules = Math.max(0, capsuleRows.length - activeCapsules - executedCapsules - expiredCapsules)
        const successRate =
          totalProofsSubmitted > 0 ? (verifiedProofs / totalProofsSubmitted) * 100 : 0

        if (isMounted) {
          setCapsules(combinedRows)
          setSummary({
            total: totalEventSignatures,
            active: activeCapsules,
            waiting: waitingCapsules,
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
      }
    }

    loadDashboard()

    return () => {
      isMounted = false
    }
  }, [])

  const filteredCapsules = useMemo(() => {
    const value = query.trim().toLowerCase()
    const scoped = capsules.filter((capsule) => {
      if (filterMode === 'capsules' && capsule.kind !== 'capsule') return false
      if (filterMode === 'events' && capsule.kind !== 'event') return false
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

  const statCards = [
    { label: 'Total Capsules', value: formatNumber(summary.total), tone: 'text-cyan-300' },
    { label: 'Active Capsules', value: formatNumber(summary.active), tone: 'text-emerald-300' },
    { label: 'Executed Capsules', value: formatNumber(summary.executed), tone: 'text-indigo-300' },
    { label: 'Proofs Verified', value: formatNumber(summary.proofs), tone: 'text-blue-300' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden text-slate-100">
      <div className="fixed inset-0 w-full h-full z-0">
        <Hero3D />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/60 to-slate-950/80 z-10" />
      </div>

      <nav className="fixed top-0 w-full z-50 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="relative w-10 h-10 transition-transform group-hover:rotate-12">
              <Image src="/logo.svg" alt="Lucid Logo" fill className="object-contain" priority />
            </div>
            <span className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">
              Lucid
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className={navLinkClass('/dashboard')}>
              Dashboard
            </Link>
            <Link href="/create" className={navLinkClass('/create')}>
              Create
            </Link>
            <Link href="/capsules" className={navLinkClass('/capsules')}>
              Capsules
            </Link>
            <div className="relative z-[9999] wallet-menu-container">
              {connected && publicKey ? (
                <div className="relative">
                  <button
                    onClick={() => setShowWalletMenu(!showWalletMenu)}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                  >
                    <span className="font-mono text-sm">
                      {publicKey.toString().slice(0, 4)}...{publicKey.toString().slice(-4)}
                    </span>
                    {showWalletMenu ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {showWalletMenu && (
                    <div className="absolute right-0 mt-2 w-48 bg-slate-800 rounded-lg shadow-lg border border-slate-700 overflow-hidden z-[10000]">
                      <button
                        onClick={async () => {
                          try {
                            await disconnect()
                            setShowWalletMenu(false)
                          } catch (disconnectError) {
                            console.error('Error disconnecting wallet:', disconnectError)
                          }
                        }}
                        className="w-full text-left px-4 py-2 text-white hover:bg-slate-700 transition-colors"
                      >
                        Disconnect
                      </button>
                      {wallets && wallets.length > 1 && (
                        <>
                          <div className="border-t border-slate-700" />
                          <div className="px-2 py-1 text-xs text-slate-400">Switch Wallet</div>
                          {wallets.map((w: any) => (
                            <button
                              key={w.adapter.name}
                              onClick={async () => {
                                try {
                                  await select(w.adapter.name)
                                  setShowWalletMenu(false)
                                } catch (switchError) {
                                  console.error('Error switching wallet:', switchError)
                                }
                              }}
                              className="w-full text-left px-4 py-2 text-white hover:bg-slate-700 transition-colors"
                            >
                              {w.adapter.name}
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="material-elevation-2 rounded-lg overflow-hidden">
                  <WalletMultiButton />
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="relative z-20 pt-28 pb-16 px-6">
        <section className="max-w-7xl mx-auto">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between animate-fade-in">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.32em] text-cyan-400/70">Network Dashboard</p>
              <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
                Capsule activity overview
              </h1>
              <p className="text-base text-slate-400 max-w-xl">
                Inspired by Graph Explorer: track capsule status, proofs, and execution cadence in one view.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-slate-400">
              <span className="rounded-full border border-slate-800/60 bg-slate-900/40 px-3 py-1 flex items-center gap-2">
                <Signal className="w-3 h-3 text-emerald-400" />
                {SOLANA_CONFIG.NETWORK ? `Solana ${SOLANA_CONFIG.NETWORK}` : 'Solana'}
              </span>
              <span className="rounded-full border border-slate-800/60 bg-slate-900/40 px-3 py-1 flex items-center gap-2">
                <RefreshCw className="w-3 h-3 text-cyan-300 animate-spin [animation-duration:4s]" />
                {lastUpdated ? `Updated ${timeAgo(lastUpdated)}` : 'Syncing'}
              </span>
            </div>
          </div>

          {error && (
            <div className="mt-6 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </div>
          )}
        </section>

        <section className="max-w-7xl mx-auto mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {statCards.map((card) => (
            <div
              key={card.label}
              className="material-card material-elevation-2 hover:material-elevation-4 rounded-2xl border border-slate-800/70 bg-slate-900/40 p-5 transition-all"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{card.label}</p>
                <Sparkles className="w-4 h-4 text-blue-400/60" />
              </div>
              <div className={`mt-3 text-2xl font-semibold ${card.tone}`}>{card.value}</div>
              <p className="mt-1 text-xs text-slate-500">Protocol health pulse</p>
            </div>
          ))}
        </section>

        <section className="max-w-7xl mx-auto mt-10">
          <div className="material-card material-elevation-2 rounded-3xl border border-slate-800/70 bg-slate-900/40 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Capsule telemetry</p>
                <h2 className="mt-2 text-xl font-semibold text-white">All capsules</h2>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Database className="w-3 h-3" />
                {formatNumber(filteredCapsules.length)} records
              </div>
            </div>

            <div className="mt-4">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by capsule address, owner, or signature"
                className="w-full rounded-xl border border-slate-800/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 transition"
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2 text-xs">
                {[
                  { key: 'all', label: 'All' },
                  { key: 'capsules', label: 'Capsules' },
                  { key: 'events', label: 'Events' },
                ].map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setFilterMode(option.key as typeof filterMode)}
                    className={`rounded-full border px-3 py-1 transition ${
                      filterMode === option.key
                        ? 'border-cyan-500/60 bg-cyan-500/10 text-cyan-200'
                        : 'border-slate-800/70 bg-slate-950/60 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
                className="rounded-full border border-slate-800/70 bg-slate-950/60 px-3 py-1 text-xs text-slate-300 transition hover:border-cyan-500/60"
              >
                {sortOrder === 'newest' ? 'Newest first' : 'Oldest first'}
              </button>
            </div>

            <div className="mt-6 space-y-3">
              {filteredCapsules.length === 0 && (
                <div className="rounded-xl border border-slate-800/70 bg-slate-950/50 px-4 py-8 text-center text-sm text-slate-500">
                  No capsules found. Try syncing again or adjust the search query.
                </div>
              )}

              {filteredCapsules.map((capsule) => (
                <div
                  key={capsule.id}
                  className={`rounded-2xl border px-4 py-4 ${
                    capsule.kind === 'event'
                      ? 'border-amber-500/30 bg-amber-500/5'
                      : 'border-slate-800/70 bg-slate-950/50'
                  }`}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 text-sm text-slate-200">
                        <span className="rounded-full border border-slate-800/70 bg-slate-900/60 px-2 py-1 text-[10px] uppercase tracking-[0.3em] text-slate-400">
                          {capsule.kind === 'event' ? 'Event' : 'Capsule'}
                        </span>
                        <span
                          className={`rounded-full px-2 py-1 text-[11px] uppercase tracking-[0.2em] ${statusTone(
                            capsule.status,
                            capsule.kind
                          )}`}
                        >
                          {capsule.status}
                        </span>
                        <span className="font-mono text-slate-300 break-all max-w-full">
                          {capsule.signature ? maskAddress(capsule.signature) : '—'}
                        </span>
                      </div>
                      <div className="grid gap-2 text-xs text-slate-400 md:grid-cols-3">
                        <div>
                          <p className="uppercase tracking-[0.2em] text-slate-500 text-[10px]">Capsule</p>
                          <p className="font-mono text-slate-300">
                            {maskAddress(capsule.capsuleAddress)}
                          </p>
                        </div>
                        <div>
                          <p className="uppercase tracking-[0.2em] text-slate-500 text-[10px]">Owner</p>
                          <p className="font-mono text-slate-300">
                            {capsule.owner ? maskAddress(capsule.owner) : '—'}
                          </p>
                        </div>
                        <div>
                          <p className="uppercase tracking-[0.2em] text-slate-500 text-[10px]">Inactivity</p>
                          <p className="text-slate-300">
                            {formatDuration(capsule.inactivitySeconds)}
                          </p>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpandedId(expandedId === capsule.id ? null : capsule.id)}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-900/60 px-4 py-2 text-xs text-slate-200 transition hover:border-cyan-500/60"
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
                    <div className="mt-4 rounded-xl border border-slate-800/70 bg-slate-900/60 px-4 py-4 text-xs text-slate-300 space-y-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Capsule</p>
                          <p className="font-mono text-slate-200 break-all">{capsule.capsuleAddress}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Owner</p>
                          <p className="font-mono text-slate-200 break-all">{capsule.owner || '—'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Last Activity</p>
                          <p>{formatDateTime(capsule.lastActivityMs)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Executed At</p>
                          <p>{formatDateTime(capsule.executedAtMs)}</p>
                        </div>
                        {capsule.kind === 'capsule' ? (
                          <>
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Inactivity Seconds</p>
                              <p>{capsule.inactivitySeconds ?? '—'}</p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Payload Size</p>
                              <p>{capsule.payloadSize ? `${capsule.payloadSize} bytes` : '—'}</p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Is Active</p>
                              <p>{capsule.isActive == null ? '—' : capsule.isActive ? 'Yes' : 'No'}</p>
                            </div>
                          </>
                        ) : (
                          <>
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Token Delta</p>
                              <p>{capsule.tokenDelta || '—'}</p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">SOL Delta</p>
                              <p>{capsule.solDelta == null ? '—' : `${capsule.solDelta.toFixed(4)} SOL`}</p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Noir Proof Bytes</p>
                              <p>{capsule.proofBytes ? `${capsule.proofBytes} bytes` : '—'}</p>
                            </div>
                          </>
                        )}
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Latest Signature</p>
                          <p className="font-mono text-slate-200 break-all">{capsule.signature || '—'}</p>
                        </div>
                      </div>

                      <div>
                        <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500 mb-2">
                          Capsule Events
                        </p>
                        {capsule.events.length === 0 ? (
                          <p className="text-slate-500">No transaction events found for this capsule.</p>
                        ) : (
                          <div className="space-y-2">
                            {capsule.events.map((event) => (
                              <div
                                key={`${capsule.id}-${event.signature}`}
                                className="rounded-lg border border-slate-800/70 bg-slate-950/60 px-3 py-3"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="text-slate-200">{event.label}</span>
                                  <span className="text-[10px] text-slate-500">
                                    {event.blockTime ? timeAgo(event.blockTime * 1000) : '—'}
                                  </span>
                                </div>
                                <div className="mt-2 flex items-start justify-between gap-2 text-[11px] text-slate-400">
                                  <span className="font-mono break-all">{event.signature}</span>
                                  <span className={event.status === 'success' ? 'text-emerald-300' : 'text-rose-300'}>
                                    {event.status}
                                  </span>
                                </div>
                                {event.logs.length > 0 && (
                                  <div className="mt-2 space-y-1 text-[11px] text-slate-500 font-mono break-all whitespace-pre-wrap">
                                    {event.logs.map((log, index) => (
                                      <div key={`${event.signature}-${index}`}>{log}</div>
                                    ))}
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
          </div>
        </section>
      </main>
    </div>
  )
}
