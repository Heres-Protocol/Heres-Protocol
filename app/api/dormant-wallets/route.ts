import { NextResponse } from 'next/server'
import { PublicKey } from '@solana/web3.js'
import { getSolanaConnection, getProgramId } from '@/config/solana'

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60
const SERIES_POINTS = 6
const SOL_PRICE_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'

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
  offset += 4 + intentDataLength
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
    isActive,
    executedAt,
  }
}

const monthLabel = (date: Date) =>
  date.toLocaleString('en-US', { month: 'short' })

const emptyResponse = () =>
  NextResponse.json({
    series: [0, 0, 0, 0, 0, 0],
    labels: (() => {
      const out: string[] = []
      for (let i = SERIES_POINTS - 1; i >= 0; i -= 1) {
        const d = new Date()
        d.setMonth(d.getMonth() - i * 2)
        out.push(monthLabel(d))
      }
      return out
    })(),
    dormantCount: 0,
    estimatedAssetsUsd: 0,
    estimatedAssetsSol: 0,
    priceUsd: 0,
    source: 'lucid-program',
  })

export async function GET() {
  try {
    const connection = getSolanaConnection()
    const programId = getProgramId()
    let accounts: { account: { data: Uint8Array } }[] = []
    try {
      accounts = await connection.getProgramAccounts(programId, {
        commitment: 'confirmed',
      })
    } catch (rpcError) {
      console.error('RPC getProgramAccounts failed:', rpcError)
      return emptyResponse()
    }

    const ownerLastActivity = new Map<string, number>()
    for (const account of accounts) {
      const decoded = decodeCapsuleAccount(account.account.data)
      if (!decoded) continue
      const owner = decoded.owner.toBase58()
      const lastActivity = decoded.lastActivity || 0
      const current = ownerLastActivity.get(owner)
      if (!current || lastActivity > current) {
        ownerLastActivity.set(owner, lastActivity)
      }
    }

    const nowSeconds = Math.floor(Date.now() / 1000)
    const dormantOwners = Array.from(ownerLastActivity.entries()).filter(
      ([, lastActivity]) => nowSeconds - lastActivity >= ONE_YEAR_SECONDS
    )

    const balances = await Promise.all(
      dormantOwners.map(async ([owner]) => {
        try {
          const balance = await connection.getBalance(new PublicKey(owner))
          return balance
        } catch {
          return 0
        }
      })
    )

    const totalLamports = balances.reduce((sum, val) => sum + val, 0)
    const totalSol = totalLamports / 1_000_000_000

    let solPrice = 0
    try {
      const priceResponse = await fetch(SOL_PRICE_URL, { cache: 'no-store' })
      const priceData = await priceResponse.json()
      solPrice = priceData?.solana?.usd ?? 0
    } catch {
      solPrice = 0
    }

    const totalUsd = solPrice ? totalSol * solPrice : 0

    const series: number[] = []
    const labels: string[] = []
    for (let i = SERIES_POINTS - 1; i >= 0; i -= 1) {
      const pointDate = new Date()
      pointDate.setMonth(pointDate.getMonth() - i * 2)
      const pointSeconds = Math.floor(pointDate.getTime() / 1000)
      const threshold = pointSeconds - ONE_YEAR_SECONDS
      const count = Array.from(ownerLastActivity.values()).filter(
        (lastActivity) => lastActivity <= threshold
      ).length
      series.push(count)
      labels.push(monthLabel(pointDate))
    }

    return NextResponse.json({
      series,
      labels,
      dormantCount: dormantOwners.length,
      estimatedAssetsUsd: totalUsd,
      estimatedAssetsSol: totalSol,
      priceUsd: solPrice,
      source: 'lucid-program',
    })
  } catch (error: unknown) {
    console.error('Failed to load dormant wallet stats:', error)
    return emptyResponse()
  }
}
