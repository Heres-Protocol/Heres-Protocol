'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { PublicKey } from '@solana/web3.js'
import { useWallet } from '@solana/wallet-adapter-react'
import { ArrowLeft, Copy, RefreshCw, Shield, Play, X } from 'lucide-react'
import {
  getCapsuleByAddress,
  delegateCapsule,
  undelegateCapsule,
  cancelCapsule,
  deactivateCapsule,
  executeIntent,
  scheduleExecuteIntent,
  distributeAssets,
  restartTimer,
} from '@/lib/solana'
import { getCapsuleVaultPDA } from '@/lib/program'
import { getProgramId, getSolanaConnection } from '@/config/solana'
import { SOLANA_CONFIG, MAGICBLOCK_ER, PER_TEE, PLATFORM_FEE } from '@/constants'
import { TEE_AUTH } from '@/lib/tee'
import { parseIntentPayload, secondsToDays } from '@/utils/intent'
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
  const [delegatePending, setDelegatePending] = useState(false)
  const [delegateTx, setDelegateTx] = useState<string | null>(null)
  const [delegateError, setDelegateError] = useState<string | null>(null)
  const [schedulePending, setSchedulePending] = useState(false)
  const [scheduleTx, setScheduleTx] = useState<string | null>(null)
  const [scheduleError, setScheduleError] = useState<string | null>(null)
  const [executePending, setExecutePending] = useState(false)
  const [executeTx, setExecuteTx] = useState<string | null>(null)
  const [executeError, setExecuteError] = useState<string | null>(null)
  const [distributePending, setDistributePending] = useState(false)
  const [distributeTx, setDistributeTx] = useState<string | null>(null)
  const [distributeError, setDistributeError] = useState<string | null>(null)
  const [teeAuthToken, setTeeAuthToken] = useState<string | null>(null)
  const [isTeeAuthenticated, setIsTeeAuthenticated] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [undelegatePending, setUndelegatePending] = useState(false)
  const [undelegateTx, setUndelegateTx] = useState<string | null>(null)
  const [undelegateError, setUndelegateError] = useState<string | null>(null)
  const [cancelPending, setCancelPending] = useState(false)
  const [cancelTx, setCancelTx] = useState<string | null>(null)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [deactivatePending, setDeactivatePending] = useState(false)
  const [deactivateTx, setDeactivateTx] = useState<string | null>(null)
  const [deactivateError, setDeactivateError] = useState<string | null>(null)
  const [restartPending, setRestartPending] = useState(false)
  const [restartTx, setRestartTx] = useState<string | null>(null)
  const [restartError, setRestartError] = useState<string | null>(null)
  const [creDeliveryStatus, setCreDeliveryStatus] = useState<{
    status: string
    updatedAt: number
    idempotencyKey: string
    lastError?: string
  } | null>(null)
  const [creDeliveryLoading, setCreDeliveryLoading] = useState(false)
  const [creDeliveryError, setCreDeliveryError] = useState<string | null>(null)

  const isOwner = Boolean(wallet.connected && wallet.publicKey && capsule?.owner && capsule.owner.equals(wallet.publicKey))

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
        if (!teeAuthToken) {
          console.log('[STEP 1] Fetching TEE authentication token...')
          try {
            currentToken = await TEE_AUTH.getAuthToken(wallet)
            setTeeAuthToken(currentToken)
            setIsTeeAuthenticated(true)
            console.log('[STEP 1] TEE Authentication successful')
          } catch (error: any) {
            const errorMsg = error?.message || String(error)
            console.warn('[STEP 1] TEE Authentication failed:', errorMsg)

            if (errorMsg.includes('UserKeyring not found')) {
              setDelegateError('TEE authentication failed: Wallet keyring not found. Please try re-connecting your wallet or refreshing the page.')
            } else if (errorMsg.includes('signMessage')) {
              setDelegateError('TEE authentication failed: Wallet refused to sign the authentication message.')
            } else {
              setDelegateError(`TEE authentication failed: ${errorMsg}. Privacy features may be limited.`)
            }
            // We proceed even if auth fails, but scheduling might fail later if ER requires it
          }
        } else {
          console.log('[STEP 1] Reusing existing TEE authentication token')
          currentToken = teeAuthToken
        }
      } catch (wrapperError) {
        console.error('[STEP 1] Unexpected error during TEE auth check:', wrapperError)
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
        // PASS the owner and token here
        const signature = await scheduleExecuteIntent(
          wallet,
          capsule.owner,
          undefined,
          currentToken || undefined
        );
        setScheduleTx(signature)
        console.log('[STEP 2] ✓ Crank scheduled successfully. Tx:', signature)
      } catch (e: any) {
        let msg = e?.message || String(e)
        let logs = e.logs || (typeof e.getLogs === 'function' ? e.getLogs() : null);
        if (logs instanceof Promise) {
          try {
            logs = await logs;
          } catch (err) {
            console.error('[STEP 2] Failed to get logs via getLogs():', err);
            logs = null;
          }
        }
        if (logs && Array.isArray(logs)) {
          console.error('[STEP 2] Transaction Logs:', logs)
          const errorLog = logs.find((log: string) => log.includes('Error:'))
          if (errorLog) msg += ` (Log: ${errorLog.split('Error:')[1].trim()})`
        }
        console.error('[STEP 2] ✗ Scheduling failed:', msg)
        setScheduleError(`Crank scheduling failed: ${msg}. Check console for full logs.`)
      }
    } catch (e: any) {
      const msg = e?.message || String(e)
      console.error('[STEP 1] ✗ Delegation failed:', msg)
      setDelegateError(`Delegation failed: ${msg}`)
    } finally {
      setDelegatePending(false)
      setSchedulePending(false)
    }
  }, [wallet, capsule, teeAuthToken])

  const handleUndelegate = useCallback(async () => {
    if (!wallet.publicKey || !wallet.signTransaction || !capsule) return
    if (!confirm('Are you sure you want to undelegate this capsule from the Ephemeral Rollup? This will commit state back to the base layer.')) return

    setUndelegatePending(true)
    setUndelegateError(null)
    setUndelegateTx(null)
    try {
      const tx = await undelegateCapsule(wallet)
      setUndelegateTx(tx)
      console.log('[undelegateCapsule] Success. Tx:', tx)

      // Refresh capsule data after undelegation
      await new Promise(resolve => setTimeout(resolve, 3000))
      const pubkey = new PublicKey(capsule.capsuleAddress)
      const updated = await getCapsuleByAddress(pubkey)
      if (updated) setCapsule(updated)
    } catch (e: any) {
      setUndelegateError(e?.message || String(e))
    } finally {
      setUndelegatePending(false)
    }
  }, [wallet, capsule])

  const handleCancelCapsule = useCallback(async () => {
    if (!wallet.publicKey || !wallet.signTransaction || !capsule) return
    if (!confirm('Are you sure you want to cancel this capsule? This will close the capsule account and reclaim all SOL from the vault.')) return

    setCancelPending(true)
    setCancelError(null)
    setCancelTx(null)
    try {
      const tx = await cancelCapsule(wallet)
      setCancelTx(tx)
      console.log('[cancelCapsule] Success. Tx:', tx)

      // Refresh capsule data
      const pubkey = new PublicKey(capsule.capsuleAddress)
      const updated = await getCapsuleByAddress(pubkey)
      if (updated) setCapsule(updated)
    } catch (e: any) {
      setCancelError(e?.message || String(e))
    } finally {
      setCancelPending(false)
    }
  }, [wallet, capsule])

  const handleDeactivate = useCallback(async () => {
    if (!wallet.publicKey || !wallet.signTransaction || !capsule) return
    if (!confirm('Are you sure you want to deactivate this capsule? It will no longer execute when conditions are met.')) return

    setDeactivatePending(true)
    setDeactivateError(null)
    setDeactivateTx(null)
    try {
      const tx = await deactivateCapsule(wallet)
      setDeactivateTx(tx)
      console.log('[deactivateCapsule] Success. Tx:', tx)

      const pubkey = new PublicKey(capsule.capsuleAddress)
      const updated = await getCapsuleByAddress(pubkey)
      if (updated) setCapsule(updated)
    } catch (e: any) {
      setDeactivateError(e?.message || String(e))
    } finally {
      setDeactivatePending(false)
    }
  }, [wallet, capsule])

  const intentParsed = useMemo(() => {
    if (!capsule?.intentData) return null
    return parseIntentData(capsule.intentData)
  }, [capsule?.intentData])

  const handleRestartTimer = useCallback(async () => {
    if (!wallet.publicKey || !capsule) return
    if (!confirm('Are you sure you want to reset the inactivity timer? This will set the last activity to now.')) return

    setRestartPending(true)
    setRestartError(null)
    setRestartTx(null)
    try {
      const tx = await restartTimer(wallet, capsule.owner)
      setRestartTx(tx)
      console.log('[restartTimer] ✓ Timer reset successful. Tx:', tx)

      const pubkey = new PublicKey(capsule.capsuleAddress)
      const updated = await getCapsuleByAddress(pubkey)
      if (updated) setCapsule(updated)
    } catch (e: any) {
      setRestartError(e?.message || String(e))
    } finally {
      setRestartPending(false)
    }
  }, [wallet, capsule])

  const handleExecute = useCallback(async () => {
    if (!wallet.connected || !wallet.publicKey || !capsule) return

    setExecutePending(true)
    setExecuteError(null)
    setExecuteTx(null)
    try {
      // Step 1: Execute intent (State update on ER/Base)
      const tx = await executeIntent(wallet, capsule.owner, undefined, capsule.mint)
      setExecuteTx(tx)
      console.log('[executeIntent] ✓ State update successful. Tx:', tx)

      // Refresh capsule data
      const pubkey = new PublicKey(capsule.capsuleAddress)
      const updated = await getCapsuleByAddress(pubkey)
      if (updated) setCapsule(updated)
    } catch (e: unknown) {
      setExecuteError(e instanceof Error ? e.message : String(e))
    } finally {
      setExecutePending(false)
    }
  }, [wallet, capsule])

  const handleDistribute = useCallback(async () => {
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
      setDistributeError('No beneficiaries in intent data')
      return
    }

    setDistributePending(true)
    setDistributeError(null)
    setDistributeTx(null)
    try {
      // Step 2: Distribute assets (Base-layer payout)
      const tx = await distributeAssets(wallet, capsule.owner, beneficiaries, capsule.mint)
      setDistributeTx(tx)
      console.log('[distributeAssets] ✓ Distribution successful. Tx:', tx)

      // Refresh capsule data
      const pubkey = new PublicKey(capsule.capsuleAddress)
      const updated = await getCapsuleByAddress(pubkey)
      if (updated) setCapsule(updated)
    } catch (e: unknown) {
      setDistributeError(e instanceof Error ? e.message : String(e))
    } finally {
      setDistributePending(false)
    }
  }, [wallet, capsule, intentParsed])


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
                {(status === 'Expired' || status === 'Active') && (
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={handleExecute}
                      disabled={executePending || !wallet.connected}
                      className="inline-flex items-center gap-2 rounded-lg border border-Heres-accent bg-Heres-accent/20 px-4 py-2 text-sm font-medium text-Heres-accent transition hover:bg-Heres-accent/30 disabled:opacity-60"
                    >
                      <Play className="h-4 w-4" />
                      {executePending ? 'Executing…' : 'Execute Intent'}
                    </button>
                    {executeTx && (
                      <a
                        href={`https://explorer.solana.com/tx/${executeTx}?cluster=${SOLANA_CONFIG.NETWORK || 'devnet'}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-Heres-accent hover:underline"
                      >
                        ✓ Intent executed. View tx
                      </a>
                    )}
                    {executeError && <p className="text-xs text-red-400">{executeError}</p>}
                  </div>
                )}

                {status === 'Executed' && (
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={handleDistribute}
                      disabled={distributePending || !wallet.connected}
                      className="inline-flex items-center gap-2 rounded-lg bg-Heres-purple/20 border border-Heres-purple px-4 py-2 text-sm font-medium text-Heres-purple transition hover:bg-Heres-purple/30 disabled:opacity-60"
                    >
                      <Shield className="h-4 w-4" />
                      {distributePending ? 'Distributing…' : 'Distribute Assets'}
                    </button>
                    {distributeTx && (
                      <a
                        href={`https://explorer.solana.com/tx/${distributeTx}?cluster=${SOLANA_CONFIG.NETWORK || 'devnet'}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-Heres-purple hover:underline"
                      >
                        ✓ Assets distributed. View tx
                      </a>
                    )}
                    {distributeError && <p className="text-xs text-red-400">{distributeError}</p>}
                  </div>
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
                    {delegatePending ? 'Step 1: Delegating...' : schedulePending ? 'Step 2: Scheduling...' : 'Delegate & Schedule Crank'}
                  </button>

                  <button
                    type="button"
                    onClick={handleRestartTimer}
                    disabled={restartPending}
                    className="inline-flex items-center gap-2 rounded-lg border border-Heres-purple/50 bg-Heres-purple/10 px-4 py-2 text-sm font-medium text-Heres-purple transition hover:bg-Heres-purple/20 disabled:opacity-60"
                    title="Auto-restart placeholder: resets inactivity timer"
                  >
                    <RefreshCw className={`h-4 w-4 ${restartPending ? 'animate-spin' : ''}`} />
                    {restartPending ? 'Restarting...' : 'Restart Inactivity Timer'}
                  </button>

                  <button
                    type="button"
                    onClick={handleUndelegate}
                    disabled={undelegatePending}
                    className="inline-flex items-center gap-2 rounded-lg border border-amber-400/50 bg-amber-400/10 px-4 py-2 text-sm font-medium text-amber-400 transition hover:bg-amber-400/20 disabled:opacity-60"
                    title="Commit state from ER and undelegate back to Solana base layer"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    {undelegatePending ? 'Undelegating...' : 'Undelegate from ER'}
                  </button>

                  <button
                    type="button"
                    onClick={handleDeactivate}
                    disabled={deactivatePending}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-400/50 bg-red-400/10 px-4 py-2 text-sm font-medium text-red-400 transition hover:bg-red-400/20 disabled:opacity-60"
                    title="Deactivate capsule (stop execution)"
                  >
                    <X className="h-4 w-4" />
                    {deactivatePending ? 'Deactivating...' : 'Deactivate'}
                  </button>

                  <button
                    type="button"
                    onClick={handleCancelCapsule}
                    disabled={cancelPending}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-500 transition hover:bg-red-500/20 disabled:opacity-60"
                    title="Cancel and close capsule, reclaim SOL"
                  >
                    <X className="h-4 w-4" />
                    {cancelPending ? 'Cancelling...' : 'Cancel & Reclaim SOL'}
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

                {/* Undelegate Status */}
                {undelegateTx && (
                  <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-3">
                    <p className="text-xs font-semibold text-amber-400 mb-1">✓ Undelegation Complete</p>
                    <p className="text-xs text-Heres-muted mb-2">Capsule committed and undelegated from Ephemeral Rollup</p>
                    <a
                      href={`https://explorer.solana.com/tx/${undelegateTx}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-amber-400 hover:underline"
                    >
                      View undelegation tx →
                    </a>
                  </div>
                )}
                {undelegateError && (
                  <div className="rounded-lg border border-red-400/30 bg-red-400/5 p-3">
                    <p className="text-xs font-semibold text-red-400 mb-1">✗ Undelegation Failed</p>
                    <p className="text-xs text-red-400">{undelegateError}</p>
                  </div>
                )}

                {/* Deactivate Status */}
                {deactivateTx && (
                  <div className="rounded-lg border border-red-400/30 bg-red-400/5 p-3">
                    <p className="text-xs font-semibold text-red-400 mb-1">✓ Capsule Deactivated</p>
                    <a
                      href={`https://explorer.solana.com/tx/${deactivateTx}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-red-400 hover:underline"
                    >
                      View tx →
                    </a>
                  </div>
                )}
                {deactivateError && (
                  <div className="rounded-lg border border-red-400/30 bg-red-400/5 p-3">
                    <p className="text-xs font-semibold text-red-400 mb-1">✗ Deactivation Failed</p>
                    <p className="text-xs text-red-400">{deactivateError}</p>
                  </div>
                )}

                {/* Cancel Status */}
                {cancelTx && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
                    <p className="text-xs font-semibold text-red-500 mb-1">✓ Capsule Cancelled</p>
                    <p className="text-xs text-Heres-muted mb-2">SOL reclaimed from vault and account closed</p>
                    <a
                      href={`https://explorer.solana.com/tx/${cancelTx}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-red-500 hover:underline"
                    >
                      View tx →
                    </a>
                  </div>
                )}
                {cancelError && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
                    <p className="text-xs font-semibold text-red-500 mb-1">✗ Cancel Failed</p>
                    <p className="text-xs text-red-500">{cancelError}</p>
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
