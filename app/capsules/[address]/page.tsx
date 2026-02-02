'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { PublicKey } from '@solana/web3.js'
import { ArrowLeft, Copy, RefreshCw, ExternalLink } from 'lucide-react'
import { getCapsuleByAddress } from '@/lib/solana'
import { getProgramId, getSolanaConnection } from '@/config/solana'
import { SOLANA_CONFIG } from '@/constants'
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

const COINGECKO_SOL_CHART = 'https://api.coingecko.com/api/v3/coins/solana/market_chart?vs_currency=usd&days=7'

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
    } catch {}
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
      className="inline-flex shrink-0 items-center justify-center rounded p-1 text-lucid-muted transition-colors hover:bg-lucid-surface/80 hover:text-lucid-accent"
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
  const address = typeof params?.address === 'string' ? params.address : null
  const [capsule, setCapsule] = useState<Awaited<ReturnType<typeof getCapsuleByAddress>>>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [chartData, setChartData] = useState<{ time: string; value: number; usd: number }[]>([])
  const [chartLoading, setChartLoading] = useState(true)

  const intentParsed = useMemo(() => {
    if (!capsule?.intentData) return null
    return parseIntentData(capsule.intentData)
  }, [capsule?.intentData])

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

  // Token: SOL price chart from CoinGecko
  useEffect(() => {
    if (!isToken && !isNft) {
      setChartLoading(false)
      return
    }
    setChartLoading(true)
    fetch(COINGECKO_SOL_CHART)
      .then((res) => res.json())
      .then((data: { prices?: [number, number][] }) => {
        const prices = data?.prices || []
        const mapped = prices.map(([ts, usd]) => ({
          time: new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit' }),
          value: usd,
          usd,
        }))
        setChartData(mapped)
      })
      .catch(() => setChartData([]))
      .finally(() => setChartLoading(false))
  }, [isToken, isNft])

  if (loading) {
    return (
      <div className="min-h-screen bg-hero text-lucid-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="h-8 w-8 animate-spin text-lucid-accent" />
          <p className="text-lucid-muted">Loading capsule…</p>
        </div>
      </div>
    )
  }

  if (error || !capsule) {
    return (
      <div className="min-h-screen bg-hero text-lucid-white pt-24 pb-16 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-red-400 mb-6">{error || 'Capsule not found'}</p>
          <Link
            href="/capsules"
            className="inline-flex items-center gap-2 rounded-lg border border-lucid-border bg-lucid-card/80 px-4 py-2 text-lucid-white hover:border-lucid-accent/40"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to My Capsule
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
    <div className="min-h-screen bg-hero text-lucid-white">
      <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <Link
            href="/capsules"
            className="inline-flex items-center gap-2 text-sm text-lucid-muted hover:text-lucid-accent mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to My Capsule
          </Link>

          {/* Graph Explorer style: header card */}
          <section className="card-lucid p-6 sm:p-8 mb-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-baseline gap-3">
                <h1 className="text-2xl font-bold text-lucid-white sm:text-3xl">
                  Capsule
                </h1>
                <span className="font-mono text-sm text-lucid-muted" title={capsule.capsuleAddress}>
                  {maskAddress(capsule.capsuleAddress)}
                </span>
                <span className="rounded-lg border border-lucid-border bg-lucid-surface/80 px-2.5 py-1 text-xs font-medium text-lucid-muted">
                  v1.0
                </span>
                <span
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                    status === 'Active'
                      ? 'bg-lucid-accent/20 text-lucid-accent'
                      : status === 'Executed'
                      ? 'bg-lucid-accent/20 text-lucid-accent'
                      : status === 'Expired'
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-lucid-purple/20 text-lucid-purple'
                  }`}
                >
                  {status}
                </span>
              </div>
              <p className="text-sm text-lucid-muted">
                Updated {timeAgo(lastUpdatedMs)}
              </p>
            </div>
            <p className="mt-3 text-sm text-lucid-muted max-w-xl">
              {isNft ? 'NFT capsule' : 'Token (SOL) capsule'} · Inactivity period:{' '}
              {secondsToDays(capsule.inactivityPeriod)}d
            </p>
          </section>

          {/* Metadata grid (Graph Explorer style) */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="rounded-xl border border-lucid-border bg-lucid-card/80 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-lucid-muted mb-1">Network</p>
              <p className="text-sm font-medium text-lucid-white">
                Solana {SOLANA_CONFIG.NETWORK || 'devnet'}
              </p>
            </div>
            <div className="rounded-xl border border-lucid-border bg-lucid-card/80 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-lucid-muted mb-1">Capsule ID</p>
              <div className="flex items-center gap-1">
                <p className="text-sm font-mono text-lucid-white truncate min-w-0" title={capsule.capsuleAddress}>
                  {maskAddress(capsule.capsuleAddress)}
                </p>
                <CopyButton value={capsule.capsuleAddress} />
              </div>
            </div>
            <div className="rounded-xl border border-lucid-border bg-lucid-card/80 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-lucid-muted mb-1">Owner</p>
              <div className="flex items-center gap-1">
                <p className="text-sm font-mono text-lucid-white truncate min-w-0" title={capsule.owner.toBase58()}>
                  {maskAddress(capsule.owner.toBase58())}
                </p>
                <CopyButton value={capsule.owner.toBase58()} />
              </div>
            </div>
            <div className="rounded-xl border border-lucid-border bg-lucid-card/80 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-lucid-muted mb-1">Program ID</p>
              <div className="flex items-center gap-1">
                <p className="text-sm font-mono text-lucid-white truncate min-w-0" title={getProgramId().toBase58()}>
                  {maskAddress(getProgramId().toBase58())}
                </p>
                <CopyButton value={getProgramId().toBase58()} />
              </div>
            </div>
          </section>

          {/* Intent / Type summary */}
          <section className="card-lucid p-6 mb-6">
            <h2 className="text-lg font-semibold text-lucid-white mb-3">Intent</h2>
            <p className="text-sm text-lucid-muted mb-4">
              {intentParsed?.intent || 'No intent decoded'}
            </p>
            {isToken && intentParsed && 'totalAmount' in intentParsed && intentParsed.totalAmount && (
              <p className="text-sm text-lucid-accent">
                Total amount: {intentParsed.totalAmount} SOL
              </p>
            )}
            {isNft && intentParsed && 'nftMints' in intentParsed && intentParsed.nftMints && (
              <p className="text-sm text-lucid-accent">
                NFTs: {intentParsed.nftMints.length} item(s)
              </p>
            )}
          </section>

          {/* Price / Value chart (Graph Explorer style) */}
          <section className="card-lucid p-6 mb-6">
            <h2 className="text-lg font-semibold text-lucid-white mb-1">
              {isToken ? 'SOL Price (USD)' : 'NFT Value (SOL / USD proxy)'}
            </h2>
            <p className="text-sm text-lucid-muted mb-4">
              {isToken
                ? 'Real-time SOL price from the last 7 days (CoinGecko).'
                : 'Representative value trend (SOL/USD) for reference.'}
            </p>
            {chartLoading ? (
              <div className="h-64 flex items-center justify-center text-lucid-muted">
                <RefreshCw className="h-8 w-8 animate-spin" />
              </div>
            ) : chartData.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                    <defs>
                      <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--lucid-accent)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="var(--lucid-accent)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="rgba(255,255,255,0.3)" />
                    <YAxis tick={{ fontSize: 10 }} stroke="rgba(255,255,255,0.3)" tickFormatter={(v) => `$${v}`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'var(--lucid-card)', border: '1px solid var(--lucid-border)' }}
                      labelStyle={{ color: 'var(--lucid-white)' }}
                      formatter={(value: number) => [`$${value.toFixed(2)}`, 'USD']}
                    />
                    <Area
                      type="monotone"
                      dataKey="usd"
                      stroke="var(--lucid-accent)"
                      strokeWidth={2}
                      fill="url(#chartGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-lucid-muted text-sm">
                Chart data unavailable
              </div>
            )}
          </section>

          {/* Explorer link */}
          <section className="flex flex-wrap gap-4">
            <a
              href={`https://explorer.solana.com/address/${capsule.capsuleAddress}?cluster=${SOLANA_CONFIG.NETWORK || 'devnet'}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-lucid-border bg-lucid-card/80 px-4 py-2 text-sm text-lucid-muted hover:border-lucid-accent/40 hover:text-lucid-accent"
            >
              <ExternalLink className="h-4 w-4" />
              View on Solana Explorer
            </a>
          </section>
        </div>
      </main>
    </div>
  )
}
