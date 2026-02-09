'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { PublicKey } from '@solana/web3.js'
import { useWallet } from '@solana/wallet-adapter-react'
import { ArrowLeft, Copy, RefreshCw, Shield, Play } from 'lucide-react'
import {
  getCapsuleByAddress,
  delegateCapsule,
  executeIntent,
  scheduleExecuteIntent,
} from '@/lib/solana'
import { getProgramId, getSolanaConnection } from '@/config/solana'
import { SOLANA_CONFIG, MAGICBLOCK_ER, PER_TEE, PLATFORM_FEE } from '@/constants'
import { TEE_AUTH } from '@/lib/tee'
import { decodeIntentData, secondsToDays } from '@/utils/intent'
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
  | { type: 'token'; intent?: string; totalAmount?: string; beneficiaries?: any[]; inactivityDays?: number; delayDays?: number }
  | { type: 'nft'; intent?: string; nftMints?: string[]; nftRecipients?: string[]; inactivityDays?: number; delayDays?: number }

function parseIntentData(intentData: Uint8Array): IntentParsed | null {
  try {
    const json = new TextDecoder().decode(intentData)
    const data = JSON.parse(json) as Record<string, unknown>
    if (data?.type === 'nft') return { type: 'nft', ...data } as IntentParsed
    return { type: 'token', ...data } as IntentParsed
  } catch {
    try {
      const decoded = decodeIntentData(intentData)
      if (decoded) return { type: 'token', ...decoded } as IntentParsed
    } catch { }
    return null
  }
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
  const [delegatePending, setDelegatePending] = useState(false)
  const [delegateTx, setDelegateTx] = useState<string | null>(null)
  const [delegateError, setDelegateError] = useState<string | null>(null)
  const [schedulePending, setSchedulePending] = useState(false)
  const [scheduleTx, setScheduleTx] = useState<string | null>(null)
  const [scheduleError, setScheduleError] = useState<string | null>(null)
  const [executePending, setExecutePending] = useState(false)
  const [executeTx, setExecuteTx] = useState<string | null>(null)
  const [executeError, setExecuteError] = useState<string | null>(null)
  const [teeAuthToken, setTeeAuthToken] = useState<string | null>(null)
  const [isTeeAuthenticated, setIsTeeAuthenticated] = useState(false)

  const isOwner = wallet.connected && wallet.publicKey && capsule?.owner && capsule.owner.equals(wallet.publicKey)

  const handleDelegate = useCallback(async () => {
    if (!wallet.publicKey || !wallet.signTransaction || !wallet.signMessage || !capsule) return

    // Check if the account is already delegated by checking its program owner
    const delegationProgramId = new PublicKey(MAGICBLOCK_ER.DELEGATION_PROGRAM_ID)
    const isAlreadyDelegated = capsule.accountOwner?.equals(delegationProgramId)

    setDelegatePending(true)
    setDelegateError(null)
    setDelegateTx(null)
    setScheduleTx(null)
    setScheduleError(null)
    setIsTeeAuthenticated(false)
    setTeeAuthToken(null)

    let currentToken: string | null = null;

    try {
      // ===== STEP 1: Delegate and/or Authenticate with TEE =====
      // We always need an auth token for the TEE RPC (ScheduleTask)
      try {
        console.log('[STEP 1] Fetching TEE authentication token...')
        currentToken = await TEE_AUTH.getAuthToken(wallet)
        setTeeAuthToken(currentToken)
        setIsTeeAuthenticated(true)
        console.log('[STEP 1] TEE Authentication successful')
      } catch (authError) {
        console.warn('[STEP 1] TEE Authentication failed, proceeding without token', authError)
      }

      if (!isAlreadyDelegated) {
        console.log('[STEP 1] Delegating capsule to PER (TEE) validator...')
        const tx = await delegateCapsule(wallet, new PublicKey(MAGICBLOCK_ER.VALIDATOR_TEE))
        setDelegateTx(tx)
        console.log('[STEP 1] ✓ Delegation successful. Tx:', tx)
        // Wait for the ER to sync the delegated account (5 seconds)
        console.log('[STEP 1] Waiting 5 seconds for ER to sync the delegated account...')
        await new Promise(resolve => setTimeout(resolve, 5000))
      } else {
        console.log('[STEP 1] Capsule already delegated, skipping delegation step')
      }

      // ===== STEP 2: Schedule crank on ER to automatically execute intent =====
      // This transaction is sent to the Ephemeral Rollup (ER) via TEE RPC
      // to schedule automatic execution when conditions are met
      setSchedulePending(true)

      // Retry logic for crank scheduling (ER may need time to sync)
      try {
        console.log('[STEP 2] Scheduling crank on devnet ER using TEE RPC...')
        // PASS the fetched token here to resolve "Missing token query param"
        const scheduleSig = await scheduleExecuteIntent(
          wallet,
          undefined,
          undefined,
          currentToken || undefined
        );
        setScheduleTx(scheduleSig)
        console.log('[STEP 2] ✓ Crank scheduled successfully. Tx:', scheduleSig)
      } catch (e: any) {
        const msg = e?.message || String(e)
        console.error('[STEP 2] ✗ Scheduling failed:', msg)
        setScheduleError(`Crank scheduling failed: ${msg}`)
      }
    } catch (e: any) {
      const msg = e?.message || String(e)
      console.error('[STEP 1] ✗ Delegation failed:', msg)
      setDelegateError(`Delegation failed: ${msg}`)
    } finally {
      setDelegatePending(false)
      setSchedulePending(false)
    }
  }, [wallet, capsule])

  const intentParsed = useMemo(() => {
    if (!capsule?.intentData) return null
    return parseIntentData(capsule.intentData)
  }, [capsule?.intentData])

  const handleExecute = useCallback(async () => {
    if (!wallet.connected || !wallet.publicKey || !capsule) return
    const beneficiaries = intentParsed && 'beneficiaries' in intentParsed && Array.isArray(intentParsed.beneficiaries)
      ? (intentParsed.beneficiaries as Array<{ address?: string; amount?: string; amountType?: string }>)
        .filter((b) => b?.address)
        .map((b) => ({
          address: b.address!,
          amount: typeof b.amount === 'string' ? b.amount : String(b.amount ?? '0'),
          amountType: b.amountType ?? 'fixed',
        }))
      : undefined
    if (!beneficiaries?.length) {
      setExecuteError('No beneficiaries in intent data')
      return
    }
    setExecutePending(true)
    setExecuteError(null)
    setExecuteTx(null)
    try {
      const tx = await executeIntent(wallet, capsule.owner, beneficiaries, capsule.mint)
      setExecuteTx(tx)
      const pubkey = new PublicKey(capsule.capsuleAddress)
      getCapsuleByAddress(pubkey).then((updated) => {
        if (updated) setCapsule(updated)
      }).catch(() => { })
    } catch (e: unknown) {
      setExecuteError(e instanceof Error ? e.message : String(e))
    } finally {
      setExecutePending(false)
    }
  }, [wallet, capsule, intentParsed])

  const isNft = intentParsed?.type === 'nft'
  const isToken = intentParsed?.type === 'token'

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
    const interval = setInterval(fetchPrice, 60_000)
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
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {status === 'Expired' && capsule.isActive && (
                  <>
                    <button
                      type="button"
                      onClick={handleExecute}
                      disabled={executePending || !wallet.connected}
                      className="inline-flex items-center gap-2 rounded-lg bg-Heres-accent/20 border border-Heres-accent px-4 py-2 text-sm font-medium text-Heres-accent transition hover:bg-Heres-accent/30 disabled:opacity-60"
                    >
                      <Play className="h-4 w-4" />
                      {executePending ? 'Executing…' : 'Execute intent'}
                    </button>
                    {executeTx && (
                      <a
                        href={`https://explorer.solana.com/tx/${executeTx}?cluster=${SOLANA_CONFIG.NETWORK || 'devnet'}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-Heres-accent hover:underline"
                      >
                        View transaction
                      </a>
                    )}
                    {executeError && <p className="text-sm text-amber-400">{executeError}</p>}
                  </>
                )}
                <p className="text-sm text-Heres-muted">
                  Updated {timeAgo(lastUpdatedMs)}
                </p>
              </div>
            </div>
            <p className="mt-3 text-sm text-Heres-muted max-w-xl">
              {isNft ? 'NFT capsule' : 'Token (SOL) capsule'} · Inactivity period:{' '}
              {secondsToDays(capsule.inactivityPeriod)}d
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
              This capsule uses the Private Ephemeral Rollup (PER) with TEE. When you delegate, it defaults to the TEE validator for confidential condition monitoring. Use TEE RPC with an auth token to query private state.
            </p>
            <div className="rounded-xl border border-Heres-border/50 bg-Heres-surface/30 p-4 mb-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-Heres-accent mb-1">Where is private monitoring?</p>
              <p className="text-sm text-Heres-muted">
                Private monitoring runs inside the TEE after you delegate. Conditions (inactivity, intent) are checked confidentially and are not visible on the public chain. Delegate below to enable it. To query private state (what the TEE sees), use TEE RPC with an auth token. See the TEE docs link above.
              </p>
            </div>
            {isOwner && capsule?.isActive && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleDelegate}
                    disabled={delegatePending || schedulePending}
                    className="inline-flex items-center gap-2 rounded-lg border border-Heres-accent bg-Heres-accent/20 px-4 py-2 text-sm font-medium text-Heres-accent transition hover:bg-Heres-accent/30 disabled:opacity-60"
                  >
                    <Shield className="h-4 w-4" />
                    {delegatePending ? 'Step 1: Delegating to ER...' : schedulePending ? 'Step 2: Scheduling crank on ER...' : 'Delegate & Schedule Crank'}
                  </button>
                </div>

                {/* Step 1: Delegation Status */}
                {delegateTx && (
                  <div className="rounded-lg border border-Heres-accent/30 bg-Heres-accent/5 p-3">
                    <p className="text-xs font-semibold text-Heres-accent mb-1">✓ Step 1: Delegation Complete</p>
                    <p className="text-xs text-Heres-muted mb-2">Capsule delegated to Ephemeral Rollup (ER)</p>
                    <a
                      href={`https://explorer.solana.com/tx/${delegateTx}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-Heres-accent hover:underline"
                    >
                      View delegation tx →
                    </a>
                  </div>
                )}
                {delegateError && (
                  <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-3">
                    <p className="text-xs font-semibold text-amber-400 mb-1">✗ Step 1: Delegation Failed</p>
                    <p className="text-xs text-amber-400">{delegateError}</p>
                  </div>
                )}

                {/* Step 2: Crank Scheduling Status */}
                {scheduleTx && (
                  <div className="rounded-lg border border-Heres-accent/30 bg-Heres-accent/5 p-3">
                    <p className="text-xs font-semibold text-Heres-accent mb-1">✓ Step 2: Crank Scheduled on ER</p>
                    <p className="text-xs text-Heres-muted">When conditions are met, assets will be distributed automatically without anyone visiting.</p>
                  </div>
                )}
                {scheduleError && (
                  <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-3">
                    <p className="text-xs font-semibold text-amber-400 mb-1">✗ Step 2: Crank Scheduling Failed</p>
                    <p className="text-xs text-amber-400">{scheduleError}</p>
                  </div>
                )}
              </div>
            )}
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
                  <p className="text-sm font-mono text-Heres-white truncate min-w-0" title={MAGICBLOCK_ER.VALIDATOR_TEE}>
                    {maskAddress(MAGICBLOCK_ER.VALIDATOR_TEE)}
                  </p>
                  <CopyButton value={MAGICBLOCK_ER.VALIDATOR_TEE} />
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
                {isTeeAuthenticated && (
                  <p className="text-[10px] text-Heres-accent mt-1 flex items-center gap-1">
                    <Shield className="h-2 w-2" /> Authenticated
                  </p>
                )}
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
