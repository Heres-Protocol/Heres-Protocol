'use client'

import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useWallet } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import { ArrowLeft, Search, SlidersHorizontal, Wallet } from 'lucide-react'
import { getCapsule } from '@/lib/solana'
import { getCapsulePDA } from '@/lib/program'
import { getSolanaConnection } from '@/config/solana'
import { parseIntentPayload } from '@/utils/intent'
import type { AnyIntentData, IntentData, NftIntentData } from '@/utils/intent'
import type { Beneficiary } from '@/types'

const WalletMultiButton = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false }
)

type DashboardFilter = 'all' | 'active' | 'waiting' | 'expired' | 'executed'
type CapsuleStatus = 'Active' | 'Waiting' | 'Expired' | 'Executed'
type TriggerUnit = 'Minute' | 'Minutes' | 'Hour' | 'Hours' | 'Day' | 'Days'

type BeneficiaryTableRow = {
  id: string
  index: number
  capsuleAddress: string
  transactionId: string
  status: CapsuleStatus
  address: string
  amount: string
  token: string
  onChainAmount: string
  totalAllocatedAmount: string
  createdDate: string
  releaseDate: string
}

const FILTERS: Array<{ key: DashboardFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'waiting', label: 'Waiting' },
  { key: 'expired', label: 'Expired' },
  { key: 'executed', label: 'Executed' },
]

function maskAddress(value: string, start = 4, end = 4) {
  return value.length > start + end ? `${value.slice(0, start)}...${value.slice(-end)}` : value
}

function formatNumber(value: string | number | null | undefined) {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) return '--'
  return numeric.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

