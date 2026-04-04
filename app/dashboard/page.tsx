'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Database,
  RefreshCw,
  Settings,
  Sparkles,
  User,
} from 'lucide-react'
import { PublicKey } from '@solana/web3.js'
import { useWallet } from '@solana/wallet-adapter-react'
import { SOLANA_CONFIG, PLATFORM_FEE } from '@/constants'
import { initFeeConfig } from '@/lib/solana'

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
  isDelegated: boolean
  events: CapsuleEvent[]
  tokenDelta: string | null
  solDelta: number | null
  proofBytes: number | null
}

type CapsuleListItem = Omit<CapsuleRow, 'events'> & {
  eventCount: number
}

type CapsuleSummaryPayload = {
  summary: {
    total: number
    allTimeCreated: number | null
    active: number
    executed: number
    expired: number
    proofs: number
    successRate: number
    totalValueSecuredLamports: number
    totalValueExecutedLamports: number
    activeValueLockedLamports: number
  }
  timestamp: number
  complete: boolean
}

type CapsuleListPayload = {
  items: CapsuleListItem[]
  page: number
  limit: number
  total: number
  totalPages: number
  timestamp: number
  complete: boolean
}

const formatNumber = (value: number) => value.toLocaleString('en-US')
const formatSol = (lamports: number) => {
  const sol = lamports / 1_000_000_000
  return `${sol.toLocaleString('en-US', {
    minimumFractionDigits: sol >= 100 ? 0 : 2,
    maximumFractionDigits: sol >= 100 ? 2 : 4,
  })} SOL`
}

const formatDuration = (seconds: number | null) => {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return '...'
  const days = seconds / (60 * 60 * 24)
  if (days < 1) return `${Math.max(1, Math.round(seconds / 3600))}h`
  if (days < 30) return `${Math.round(days)}d`
  return `${Math.round(days / 30)}mo`
}

const formatDateTime = (timestampMs: number | null) => {
  if (!timestampMs) return '...'
  return new Date(timestampMs).toLocaleString()
}

