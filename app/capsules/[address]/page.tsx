'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { PublicKey } from '@solana/web3.js'
import { useWallet } from '@solana/wallet-adapter-react'
import { ArrowLeft, Copy, RefreshCw, Shield } from 'lucide-react'
import {
  getCapsuleByAddress,
  executeIntent,
  distributeAssets,
} from '@/lib/solana'
import { getCapsuleVaultPDA } from '@/lib/program'
import { getProgramId, getSolanaConnection } from '@/config/solana'
import { SOLANA_CONFIG, MAGICBLOCK_ER, PER_TEE } from '@/constants'
import { parseIntentPayload, formatDuration } from '@/utils/intent'
import { buildCreSignedMessage } from '@/utils/creAuth'
import { bytesToBase64 } from '@/utils/creCrypto'
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts'

const COINGECKO_SOL_BASE = 'https://api.coingecko.com/api/v3/coins/solana/market_chart?vs_currency=usd&days='
const COINGECKO_SOL_PRICE = 'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'

const CHART_RANGES = [
  { key: '6h', label: '6h', days: 1, hoursFilter: 6 },
  { key: '12h', label: '12h', days: 1, hoursFilter: 12 },
  { key: '1d', label: '1D', days: 1, hoursFilter: null },
  { key: '1mo', label: '1M', days: 30, hoursFilter: null },
  { key: '1y', label: '1Y', days: 365, hoursFilter: null },
] as const

function formatChartTime(ts: number, rangeKey: string): string {
  const d = new Date(ts)
  if (rangeKey === '1y') {
    return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
  }
  if (rangeKey === '1mo') {
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit' })
}

type IntentParsed =
  | {
    type: 'token'
    intent?: string
    totalAmount?: string
    beneficiaries?: any[]
    inactivityDays?: number
    delayDays?: number
    cre?: {
      enabled?: boolean
      secretRef?: string
      secretHash?: string
      recipientEmailHash?: string
      recipientEmail?: string
      deliveryChannel?: 'email' | 'sms'
    }
    // Legacy payload key support
    premium?: {
      enabled?: boolean
      secretRef?: string
      secretHash?: string
      recipientEmailHash?: string
      recipientEmail?: string
      deliveryChannel?: 'email' | 'sms'
    }
  }
  | {
    type: 'nft'
    intent?: string
    nftMints?: string[]
    nftRecipients?: string[]
    inactivityDays?: number
    delayDays?: number
    cre?: {
      enabled?: boolean
      secretRef?: string
      secretHash?: string
      recipientEmailHash?: string
      recipientEmail?: string
      deliveryChannel?: 'email' | 'sms'
    }
    // Legacy payload key support
    premium?: {
      enabled?: boolean
      secretRef?: string
      secretHash?: string
      recipientEmailHash?: string
      recipientEmail?: string
      deliveryChannel?: 'email' | 'sms'
    }
  }

function parseIntentData(intentData: Uint8Array): IntentParsed | null {
  const parsed = parseIntentPayload(intentData) as Record<string, unknown> | null
  if (!parsed) return null
  if (parsed.type === 'nft') return { type: 'nft', ...parsed } as IntentParsed
  return { type: 'token', ...parsed } as IntentParsed
}

const maskAddress = (addr: string) =>
  addr.length > 16 ? `${addr.slice(0, 8)}…${addr.slice(-8)}` : addr

function CopyButton({ value }: { value: string }) {
  const copy = () => navigator.clipboard?.writeText(value)
  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex shrink-0 items-center justify-center rounded p-1 text-Heres-muted transition-colors hover:bg-Heres-surface/80 hover:text-Heres-accent"
      title="Copy"
    >
      <Copy className="h-4 w-4" />
    </button>
  )
}