function formatDateLabel(timestampMs: number | null) {
  if (!timestampMs) return '--'
  return new Date(timestampMs).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function getTriggerUnit(seconds: number) {
  if (seconds < 3600) return 'minute' as const
  if (seconds < 86400) return 'hour' as const
  return 'day' as const
}

function formatTriggerDisplay(remainingSeconds: number, fallbackSeconds: number) {
  const unitSourceSeconds = remainingSeconds > 0 ? remainingSeconds : fallbackSeconds
  const triggerUnit = getTriggerUnit(Math.max(0, unitSourceSeconds))

  if (triggerUnit === 'minute') {
    const value = Math.max(0, Math.ceil(remainingSeconds / 60))
    return {
      value,
      unit: value === 1 ? ('Minute' as TriggerUnit) : ('Minutes' as TriggerUnit),
    }
  }

  if (triggerUnit === 'hour') {
    const value = Math.max(0, Math.ceil(remainingSeconds / 3600))
    return {
      value,
      unit: value === 1 ? ('Hour' as TriggerUnit) : ('Hours' as TriggerUnit),
    }
  }

  const value = Math.max(0, Math.ceil(remainingSeconds / 86400))
  return {
    value,
    unit: value === 1 ? ('Day' as TriggerUnit) : ('Days' as TriggerUnit),
  }
}

function computeStatus(capsule: Awaited<ReturnType<typeof getCapsule>>) {
  if (!capsule) return 'Waiting' as const
  if (capsule.executedAt) return 'Executed' as const
  if (!capsule.isActive) return 'Waiting' as const
  if (capsule.lastActivity + capsule.inactivityPeriod < Math.floor(Date.now() / 1000)) {
    return 'Expired' as const
  }
  return 'Active' as const
}

function isNftIntent(intent: AnyIntentData | null): intent is NftIntentData {
  return Boolean(intent && 'type' in intent && intent.type === 'nft')
}

function isTokenIntent(intent: AnyIntentData | null): intent is IntentData {
  return Boolean(intent && !('type' in intent))
}

function statusText(status: CapsuleStatus) {
  return status
}

function formatBeneficiaryAmount(rawAmount: string | undefined, amountType: Beneficiary['amountType'] | undefined) {
  if (!rawAmount) return '--'
  const formatted = formatNumber(rawAmount)
  if (amountType === 'percentage') return `${formatted}%`
  return formatted
}

function computeOnChainBeneficiaryAmount(
  totalAmount: string | undefined,
  rawAmount: string | undefined,
  amountType: Beneficiary['amountType'] | undefined
) {
  if (!totalAmount || !rawAmount) return '--'

  const total = Number(totalAmount)
  const amount = Number(rawAmount)
  if (!Number.isFinite(total) || !Number.isFinite(amount)) return '--'

  if (amountType === 'percentage') {
    return formatNumber((total * amount) / 100)
  }

  return formatNumber(amount)
}

async function getCapsuleCreatedAt(capsuleAddress: string): Promise<number | null> {
  const connection = getSolanaConnection()
  const pubkey = new PublicKey(capsuleAddress)
  let before: string | undefined
  let oldestBlockTime: number | null = null

  for (let page = 0; page < 10; page += 1) {
    const signatures = await connection.getSignaturesForAddress(pubkey, { before, limit: 1000 })
    if (signatures.length === 0) break

    const withBlockTimes = signatures.filter((entry) => typeof entry.blockTime === 'number')
    if (withBlockTimes.length > 0) {
      oldestBlockTime = withBlockTimes[withBlockTimes.length - 1].blockTime ?? oldestBlockTime
    }

    if (signatures.length < 1000) break
    before = signatures[signatures.length - 1].signature
  }

  return oldestBlockTime ? oldestBlockTime * 1000 : null
}

export default function CapsulesEntryPage() {
  const wallet = useWallet()
  const { publicKey, connected } = wallet
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<DashboardFilter>('all')
  const [rows, setRows] = useState<BeneficiaryTableRow[]>([])
  const [triggerValue, setTriggerValue] = useState(0)
  const [triggerUnit, setTriggerUnit] = useState<TriggerUnit>('Minutes')
  const [triggerProgress, setTriggerProgress] = useState(0)
  const [assetUnit, setAssetUnit] = useState('units')
  const [capsuleStatus, setCapsuleStatus] = useState<CapsuleStatus | null>(null)
  const deferredQuery = useDeferredValue(query.trim().toLowerCase())

  useEffect(() => {
    let cancelled = false

    if (!connected || !publicKey) {
      setRows([])
      setTriggerValue(0)
      setTriggerUnit('Minutes')
      setTriggerProgress(0)
      setAssetUnit('units')
      setCapsuleStatus(null)
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    Promise.all([getCapsule(publicKey), getCapsuleCreatedAt(getCapsulePDA(publicKey)[0].toBase58())])
      .then(([capsule, createdAtMs]) => {
        if (cancelled) return
        if (!capsule) {
          setRows([])
          setTriggerValue(0)
          setTriggerUnit('Minutes')
          setTriggerProgress(0)
          setAssetUnit('units')
          setCapsuleStatus(null)
          return
        }

        const [capsulePda] = getCapsulePDA(publicKey)
        const capsuleAddress = capsulePda.toBase58()
        const intent = capsule.intentData ? parseIntentPayload(capsule.intentData) : null
        const status = computeStatus(capsule)
        const hasSplMint = Boolean(capsule.mint && !capsule.mint.equals(PublicKey.default))
        const lastActivityMs = capsule.lastActivity ? capsule.lastActivity * 1000 : null
        const releaseAtMs = capsule.lastActivity
          ? (capsule.lastActivity + capsule.inactivityPeriod) * 1000
          : null
        const totalSeconds = Math.max(60, capsule.inactivityPeriod)
        const remainingSeconds = capsule.executedAt || !releaseAtMs
          ? 0
          : Math.max(0, Math.ceil((releaseAtMs - Date.now()) / 1000))
        const triggerDisplay = formatTriggerDisplay(remainingSeconds, totalSeconds)

        setCapsuleStatus(status)
        setTriggerValue(triggerDisplay.value)
        setTriggerUnit(triggerDisplay.unit)
        setTriggerProgress(
          status === 'Executed'
            ? 100
            : Math.min(100, Math.max(0, ((totalSeconds - remainingSeconds) / totalSeconds) * 100))
        )

        const nextRows: BeneficiaryTableRow[] = []

        if (isTokenIntent(intent) && Array.isArray(intent.beneficiaries) && intent.beneficiaries.length > 0) {
          const totalAmount = intent.totalAmount
          setAssetUnit(hasSplMint ? 'token' : 'SOL')
          intent.beneficiaries.forEach((beneficiary: Beneficiary, index) => {
            const amountLabel = formatBeneficiaryAmount(beneficiary.amount, beneficiary.amountType)
            const onChainAmount = computeOnChainBeneficiaryAmount(totalAmount, beneficiary.amount, beneficiary.amountType)
            nextRows.push({
              id: `${capsuleAddress}-${beneficiary.address}-${index}`,
              index: index + 1,
              capsuleAddress,
              transactionId: maskAddress(capsuleAddress, 4, 4),
              status,
              address: beneficiary.address,
              amount: amountLabel,
              token: beneficiary.chain === 'evm' ? 'EVM' : hasSplMint ? 'Token' : 'Solana',
              onChainAmount,
              totalAllocatedAmount: totalAmount ? formatNumber(totalAmount) : '--',
              createdDate: formatDateLabel(createdAtMs),
              releaseDate: formatDateLabel(releaseAtMs),
            })
          })
        } else if (isNftIntent(intent) && Array.isArray(intent.nftRecipients) && intent.nftRecipients.length > 0) {
          setAssetUnit('NFT')
          intent.nftRecipients.forEach((recipient, index) => {
            nextRows.push({
              id: `${capsuleAddress}-${recipient}-${index}`,
              index: index + 1,
              capsuleAddress,
              transactionId: maskAddress(capsuleAddress, 4, 4),
              status,
              address: recipient,
              amount: '1',
              token: 'NFT',
              onChainAmount: '1',
              totalAllocatedAmount: `${intent.nftRecipients.length}`,
              createdDate: formatDateLabel(createdAtMs),
              releaseDate: formatDateLabel(releaseAtMs),
            })
          })
        } else {
          setAssetUnit(hasSplMint ? 'token' : 'SOL')
          nextRows.push({
            id: capsuleAddress,
            index: 1,
            capsuleAddress,
            transactionId: maskAddress(capsuleAddress, 4, 4),
            status,
            address: publicKey.toBase58(),
            amount: '--',
            token: hasSplMint ? 'Token' : 'Solana',
            onChainAmount: '--',
            totalAllocatedAmount: '--',
            createdDate: formatDateLabel(createdAtMs),
            releaseDate: formatDateLabel(releaseAtMs),
          })
        }

        setRows(nextRows)
      })
      .catch((fetchError) => {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : 'Failed to load your capsule dashboard')
          setRows([])
          setTriggerValue(0)
          setTriggerUnit('Minutes')
          setTriggerProgress(0)
          setAssetUnit('units')
          setCapsuleStatus(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [connected, publicKey])

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const matchesFilter = filter === 'all' || row.status.toLowerCase() === filter
      const matchesQuery =
        deferredQuery.length === 0 ||
        row.transactionId.toLowerCase().includes(deferredQuery) ||
        row.address.toLowerCase().includes(deferredQuery) ||
        row.token.toLowerCase().includes(deferredQuery) ||
        row.status.toLowerCase().includes(deferredQuery)

      return matchesFilter && matchesQuery
    })
  }, [deferredQuery, filter, rows])

  const totals = useMemo(() => {
    const totalAllocated = rows[0]?.totalAllocatedAmount
      ? Number(rows[0].totalAllocatedAmount.replace(/[^0-9.]/g, ''))
      : 0

    return {
      totalAllocated: Number.isFinite(totalAllocated) ? totalAllocated : 0,
      beneficiaries: rows.length,
      activeCapsules: capsuleStatus === 'Active' ? 1 : 0,
    }
  }, [capsuleStatus, rows])

  const recentActivity = useMemo(() => {
    if (rows.length === 0) return []
    const releaseDate = rows[0]?.releaseDate && rows[0].releaseDate !== '--' ? rows[0].releaseDate : null
    return [
      `${assetUnit} capsule ${capsuleStatus ? capsuleStatus.toLowerCase() : 'created'}`,
      releaseDate ? `Release window ${releaseDate}` : 'Waiting for trigger window',
      `${totals.beneficiaries} beneficiary${totals.beneficiaries === 1 ? '' : 'ies'} configured`,
    ]
  }, [assetUnit, capsuleStatus, rows, totals.beneficiaries])

  if (!connected) {
    return (
      <div className="min-h-screen bg-[#070b1d] pt-24 pb-16 px-4 text-Heres-white">
        <div className="mx-auto max-w-lg">
          <div className="rounded-[28px] border border-cyan-400/45 bg-[#0f1430] p-8 shadow-[0_0_0_1px_rgba(34,211,238,0.08)]">
            <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-400/35 bg-cyan-400/10">
              <Wallet className="h-6 w-6 text-cyan-300" />
            </div>
            <h1 className="text-3xl font-semibold">My Capsule</h1>
            <p className="mt-3 text-sm text-slate-300">
              Connect your wallet to see the beneficiary dashboard and open the full capsule detail page from the list.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <div className="wallet-menu-container flex justify-center sm:justify-start">
                <WalletMultiButton />
              </div>
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-400/35 bg-transparent px-5 py-3 text-sm font-medium text-cyan-300 transition hover:bg-cyan-400/10"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#070b1d] text-white">
      <main className="px-4 pb-16 pt-28 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-[1240px]">
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/5 px-4 py-2 text-sm font-medium text-cyan-300 transition hover:bg-cyan-400/10"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
          </div>

          {error && (
            <div className="mb-4 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          <section className="proto-panel relative mb-5 overflow-hidden p-6 sm:p-8">
            <div className="proto-hero-blob left-[-18%] top-[-38%] opacity-65" aria-hidden />
            <div className="relative grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
              <div>
                <p className="proto-label">My Capsules</p>
                <h1 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-white sm:text-6xl">
                  My Capsule
                  <br />
                  Dashboard
                </h1>
                <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300">
                  Monitor release clocks, beneficiary routing, and active allocations from the capsule tied to this wallet.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="proto-grid-card p-5 sm:col-span-2">
                  <p className="proto-label">Recent Activity</p>
                  {recentActivity.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      {recentActivity.map((item, index) => (
                        <div key={item} className="flex items-center justify-between border-b border-white/8 pb-3 text-sm text-slate-300 last:border-b-0 last:pb-0">
                          <span className="flex items-center gap-3">
                            <span className={`h-2.5 w-2.5 rounded-full ${index === 2 ? 'bg-red-500' : 'bg-green-500'}`} />
                            {item}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-slate-300">Create a capsule to begin tracking beneficiary events.</p>
                  )}
                </div>
                <div className="proto-grid-card p-5">
                  <p className="proto-label">Beneficiaries</p>
                  <p className="mt-3 text-3xl font-semibold text-white">{totals.beneficiaries}</p>
                </div>
                <div className="proto-grid-card p-5">
                  <p className="proto-label">Asset Unit</p>
                  <p className="mt-3 text-3xl font-semibold text-cyan-300">{assetUnit}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-3 grid gap-3 lg:grid-cols-3">
            <div className="proto-grid-card px-5 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-slate-500">Total Assets Allocated</p>
                  <p className="mt-2 text-[34px] font-semibold leading-none text-white">
                    {rows.length ? `${formatNumber(totals.totalAllocated)} ${assetUnit}` : `0 ${assetUnit}`}
                  </p>
                  <p className="mt-2 text-sm text-slate-400">Estimated amount currently routed to beneficiaries.</p>
                </div>
                <span className="pt-1 text-cyan-300">+</span>
              </div>
            </div>

            <div className="proto-grid-card px-5 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-slate-500">Capsules</p>
                  <p className="mt-2 text-[34px] font-semibold leading-none text-white">{totals.activeCapsules}</p>
                  <p className="mt-2 text-sm text-slate-400">Active capsule count for the connected wallet.</p>
                </div>
                <span className="pt-1 text-cyan-300">+</span>
              </div>
            </div>

            <div className="proto-grid-card px-5 py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="w-full">
                  <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-slate-500">Trigger Time</p>
                  <p className="mt-2 flex items-end gap-2 text-white">
                    <span className="text-[34px] font-semibold leading-none">{triggerValue}</span>
                    <span className="pb-0.5 text-[16px] font-medium text-slate-200">{triggerUnit}</span>
                  </p>
                  <p className="mt-1 text-[16px] leading-none text-slate-200">
                    {capsuleStatus === 'Executed' ? 'Execution Complete' : 'To Inactivity'}
                  </p>
                  <div className="mt-3 h-[6px] rounded-full border border-cyan-400/35 bg-transparent p-[1px]">
                    <div className="h-full rounded-full bg-cyan-300" style={{ width: `${triggerProgress}%` }} />
                  </div>
                  <p className="mt-3 text-sm text-slate-400">Assets release automatically after the inactivity clock completes.</p>
                </div>
                <span className="pt-1 text-cyan-300">+</span>
              </div>
            </div>
          </section>

          <section className="proto-outline-panel rounded-[18px] px-3 pb-3 pt-2 shadow-[0_0_0_1px_rgba(17,24,50,0.65)]">
            <div className="mb-2 flex flex-col gap-3 px-2 pt-1 md:flex-row md:items-center md:justify-between">
              <h2 className="text-[34px] font-medium tracking-[-0.02em] text-white">My Beneficiaries</h2>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Link
                  href="/create"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-5 py-2.5 text-sm font-medium text-cyan-200 transition hover:bg-cyan-400/16"
                >
                  Create Capsule
                </Link>
                <div className="inline-flex items-center gap-2 rounded-full border border-[#233154] bg-[#0f1730] px-5 py-2.5 text-sm text-slate-400">
                  <Search className="h-4 w-4" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search"
                    className="w-full bg-transparent outline-none placeholder:text-slate-500 sm:w-[140px]"
                  />
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[#233154] bg-[#0f1730] px-4 py-2.5 text-sm text-slate-300">
                  <span>Filter by</span>
                  <SlidersHorizontal className="h-4 w-4 text-slate-400" />
                  <select
                    value={filter}
                    onChange={(event) => setFilter(event.target.value as DashboardFilter)}
                    className="bg-transparent outline-none"
                  >
                    {FILTERS.map((option) => (
                      <option key={option.key} value={option.key} className="bg-[#0f1730] text-white">
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-[16px] border border-[#1b2947]">
              <div className="hidden grid-cols-[60px_1.5fr_1.2fr_1.1fr_0.8fr_0.9fr_0.95fr_1fr_1fr] gap-4 bg-[#141d38] px-5 py-4 text-[15px] font-medium text-slate-400 lg:grid">
                <span>#</span>
                <span>Capsule Transaction ID</span>
                <span>Transaction Status</span>
                <span>Address</span>
                <span>Amount</span>
                <span>Token</span>
                <span>On-chain Amount</span>
                <span>Date Created</span>
                <span>Release Date</span>
              </div>

              {loading ? (
                <div className="px-5 py-8 text-sm text-slate-400">Loading beneficiary dashboard...</div>
              ) : filteredRows.length === 0 ? (
                <div className="px-5 py-8 text-sm text-slate-400">
                  {rows.length === 0 ? 'No beneficiaries found yet for this capsule.' : 'No beneficiaries match the current search/filter.'}
                </div>
              ) : (
                <>
                  <div className="hidden lg:block">
                    {filteredRows.map((row) => (
                      <Link
                        key={row.id}
                        href={`/capsules/${row.capsuleAddress}`}
                        className="grid grid-cols-[60px_1.5fr_1.2fr_1.1fr_0.8fr_0.9fr_0.95fr_1fr_1fr] gap-4 border-t border-[#182341] bg-[#11192f] px-5 py-4 text-[15px] text-white transition hover:bg-[#14203a]"
                      >
                        <span>{row.index}</span>
                        <span>{row.transactionId}</span>
                        <span className={row.status === 'Active' ? 'text-[#35d16f]' : row.status === 'Expired' ? 'text-amber-300' : 'text-cyan-300'}>
                          {statusText(row.status)}
                        </span>
                        <span title={row.address}>{maskAddress(row.address, 5, 3)}</span>
                        <span>{row.amount}</span>
                        <span>{row.token}</span>
                        <span>{row.onChainAmount}</span>
                        <span>{row.createdDate}</span>
                        <span>{row.releaseDate}</span>
                      </Link>
                    ))}
                  </div>

                  <div className="space-y-3 p-3 lg:hidden">
                    {filteredRows.map((row) => (
                      <Link
                        key={row.id}
                        href={`/capsules/${row.capsuleAddress}`}
                        className="block rounded-[16px] border border-[#1b2947] bg-[#11192f] p-4 transition hover:bg-[#14203a]"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-white">{row.transactionId}</p>
                          <span className={row.status === 'Active' ? 'text-[#35d16f]' : row.status === 'Expired' ? 'text-amber-300' : 'text-cyan-300'}>
                            {statusText(row.status)}
                          </span>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-slate-300">
                          <span>{maskAddress(row.address, 5, 3)}</span>
                          <span>{row.amount} {row.token}</span>
                          <span>{row.onChainAmount}</span>
                          <span>{row.releaseDate}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