const timeAgo = (timestampMs: number | null) => {
  if (!timestampMs) return '...'
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

const statusTone = (status: string, kind: CapsuleRow['kind']) => {
  const normalized = status.toLowerCase()
  if (kind === 'event') {
    if (normalized.includes('executed')) return 'bg-Heres-accent/20 text-Heres-accent'
    if (normalized.includes('created')) return 'bg-Heres-accent/20 text-Heres-accent'
    if (normalized.includes('updated')) return 'bg-Heres-purple/20 text-Heres-purple'
    if (normalized.includes('deactivated')) return 'bg-red-500/20 text-red-400'
    return 'bg-Heres-surface text-Heres-muted'
  }
  if (normalized.includes('active')) return 'bg-Heres-accent/20 text-Heres-accent'
  if (normalized.includes('expired')) return 'bg-red-500/20 text-red-400'
  if (normalized.includes('executed')) return 'bg-Heres-accent/20 text-Heres-accent'
  return 'bg-Heres-surface text-Heres-muted'
}

export default function DashboardPage() {
  const wallet = useWallet()
  const [capsules, setCapsules] = useState<CapsuleListItem[]>([])
  const [query, setQuery] = useState('')
  const [filterMode, setFilterMode] = useState<'all' | 'live' | 'created' | 'executed' | 'active' | 'expired'>('all')
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest')
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)
  const [zkProofHash, setZkProofHash] = useState<string | null>(null)
  const [zkPublicInputsHash, setZkPublicInputsHash] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [refreshKey, setRefreshKey] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isListLoading, setIsListLoading] = useState(false)
  const [feeConfigExists, setFeeConfigExists] = useState<boolean | null>(null)
  const [initFeePending, setInitFeePending] = useState(false)
  const [initFeeTx, setInitFeeTx] = useState<string | null>(null)
  const [initFeeError, setInitFeeError] = useState<string | null>(null)
  const [listTotal, setListTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const loadTokenRef = useRef(0)
  const [summary, setSummary] = useState({
    total: 0,
    allTimeCreated: null as number | null,
    active: 0,
    executed: 0,
    expired: 0,
    proofs: 0,
    successRate: 0,
    totalValueSecuredLamports: 0,
    totalValueExecutedLamports: 0,
    activeValueLockedLamports: 0,
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

  // Check if fee_config PDA exists (諛고룷 ...1...珥덇린...?щ?)
  useEffect(() => {
    const controller = new AbortController()
    const check = async () => {
      try {
        const params = new URLSearchParams()
        if (refreshKey > 0) params.set('refresh', '1')
        const res = await fetch(`/api/capsules/fee-config${params.toString() ? `?${params.toString()}` : ''}`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        const payload = await res.json().catch(() => null)
        if (!res.ok || !payload) {
          throw new Error(payload?.error || `Fee config request failed (${res.status})`)
        }
        setFeeConfigExists(Boolean(payload.exists))
      } catch {
        if (!controller.signal.aborted) setFeeConfigExists(null)
      }
    }
    check()
    return () => { controller.abort() }
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
        setInitFeeError('?대? 珥덇린?붾맖 (Fee config already initialized).')
        setFeeConfigExists(true)
      } else {
        setInitFeeError(msg)
      }
    } finally {
      setInitFeePending(false)
    }
  }, [wallet])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedQuery(query.trim())
    }, 250)

    return () => window.clearTimeout(timeout)
  }, [query])

  useEffect(() => {
    const controller = new AbortController()
    const requestToken = ++loadTokenRef.current

    const loadSummary = async () => {
      setIsRefreshing(true)
      try {
        const params = new URLSearchParams()
        if (refreshKey > 0) params.set('refresh', '1')
        const res = await fetch(`/api/capsules/summary${params.toString() ? `?${params.toString()}` : ''}`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        const payload = (await res.json().catch(() => null)) as CapsuleSummaryPayload | null
        if (!res.ok || !payload) {
          throw new Error((payload as any)?.error || `Summary request failed (${res.status})`)
        }
        if (requestToken !== loadTokenRef.current || controller.signal.aborted) return
        setSummary(payload.summary)
        setLastUpdated(payload.timestamp || Date.now())
        setError(null)
      } catch {
        if (!controller.signal.aborted) {
          setError('Unable to load on-chain capsule data. Please check RPC connectivity.')
        }
      } finally {
        if (!controller.signal.aborted) setIsRefreshing(false)
      }
    }

    loadSummary()
    return () => controller.abort()
  }, [refreshKey])

  useEffect(() => {
    const controller = new AbortController()
    const loadList = async () => {
      setIsListLoading(true)
      try {
        const params = new URLSearchParams({
          page: String(currentPage),
          limit: '10',
          filter: filterMode,
          sort: sortOrder,
        })
        if (debouncedQuery) params.set('query', debouncedQuery)
        if (refreshKey > 0) params.set('refresh', '1')
        const res = await fetch(`/api/capsules/list?${params.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        const payload = (await res.json().catch(() => null)) as CapsuleListPayload | null
        if (!res.ok || !payload) {
          throw new Error((payload as any)?.error || `List request failed (${res.status})`)
        }
        if (controller.signal.aborted) return
        setCapsules(Array.isArray(payload.items) ? payload.items : [])
        setListTotal(payload.total || 0)
        setTotalPages(payload.totalPages || 1)
        setCurrentPage(payload.page || 1)
        setLastUpdated(payload.timestamp || Date.now())
        setError(null)
      } catch {
        if (!controller.signal.aborted) {
          setError('Unable to load on-chain capsule data. Please check RPC connectivity.')
        }
      } finally {
        if (!controller.signal.aborted) setIsListLoading(false)
      }
    }

    loadList()
    return () => controller.abort()
  }, [currentPage, debouncedQuery, filterMode, refreshKey, sortOrder])

  const pageSize = 10
  const pagedCapsules = capsules

  const statCards = [
    { label: 'Active Capsules', value: formatNumber(summary.active), tone: 'text-Heres-accent' },
    { label: 'Executed Capsules', value: formatNumber(summary.executed), tone: 'text-Heres-purple' },
    { label: 'PER (TEE) Verified', value: formatNumber(summary.proofs), tone: 'text-Heres-accent' },
    { label: 'Total Value Secured', value: formatSol(summary.totalValueSecuredLamports), tone: 'text-Heres-accent' },
    { label: 'Total Value Executed', value: formatSol(summary.totalValueExecutedLamports), tone: 'text-Heres-purple' },
    { label: 'Active Value Locked', value: formatSol(summary.activeValueLockedLamports), tone: 'text-Heres-accent' },
  ]

  const programIdStr = SOLANA_CONFIG.PROGRAM_ID
  const rpcLabel = SOLANA_CONFIG.HELIUS_API_KEY ? 'Helius Devnet' : 'Solana Devnet'

  return (
    <div className="min-h-screen bg-hero text-Heres-white">
      <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {error && (
            <div className="mb-6 rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Explorer-style: single header card (name + version + stats + Updated) */}
          <section className="card-Heres p-6 sm:p-8 mb-6">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-baseline gap-4">
                <h1 className="text-2xl font-bold text-Heres-white sm:text-3xl">
                  Heres Capsules
                </h1>
                <span className="rounded-lg border border-Heres-border bg-Heres-surface/80 px-2.5 py-1 text-xs font-medium text-Heres-muted">
                  v1.0
                </span>
                <span className="text-Heres-accent font-semibold">
                  {formatNumber(summary.total)} Capsules
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href="/capsules"
                  className="inline-flex items-center gap-2 rounded-lg border border-Heres-border bg-Heres-card/80 px-4 py-2 text-sm font-medium text-Heres-muted transition-colors hover:border-Heres-accent/40 hover:text-Heres-accent"
                >
                  <User className="h-4 w-4" />
                  My Capsule
                </Link>
                <button
                  type="button"
                  onClick={() => setRefreshKey((k) => k + 1)}
                  disabled={isRefreshing}
                  className="flex items-center gap-3 rounded-lg border border-Heres-border bg-Heres-card/80 px-4 py-2 text-sm text-Heres-muted transition-colors hover:border-Heres-accent/40 hover:text-Heres-accent disabled:opacity-70"
                >
                  <RefreshCw
                    className={`h-4 w-4 shrink-0 ${isRefreshing ? 'animate-spin' : ''}`}
                    style={isRefreshing ? { animation: 'spin 1s linear infinite' } : undefined}
                  />
                  {isRefreshing ? 'Syncing...' : lastUpdated ? `Updated ${timeAgo(lastUpdated)}` : 'Syncing'}
                </button>
              </div>
            </div>
            <p className="mt-3 text-sm text-Heres-muted max-w-xl">
              Track capsule status, PER (TEE) execution, and verification on Solana Devnet.
            </p>
          </section>

          {/* ?섏닔猷...ㅼ젙 珥덇린... Fee config媛 ?놁쓣 ?뚮쭔 ?쒖떆 (諛고룷 ...1?뚮쭔 ?꾩슂) */}
          {wallet.connected && feeConfigExists === false && (
            <section className="card-Heres p-6 mb-6 border-Heres-accent/30">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-Heres-accent/10 border border-Heres-accent/40 flex items-center justify-center">
                    <Settings className="w-5 h-5 text-Heres-accent" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-Heres-white">?섏닔猷...ㅼ젙 (諛고룷 ...1...</h2>
                    <p className="text-sm text-Heres-muted mt-0.5">
                      Fee config媛 ?놁쑝硫...?踰덈쭔 ?ㅽ뻾?섏꽭... ?앹꽦 0.05 SOL, ?ㅽ뻾 3%.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleInitFeeConfig}
                  disabled={initFeePending}
                  className="rounded-lg border border-Heres-accent bg-Heres-accent/20 px-4 py-2 text-sm font-medium text-Heres-accent transition hover:bg-Heres-accent/30 disabled:opacity-60"
                >
                  {initFeePending ? '泥섎━ 以?..' : 'Initialize Fee Config'}
                </button>
              </div>
              {initFeeTx && (
                <p className="mt-3 text-sm text-Heres-accent">
                  ?깃났:{' '}
                  <a
                    href={`https://explorer.solana.com/tx/${initFeeTx}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    ?몃옖...뀡 蹂닿린
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
            <div className="rounded-xl border border-Heres-border bg-Heres-card/80 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-Heres-muted mb-1">Network</p>
              <p className="text-sm font-medium text-Heres-white truncate">
                {SOLANA_CONFIG.NETWORK ? `Solana ${SOLANA_CONFIG.NETWORK}` : 'Solana Devnet'}
              </p>
            </div>
            <div className="rounded-xl border border-Heres-border bg-Heres-card/80 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-Heres-muted mb-1">Program ID</p>
              <div className="flex items-center gap-1">
                <p className="text-sm font-mono text-Heres-white truncate min-w-0" title={programIdStr}>
                  {maskAddress(programIdStr)}
                </p>
              </div>
            </div>
            <div className="rounded-xl border border-Heres-border bg-Heres-card/80 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-Heres-muted mb-1">RPC</p>
              <p className="text-sm font-medium text-Heres-white truncate">{rpcLabel}</p>
            </div>
            <div className="rounded-xl border border-Heres-border bg-Heres-card/80 p-4 sm:col-span-2 lg:col-span-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-Heres-muted mb-1">Index Status</p>
              <p className="text-sm font-medium text-Heres-accent">Live</p>
            </div>
          </section>

          {/* Stats row (Explorer "Signal" style) */}
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 mb-6">
            {statCards.map((card) => (
              <div
                key={card.label}
                className="card-Heres p-5 transition-all hover:border-Heres-accent/30"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-wider text-Heres-muted">{card.label}</p>
                  <Sparkles className="w-4 h-4 text-Heres-accent" />
                </div>
                <div className={`mt-3 text-2xl font-semibold ${card.tone}`}>{card.value}</div>
              </div>
            ))}
          </section>

          {/* Explorer-style: tab bar + content */}
          <section className="card-Heres overflow-hidden">
            {/* Tab bar - Explorer "Query | Curators" style */}
            <div className="border-b border-Heres-border">
              <div className="flex flex-wrap gap-0 overflow-x-auto">
                {[
                  { key: 'all', label: 'All' },
                  { key: 'live', label: 'Live' },
                  { key: 'created', label: 'Created' },
                  { key: 'executed', label: 'Executed' },
                  { key: 'active', label: 'Active' },
                  { key: 'expired', label: 'Expired' },
                ].map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => {
                      setCurrentPage(1)
                      setFilterMode(option.key as typeof filterMode)
                    }}
                    className={`min-w-[80px] px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${filterMode === option.key
                      ? 'border-Heres-accent text-Heres-accent'
                      : 'border-transparent text-Heres-muted hover:text-Heres-white'
                      }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                <div className="flex items-center gap-2 text-sm text-Heres-muted">
                  <Database className="w-4 h-4 text-Heres-accent" />
                  {formatNumber(listTotal)} records
                </div>
                <div className="flex items-center gap-2">
                  <input
                    value={query}
                    onChange={(event) => {
                      setCurrentPage(1)
                      setQuery(event.target.value)
                    }}
                    placeholder="Search by address, owner, or signature"
                    className="w-full sm:w-72 rounded-lg border border-Heres-border bg-Heres-surface/80 px-3 py-2 text-sm text-Heres-white placeholder-Heres-muted focus:outline-none focus:border-Heres-accent/50 transition"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentPage(1)
                      setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')
                    }}
                    className="rounded-lg border border-Heres-border bg-Heres-surface/80 px-3 py-2 text-xs text-Heres-muted whitespace-nowrap transition hover:border-Heres-accent/40 hover:text-Heres-white"
                  >
                    {sortOrder === 'newest' ? 'Newest' : 'Oldest'}
                  </button>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {isListLoading && listTotal === 0 && (
                  <div className="rounded-xl border border-Heres-border bg-Heres-surface/50 px-4 py-8 text-center text-sm text-Heres-muted">
                    Loading on-chain capsule data...
                  </div>
                )}

                {!isListLoading && listTotal === 0 && (
                  <div className="rounded-xl border border-Heres-border bg-Heres-surface/50 px-4 py-8 text-center text-sm text-Heres-muted">
                    No capsules found. Try syncing again or adjust the search query.
                  </div>
                )}

                {pagedCapsules.map((capsule) => {
                  return (
                  <div
                    key={capsule.id}
                    className={`rounded-xl border px-4 py-4 transition-colors ${capsule.kind === 'event'
                      ? 'border-Heres-accent/30 bg-Heres-accent/5'
                      : 'border-Heres-border bg-Heres-card/50'
                      }`}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3 text-sm text-Heres-muted">
                          <span className="rounded-lg border border-Heres-border bg-Heres-surface/80 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-Heres-muted">
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
                          {capsule.isDelegated && (
                            <span className="rounded-lg px-2 py-1 text-[11px] font-medium uppercase tracking-wider bg-blue-500/20 text-blue-400">
                              Delegated
                            </span>
                          )}
                          <span className="font-mono text-Heres-muted break-all max-w-full min-w-0">
                            {capsule.signature ? maskAddress(capsule.signature) : '...'}
                          </span>
                        </div>
                        <div className="grid gap-2 text-xs text-Heres-muted md:grid-cols-3">
                          <div>
                            <p className="uppercase tracking-wider text-Heres-muted text-[10px] font-medium">Capsule</p>
                            <div className="flex items-center gap-1 min-w-0">
                              <p className="font-mono text-Heres-white break-all truncate">
                                {maskAddress(capsule.capsuleAddress)}
                              </p>
                            </div>
                          </div>
                          <div>
                            <p className="uppercase tracking-wider text-Heres-muted text-[10px] font-medium">Owner</p>
                            <div className="flex items-center gap-1 min-w-0">
                              <p className="font-mono text-Heres-white break-all truncate">
                                {capsule.owner ? maskAddress(capsule.owner) : '...'}
                              </p>
                            </div>
                          </div>
                          <div>
                            <p className="uppercase tracking-wider text-Heres-muted text-[10px] font-medium">
                              {capsule.kind === 'event' ? 'Created' : 'Inactivity'}
                            </p>
                            <p className="text-Heres-white">
                              {capsule.kind === 'event'
                                ? timeAgo(capsule.lastActivityMs)
                                : formatDuration(capsule.inactivitySeconds)}
                            </p>
                          </div>
                        </div>
                        {capsule.kind === 'event' && (capsule.tokenDelta != null || capsule.solDelta != null || capsule.proofBytes != null) && (
                          <div className="flex flex-wrap gap-3 text-[11px] text-Heres-muted">
                            {capsule.tokenDelta != null && (
                              <span className="font-mono">Token ?: {capsule.tokenDelta}</span>
                            )}
                            {capsule.solDelta != null && (
                              <span className="font-mono">SOL ?: {capsule.solDelta.toFixed(4)}</span>
                            )}
                            {capsule.proofBytes != null && (
                              <span>PER (TEE) tx: {capsule.proofBytes} bytes</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )})}
              </div>

              {listTotal > pageSize && (
                <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs text-Heres-muted">
                  <button
                    type="button"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="rounded-lg border border-Heres-border bg-Heres-surface/80 px-3 py-1.5 disabled:opacity-40 hover:border-Heres-accent/40 transition"
                  >
                    First
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="rounded-lg border border-Heres-border bg-Heres-surface/80 px-3 py-1.5 disabled:opacity-40 hover:border-Heres-accent/40 transition"
                  >
                    ...                  </button>
                  <span className="rounded-lg border border-Heres-border bg-Heres-card/80 px-3 py-1.5 text-Heres-white">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage >= totalPages}
                    className="rounded-lg border border-Heres-border bg-Heres-surface/80 px-3 py-1.5 disabled:opacity-40 hover:border-Heres-accent/40 transition"
                  >
                    ...                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage >= totalPages}
                    className="rounded-lg border border-Heres-border bg-Heres-surface/80 px-3 py-1.5 disabled:opacity-40 hover:border-Heres-accent/40 transition"
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