function timeAgo(ms: number | null) {
  if (!ms) return '—'
  const diff = Math.max(0, Date.now() - ms)
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function CapsuleDetailPage() {
  const params = useParams()
  const router = useRouter()
  const wallet = useWallet()
  const address = typeof params?.address === 'string' ? params.address : null
  const [capsule, setCapsule] = useState<Awaited<ReturnType<typeof getCapsuleByAddress>>>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [chartData, setChartData] = useState<{ time: string; value: number; usd: number }[]>([])
  const [chartLoading, setChartLoading] = useState(true)
  const [chartRange, setChartRange] = useState<(typeof CHART_RANGES)[number]['key']>('1d')
  const [currentSolPrice, setCurrentSolPrice] = useState<number | null>(null)
  const [displayedSolPrice, setDisplayedSolPrice] = useState<number>(0)
  const displayedPriceRef = useRef(0)
  const [creDeliveryStatus, setCreDeliveryStatus] = useState<{
    status: string
    updatedAt: number
    idempotencyKey: string
    lastError?: string
  } | null>(null)
  const [creDeliveryLoading, setCreDeliveryLoading] = useState(false)
  const [creDeliveryError, setCreDeliveryError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionResult, setActionResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [creDispatchLoading, setCreDispatchLoading] = useState(false)
  const [creDispatchResult, setCreDispatchResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const isOwner = Boolean(wallet.connected && wallet.publicKey && capsule?.owner && capsule.owner.equals(wallet.publicKey))

  const handleExecuteIntent = async () => {
    if (!wallet.connected || !wallet.publicKey || !capsule) return
    setActionLoading('execute')
    setActionResult(null)
    try {
      const beneficiaries = intentParsed?.type === 'token' && 'beneficiaries' in intentParsed && intentParsed.beneficiaries
        ? intentParsed.beneficiaries.filter((b: any) => b.address?.trim()).map((b: any) => ({
            chain: b.chain ?? 'solana',
            address: b.address,
            amount: b.amount,
            amountType: b.amountType,
          }))
        : undefined
      const mint = capsule.mint && !capsule.mint.equals(PublicKey.default) ? capsule.mint : undefined
      const tx = await executeIntent(wallet as any, capsule.owner, beneficiaries, mint)
      setActionResult({ type: 'success', message: `Execute Intent TX: ${tx}` })
    } catch (err: any) {
      console.error('[Execute Intent] Error:', err)
      setActionResult({ type: 'error', message: err.message || 'Execute failed' })
    } finally {
      setActionLoading(null)
    }
  }

  const handleDistributeAssets = async () => {
    if (!wallet.connected || !wallet.publicKey || !capsule) return
    setActionLoading('distribute')
    setActionResult(null)
    try {
      const beneficiaries = intentParsed?.type === 'token' && 'beneficiaries' in intentParsed && intentParsed.beneficiaries
        ? intentParsed.beneficiaries.filter((b: any) => b.address?.trim()).map((b: any) => ({
            chain: b.chain ?? 'solana',
            address: b.address,
            amount: b.amount,
            amountType: b.amountType,
          }))
        : undefined
      const mint = capsule.mint && !capsule.mint.equals(PublicKey.default) ? capsule.mint : undefined
      const tx = await distributeAssets(wallet as any, capsule.owner, beneficiaries, mint)
      setActionResult({ type: 'success', message: `Distribute Assets TX: ${tx}` })
    } catch (err: any) {
      console.error('[Distribute Assets] Error:', err)
      setActionResult({ type: 'error', message: err.message || 'Distribution failed' })
    } finally {
      setActionLoading(null)
    }
  }

  const handleCreDispatch = async () => {
    if (!wallet.connected || !wallet.publicKey || !capsule || !wallet.signMessage) return
    setCreDispatchLoading(true)
    setCreDispatchResult(null)
    try {
      const owner = wallet.publicKey.toBase58()
      const timestamp = Date.now()
      const message = buildCreSignedMessage({
        action: 'dispatch',
        owner,
        capsuleAddress: capsule.capsuleAddress,
        timestamp,
      })
      const signature = bytesToBase64(await wallet.signMessage(new TextEncoder().encode(message)))
      const res = await fetch('/api/intent-delivery/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-cre-signature': signature },
        body: JSON.stringify({ capsule: capsule.capsuleAddress, owner, timestamp }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'CRE dispatch failed')
      setCreDispatchResult({ type: 'success', message: `Intent Statement delivery dispatched (${data.status || 'queued'})` })
    } catch (err: any) {
      setCreDispatchResult({ type: 'error', message: err.message || 'CRE dispatch failed' })
    } finally {
      setCreDispatchLoading(false)
    }
  }

  const intentParsed = useMemo(() => {
    if (!capsule?.intentData) return null
    return parseIntentData(capsule.intentData)
  }, [capsule?.intentData])

  const isNft = intentParsed?.type === 'nft'
  const isToken = intentParsed?.type === 'token'
  const creConfig = intentParsed?.cre ?? intentParsed?.premium
  const isCreEnabled = Boolean(
    creConfig?.enabled &&
    creConfig.secretRef &&
    creConfig.secretHash &&
    (creConfig.recipientEmailHash || creConfig.recipientEmail)
  )

  useEffect(() => {
    if (!address) {
      setError('Invalid capsule address')
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    try {
      const pubkey = new PublicKey(address)
      getCapsuleByAddress(pubkey).then((data) => {
        if (cancelled) return
        setCapsule(data)
        if (!data) setError('Capsule not found')
        setLoading(false)
      }).catch(() => {
        if (!cancelled) {
          setError('Failed to load capsule')
          setLoading(false)
        }
      })
    } catch {
      setError('Invalid capsule address')
      setLoading(false)
    }
    return () => { cancelled = true }
  }, [address])

  useEffect(() => {
    if (
      !capsule?.capsuleAddress ||
      !isCreEnabled ||
      !wallet.connected ||
      !wallet.publicKey ||
      !wallet.signMessage ||
      !isOwner
    ) {
      setCreDeliveryStatus(null)
      setCreDeliveryError(null)
      return
    }

    let cancelled = false
    setCreDeliveryLoading(true)
    setCreDeliveryError(null)
    const walletPublicKey = wallet.publicKey
    if (!walletPublicKey) {
      setCreDeliveryLoading(false)
      setCreDeliveryError('Wallet public key is unavailable.')
      return
    }
    const signMessage = wallet.signMessage
    if (!signMessage) {
      setCreDeliveryLoading(false)
      setCreDeliveryError('Wallet does not support message signing for Intent Statement delivery status lookup.')
      return
    }

    ; (async () => {
      try {
        const owner = walletPublicKey.toBase58()
        const cacheKey = `cre-status-auth:${capsule.capsuleAddress}:${owner}`
        let timestamp = 0
        let signature = ''

        try {
          const cachedRaw = sessionStorage.getItem(cacheKey)
          if (cachedRaw) {
            const cached = JSON.parse(cachedRaw) as { timestamp?: number; signature?: string }
            if (typeof cached.timestamp === 'number' && typeof cached.signature === 'string') {
              const ageMs = Date.now() - cached.timestamp
              if (ageMs >= 0 && ageMs < 4 * 60 * 1000) {
                timestamp = cached.timestamp
                signature = cached.signature
              }
            }
          }
        } catch {
          // Ignore cache parse failures and request a fresh signature.
        }

        if (!signature) {
          timestamp = Date.now()
          const message = buildCreSignedMessage({
            action: 'delivery-status',
            owner,
            capsuleAddress: capsule.capsuleAddress,
            timestamp,
          })
          signature = bytesToBase64(await signMessage(new TextEncoder().encode(message)))
          sessionStorage.setItem(cacheKey, JSON.stringify({ timestamp, signature }))
        }

        const params = new URLSearchParams({
          capsule: capsule.capsuleAddress,
          owner,
          timestamp: String(timestamp),
        })
        const res = await fetch(`/api/intent-delivery/status?${params.toString()}`, {
          headers: { 'x-cre-signature': signature },
        })
        const data = await res.json()
        if (!res.ok) {
          throw new Error(data?.error || 'Failed to fetch Intent Statement delivery status')
        }
        if (cancelled) return
        const latest = Array.isArray(data.entries) ? data.entries[0] : null
        setCreDeliveryStatus(latest ?? null)
      } catch (err) {
        if (cancelled) return
        setCreDeliveryError(err instanceof Error ? err.message : String(err))
      } finally {
        if (!cancelled) setCreDeliveryLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [capsule?.capsuleAddress, isCreEnabled, wallet.connected, wallet.publicKey, wallet.signMessage, isOwner])

  // Token: SOL price chart from CoinGecko (with range filter)
  const rangeConfig = useMemo(() => CHART_RANGES.find((r) => r.key === chartRange) ?? CHART_RANGES[2], [chartRange])
  useEffect(() => {
    if (!isToken && !isNft) {
      setChartLoading(false)
      return
    }
    setChartLoading(true)
    const url = `${COINGECKO_SOL_BASE}${rangeConfig.days}`
    fetch(url)
      .then((res) => res.json())
      .then((data: { prices?: [number, number][] }) => {
        let prices = data?.prices || []
        if (rangeConfig.hoursFilter != null) {
          const cutoff = Date.now() - rangeConfig.hoursFilter * 60 * 60 * 1000
          prices = prices.filter(([ts]) => ts >= cutoff)
        }
        const mapped = prices.map(([ts, usd]) => ({
          time: formatChartTime(ts, rangeConfig.key),
          value: usd,
          usd,
        }))
        setChartData(mapped)
      })
      .catch(() => setChartData([]))
      .finally(() => setChartLoading(false))
  }, [isToken, isNft, chartRange, rangeConfig.days, rangeConfig.hoursFilter, rangeConfig.key])

  // Current SOL price (live) and polling
  useEffect(() => {
    if (!isToken && !isNft) return
    const fetchPrice = () => {
      fetch(COINGECKO_SOL_PRICE)
        .then((res) => res.json())
        .then((data: { solana?: { usd?: number } }) => {
          const usd = data?.solana?.usd
          if (typeof usd === 'number' && usd > 0) setCurrentSolPrice(usd)
        })
        .catch(() => { })
    }
    fetchPrice()
    const interval = setInterval(fetchPrice, 120_000)
    return () => clearInterval(interval)
  }, [isToken, isNft])

  // Keep ref in sync for animation start value
  displayedPriceRef.current = displayedSolPrice

  // Animate displayed price towards current price (counting animation)
  useEffect(() => {
    if (currentSolPrice == null) return
    const start = displayedPriceRef.current
    const diff = currentSolPrice - start
    if (Math.abs(diff) < 0.001) {
      setDisplayedSolPrice(currentSolPrice)
      return
    }
    const duration = 500
    const startTime = performance.now()
    let rafId: number
    const tick = (now: number) => {
      const elapsed = now - startTime
      const t = Math.min(elapsed / duration, 1)
      const ease = 1 - Math.pow(1 - t, 2)
      const value = start + diff * ease
      setDisplayedSolPrice(value)
      displayedPriceRef.current = value
      if (t < 1) rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [currentSolPrice])

  if (loading) {
    return (
      <div className="min-h-screen bg-hero text-Heres-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="h-8 w-8 animate-spin text-Heres-accent" />
          <p className="text-Heres-muted">Loading capsule…</p>
        </div>
      </div>
    )
  }

  if (error || !capsule) {
    return (
      <div className="min-h-screen bg-hero text-Heres-white pt-24 pb-16 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-red-400 mb-6">{error || 'Capsule not found'}</p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg border border-Heres-border bg-Heres-card/80 px-4 py-2 text-Heres-white hover:border-Heres-accent/40"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
        </div>
      </div>
    )
  }

  const status = capsule.executedAt
    ? 'Executed'
    : !capsule.isActive
      ? 'Waiting'
      : capsule.lastActivity + capsule.inactivityPeriod < Math.floor(Date.now() / 1000)
        ? 'Expired'
        : 'Active'
  const isDelegated = capsule.accountOwner?.equals?.(new PublicKey(MAGICBLOCK_ER.DELEGATION_PROGRAM_ID)) ?? false
  const lastUpdatedMs = capsule.lastActivity ? capsule.lastActivity * 1000 : null

  return (
    <div className="min-h-screen bg-hero text-Heres-white">
      <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-Heres-muted hover:text-Heres-accent mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>

          {/* Graph Explorer style: header card */}
          <section className="card-Heres p-6 sm:p-8 mb-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-baseline gap-3">
                <h1 className="text-2xl font-bold text-Heres-white sm:text-3xl">
                  Capsule
                </h1>
                <span className="font-mono text-sm text-Heres-muted" title={capsule.capsuleAddress}>
                  {maskAddress(capsule.capsuleAddress)}
                </span>
                <span className="rounded-lg border border-Heres-border bg-Heres-surface/80 px-2.5 py-1 text-xs font-medium text-Heres-muted">
                  v1.0
                </span>
                <span
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium ${status === 'Active'
                    ? 'bg-Heres-accent/20 text-Heres-accent'
                    : status === 'Executed'
                      ? 'bg-Heres-accent/20 text-Heres-accent'
                      : status === 'Expired'
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-Heres-purple/20 text-Heres-purple'
                    }`}
                >
                  {status}
                </span>
                {isDelegated && (
                  <span className="rounded-lg px-2.5 py-1 text-xs font-medium bg-blue-500/20 text-blue-400">
                    Delegated (PER)
                  </span>
                )}
              </div>
              <p className="text-sm text-Heres-muted">
                Updated {timeAgo(lastUpdatedMs)}
              </p>
            </div>
            <p className="mt-3 text-sm text-Heres-muted max-w-xl">
              {isNft ? 'NFT capsule' : 'Token (SOL) capsule'} · Inactivity period:{' '}
              {formatDuration(capsule.inactivityPeriod)}
            </p>
          </section>

          {/* Metadata grid (Graph Explorer style) */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="rounded-xl border border-Heres-border bg-Heres-card/80 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-Heres-muted mb-1">Network</p>
              <p className="text-sm font-medium text-Heres-white">
                Solana {SOLANA_CONFIG.NETWORK || 'devnet'}
              </p>
            </div>
            <div className="rounded-xl border border-Heres-border bg-Heres-card/80 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-Heres-muted mb-1">Capsule ID</p>
              <div className="flex items-center gap-1">
                <a
                  href={`https://explorer.solana.com/address/${capsule.capsuleAddress}?cluster=${SOLANA_CONFIG.NETWORK || 'devnet'}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-mono text-Heres-accent truncate min-w-0 hover:underline"
                  title={capsule.capsuleAddress}
                >
                  {maskAddress(capsule.capsuleAddress)}
                </a>
                <CopyButton value={capsule.capsuleAddress} />
              </div>
            </div>
            <div className="rounded-xl border border-Heres-border bg-Heres-card/80 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-Heres-muted mb-1">Owner</p>
              <div className="flex items-center gap-1">
                <p className="text-sm font-mono text-Heres-white truncate min-w-0" title={capsule.owner.toBase58()}>
                  {maskAddress(capsule.owner.toBase58())}
                </p>
                <CopyButton value={capsule.owner.toBase58()} />
              </div>
            </div>
            <div className="rounded-xl border border-Heres-border bg-Heres-card/80 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-Heres-muted mb-1">Program ID</p>
              <div className="flex items-center gap-1">
                <p className="text-sm font-mono text-Heres-white truncate min-w-0" title={getProgramId().toBase58()}>
                  {maskAddress(getProgramId().toBase58())}
                </p>
                <CopyButton value={getProgramId().toBase58()} />
              </div>
            </div>
            {capsule.mint && (
              <div className="rounded-xl border border-Heres-border bg-Heres-card/80 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-Heres-muted mb-1">Token Mint</p>
                <div className="flex items-center gap-1">
                  <p className="text-sm font-mono text-Heres-white truncate min-w-0" title={capsule.mint.toBase58()}>
                    {maskAddress(capsule.mint.toBase58())}
                  </p>
                  <CopyButton value={capsule.mint.toBase58()} />
                </div>
              </div>
            )}
            <div className="rounded-xl border border-Heres-border bg-Heres-card/80 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-Heres-muted mb-1">Retries</p>
              <p className="text-sm font-mono text-Heres-white">{(capsule as any).retryCount?.toString() || '0'}</p>
            </div>
          </section>

          {/* Privacy & Delegation (PER / TEE) */}
          <section className="card-Heres p-6 mb-6 border-Heres-accent/20">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <h2 className="text-lg font-semibold text-Heres-white">Privacy &amp; Delegation (PER / TEE)</h2>
              <span className="rounded-lg border border-Heres-accent/50 bg-Heres-accent/10 px-2.5 py-1 text-xs font-medium text-Heres-accent">
                PER (TEE) enabled
              </span>
            </div>
            <p className="text-sm text-Heres-muted mb-4 w-full max-w-none">
              This capsule uses the Private Ephemeral Rollup (PER) with TEE. Delegation and crank scheduling happen automatically at creation. Conditions are monitored confidentially inside the TEE.
            </p>
            <div className="rounded-xl border border-Heres-border/50 bg-Heres-surface/30 p-4 mb-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-Heres-accent mb-1">Where is private monitoring?</p>
              <p className="text-sm text-Heres-muted">
                Private monitoring runs inside the TEE automatically after capsule creation. Conditions (inactivity, intent) are checked confidentially and are not visible on the public chain. To query private state, use TEE RPC with an auth token.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-xl border border-Heres-border bg-Heres-card/80 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-Heres-muted mb-1">Privacy mode</p>
                <p className="text-sm font-medium text-Heres-accent">PER (TEE)</p>
              </div>
              <div className="rounded-xl border border-Heres-border bg-Heres-card/80 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-Heres-muted mb-1">Default validator</p>
                <p className="text-sm font-medium text-Heres-white">TEE</p>
              </div>
              <div className="rounded-xl border border-Heres-border bg-Heres-card/80 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-Heres-muted mb-1">Validator address</p>
                <div className="flex items-center gap-1">
                  <p className="text-sm font-mono text-Heres-white truncate min-w-0" title={MAGICBLOCK_ER.ACTIVE_VALIDATOR}>
                    {maskAddress(MAGICBLOCK_ER.ACTIVE_VALIDATOR)}
                  </p>
                  <CopyButton value={MAGICBLOCK_ER.ACTIVE_VALIDATOR} />
                </div>
              </div>
              <div className="rounded-xl border border-Heres-border bg-Heres-card/80 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-Heres-muted mb-1">TEE RPC</p>
                <div className="flex items-center gap-1 min-w-0">
                  <a
                    href={PER_TEE.DOCS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-mono text-Heres-accent truncate hover:underline"
                    title="Open TEE / PER docs"
                  >
                    {PER_TEE.RPC_URL.replace(/^https:\/\//, '')}
                  </a>
                  <CopyButton value={PER_TEE.RPC_URL} />
                </div>
                <p className="text-[10px] text-Heres-muted mt-1">RPC is API-only; link opens TEE docs</p>
              </div>
            </div>
          </section>

          {/* Intent / Type summary */}
          <section className="card-Heres p-6 mb-6">
            <h2 className="text-lg font-semibold text-Heres-white mb-3">Intent</h2>
            <p className="text-sm text-Heres-muted mb-4">
              {intentParsed?.intent || 'No intent decoded'}
            </p>
            {isToken && intentParsed && 'totalAmount' in intentParsed && intentParsed.totalAmount && (
              <p className="text-sm text-Heres-accent">
                Total amount: {intentParsed.totalAmount} SOL
              </p>
            )}
            {isNft && intentParsed && 'nftMints' in intentParsed && intentParsed.nftMints && (
              <p className="text-sm text-Heres-accent">
                NFTs: {intentParsed.nftMints.length} item(s)
              </p>
            )}
          </section>

          {isCreEnabled && (
            <section className="card-Heres p-6 mb-6 border-Heres-accent/30">
              <h2 className="text-lg font-semibold text-Heres-white mb-2">Intent Statement Delivery</h2>
              <p className="text-sm text-Heres-muted mb-4">
                Off-chain encrypted Intent Statement package delivery powered by CRE orchestration.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-xl border border-Heres-border bg-Heres-card/80 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-Heres-muted mb-1">Channel</p>
                  <p className="text-sm text-Heres-white">
                    {(creConfig?.deliveryChannel || 'email').toUpperCase()}
                  </p>
                </div>
                <div className="rounded-xl border border-Heres-border bg-Heres-card/80 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-Heres-muted mb-1">Recipient Commitment</p>
                  <p className="text-sm text-Heres-white font-mono">
                    {creConfig?.recipientEmailHash
                      ? `${creConfig.recipientEmailHash.slice(0, 16)}...`
                      : creConfig?.recipientEmail
                        ? 'legacy-email-onchain'
                      : '—'}
                  </p>
                </div>
                <div className="rounded-xl border border-Heres-border bg-Heres-card/80 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-Heres-muted mb-1">Delivery Status</p>
                  {creDeliveryLoading ? (
                    <p className="text-sm text-Heres-muted">Loading...</p>
                  ) : !wallet.connected ? (
                    <p className="text-sm text-Heres-muted">Connect wallet</p>
                  ) : !isOwner ? (
                    <p className="text-sm text-Heres-muted">Owner auth required</p>
                  ) : (
                    <p className="text-sm text-Heres-accent">{creDeliveryStatus?.status || 'pending'}</p>
                  )}
                </div>
              </div>
              {creDeliveryStatus?.lastError && (
                <p className="text-xs text-amber-400 mt-3">{creDeliveryStatus.lastError}</p>
              )}
              {creDeliveryError && (
                <p className="text-xs text-red-400 mt-3">{creDeliveryError}</p>
              )}
            </section>
          )}

          {/* Actions — status-based flow */}
          {isOwner && (() => {
            const isExecuted = status === 'Executed' || (!capsule.isActive && capsule.executedAt)
            const isExpired = status === 'Expired'
            const isActive = status === 'Active'
            const canExecute = isExpired && !isExecuted
            const canDistribute = Boolean(isExecuted)
            const canDispatchCre = Boolean(isExecuted && isCreEnabled)
            const allDone = Boolean(isExecuted && creDeliveryStatus?.status === 'delivered')

            // Determine current step (1-based)
            const currentStep = allDone ? 4 : isExecuted ? 2 : canExecute ? 1 : 0

            const steps = [
              { num: 1, label: 'Execute Intent', desc: 'Deactivate capsule when inactivity condition met' },
              { num: 2, label: 'Distribute Assets', desc: 'Transfer SOL/tokens to beneficiaries' },
              ...(isCreEnabled ? [{ num: 3, label: 'Deliver Intent Statement', desc: 'Dispatch encrypted intent via CRE' }] : []),
            ]

            return (
              <section className="card-Heres p-6 mb-6 border-amber-500/30">
                <h2 className="text-lg font-semibold text-Heres-white mb-2">Actions</h2>

                {/* Status guidance */}
                <div className="rounded-lg border border-Heres-border/50 bg-Heres-surface/30 p-3 mb-5">
                  {isActive && (
                    <p className="text-sm text-Heres-muted">
                      Capsule is <span className="text-Heres-accent font-medium">Active</span>. The inactivity period has not elapsed yet. Actions will become available once the capsule expires.
                    </p>
                  )}
                  {canExecute && (
                    <p className="text-sm text-amber-400">
                      Inactivity period has elapsed. You can now <strong>Execute Intent</strong> to deactivate the capsule, then distribute assets.
                    </p>
                  )}
                  {isExecuted && !allDone && (
                    <p className="text-sm text-Heres-accent">
                      Capsule executed. Proceed to <strong>Distribute Assets</strong>{isCreEnabled ? ' and then dispatch Intent Statement delivery via CRE.' : '.'}
                    </p>
                  )}
                  {allDone && (
                    <p className="text-sm text-green-400">
                      All steps complete. Assets distributed and intent statement delivered.
                    </p>
                  )}
                  {status === 'Waiting' && (
                    <p className="text-sm text-Heres-purple">
                      Capsule is in <span className="font-medium">Waiting</span> state. No actions available.
                    </p>
                  )}
                </div>

                {/* Step indicator */}
                <div className="flex items-center gap-2 mb-5 overflow-x-auto">
                  {steps.map((step, i) => {
                    const done = step.num < currentStep || (step.num === 3 && allDone)
                    const active = step.num === currentStep || (step.num === 2 && currentStep === 2) || (step.num === 3 && currentStep >= 2 && !allDone)
                    return (
                      <div key={step.num} className="flex items-center gap-2">
                        {i > 0 && <div className={`w-8 h-px ${done ? 'bg-green-500' : 'bg-Heres-border'}`} />}
                        <div className="flex items-center gap-2 shrink-0">
                          <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                            done ? 'bg-green-500/20 text-green-400 border border-green-500/40' :
                            active ? 'bg-Heres-accent/20 text-Heres-accent border border-Heres-accent/40' :
                            'bg-Heres-surface/50 text-Heres-muted border border-Heres-border'
                          }`}>
                            {done ? '✓' : step.num}
                          </div>
                          <div>
                            <p className={`text-xs font-medium ${done ? 'text-green-400' : active ? 'text-Heres-white' : 'text-Heres-muted'}`}>
                              {step.label}
                            </p>
                            <p className="text-[10px] text-Heres-muted hidden sm:block">{step.desc}</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleExecuteIntent}
                    disabled={!canExecute || !!actionLoading}
                    title={!canExecute ? (isActive ? 'Inactivity period not elapsed' : isExecuted ? 'Already executed' : 'Not available') : 'Execute intent on-chain'}
                    className="rounded-lg border border-Heres-accent px-4 py-2 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-Heres-accent/10 text-Heres-accent hover:bg-Heres-accent/20"
                  >
                    {actionLoading === 'execute' ? 'Executing...' : isExecuted ? 'Executed ✓' : 'Execute Intent'}
                  </button>
                  <button
                    type="button"
                    onClick={handleDistributeAssets}
                    disabled={!canDistribute || !!actionLoading}
                    title={!canDistribute ? 'Execute intent first' : 'Distribute SOL/tokens to beneficiaries'}
                    className="rounded-lg border border-Heres-purple px-4 py-2 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-Heres-purple/10 text-Heres-purple hover:bg-Heres-purple/20"
                  >
                    {actionLoading === 'distribute' ? 'Distributing...' : 'Distribute Assets'}
                  </button>
                  {isCreEnabled && (
                    <button
                      type="button"
                      onClick={handleCreDispatch}
                      disabled={!canDispatchCre || creDispatchLoading || !!actionLoading}
                      title={!canDispatchCre ? 'Execute intent first' : 'Dispatch encrypted intent statement via CRE'}
                      className="rounded-lg border border-blue-500 px-4 py-2 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                    >
                      {creDispatchLoading ? 'Dispatching...' : 'Deliver Intent Statement'}
                    </button>
                  )}
                </div>

                {/* Result messages */}
                {actionResult && (
                  <div className={`mt-4 rounded-lg border p-3 text-sm break-all ${
                    actionResult.type === 'success'
                      ? 'border-green-500/30 bg-green-500/10 text-green-400'
                      : 'border-red-500/30 bg-red-500/10 text-red-400'
                  }`}>
                    {actionResult.message}
                  </div>
                )}
                {creDispatchResult && (
                  <div className={`mt-3 rounded-lg border p-3 text-sm break-all ${
                    creDispatchResult.type === 'success'
                      ? 'border-blue-500/30 bg-blue-500/10 text-blue-400'
                      : 'border-red-500/30 bg-red-500/10 text-red-400'
                  }`}>
                    {creDispatchResult.message}
                  </div>
                )}
              </section>
            )
          })()}

          {/* Price / Value chart (Graph Explorer style) */}
          <section className="card-Heres p-6 mb-6">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-Heres-white">
                  {isToken ? 'SOL Price (USD)' : 'NFT Value (SOL / USD proxy)'}
                </h2>
                <p className="text-sm text-Heres-muted mt-1">
                  {isToken
                    ? 'Real-time SOL price (CoinGecko).'
                    : 'Representative value trend (SOL/USD) for reference.'}
                </p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {isToken && (
                  <div className="rounded-lg border border-Heres-border/80 bg-Heres-card/80 px-2.5 py-1.5 flex items-center gap-2">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-Heres-muted">1 SOL</span>
                    <span className="text-sm font-semibold tabular-nums text-Heres-accent">${displayedSolPrice.toFixed(2)}</span>
                    <span className="text-[10px] text-Heres-muted">USD</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  {CHART_RANGES.map((r) => (
                    <button
                      key={r.key}
                      type="button"
                      onClick={() => setChartRange(r.key)}
                      className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${chartRange === r.key
                        ? 'border-Heres-accent bg-Heres-accent/20 text-Heres-accent'
                        : 'border-Heres-border bg-Heres-card/80 text-Heres-muted hover:border-Heres-accent/40 hover:text-Heres-accent'
                        }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {chartLoading ? (
              <div className="relative h-64 flex items-center justify-center text-Heres-muted">
                <RefreshCw className="h-8 w-8 animate-spin" />
              </div>
            ) : chartData.length > 0 ? (
              <div className="relative h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                    <defs>
                      <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--Heres-accent)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="var(--Heres-accent)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="rgba(255,255,255,0.3)" />
                    <YAxis domain={[90, 'auto']} tick={{ fontSize: 10 }} stroke="rgba(255,255,255,0.3)" tickFormatter={(v) => `$${v}`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'var(--Heres-card)', border: '1px solid var(--Heres-border)' }}
                      labelStyle={{ color: 'var(--Heres-white)' }}
                      formatter={(value: number | undefined) => [value != null ? `$${Number(value).toFixed(2)}` : '$0.00', 'USD']}
                    />
                    <Area
                      type="monotone"
                      dataKey="usd"
                      stroke="var(--Heres-accent)"
                      strokeWidth={2}
                      fill="url(#chartGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-Heres-muted text-sm">
                Chart data unavailable
              </div>
            )}
          </section>

        </div>
      </main>
    </div>
  )
}
