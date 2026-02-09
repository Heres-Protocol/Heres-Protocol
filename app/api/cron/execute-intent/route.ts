/**
 * Cron endpoint: run crank to execute all eligible capsules (conditions met).
 * Call this at intervals (e.g. every 5??5 min) via Vercel Cron or external cron.
 * Set CRANK_WALLET_PRIVATE_KEY (base58, base64, or JSON array of 64 bytes) and optionally
 * CRON_SECRET for auth.
 */

import { NextRequest, NextResponse } from 'next/server'
import { Keypair } from '@solana/web3.js'
import bs58 from 'bs58'
import { runCrank } from '@/lib/crank'

function getCrankKeypair(): Keypair | null {
  const raw = process.env.CRANK_WALLET_PRIVATE_KEY
  if (!raw || raw.length < 32) return null
  try {
    if (raw.startsWith('[')) {
      const arr = JSON.parse(raw) as number[]
      if (arr.length !== 64) return null
      return Keypair.fromSecretKey(Uint8Array.from(arr))
    }
    if (/^[1-9A-HJ-NP-Za-km-z]+$/.test(raw)) {
      return Keypair.fromSecretKey(bs58.decode(raw))
    }
    return Keypair.fromSecretKey(Buffer.from(raw, 'base64'))
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  return handleCron(request)
}

export async function POST(request: NextRequest) {
  return handleCron(request)
}

async function handleCron(request: NextRequest) {
  const auth = request.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const keypair = getCrankKeypair()
  if (!keypair) {
    return NextResponse.json(
      { error: 'CRANK_WALLET_PRIVATE_KEY not set or invalid' },
      { status: 500 }
    )
  }

  try {
    const result = await runCrank(keypair)
    return NextResponse.json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
