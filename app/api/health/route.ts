import { NextResponse } from 'next/server'
import { HELIUS_CONFIG, SOLANA_CONFIG } from '@/constants'

type CheckStatus = 'pass' | 'warn' | 'fail'

type HealthCheck = {
  status: CheckStatus
  summary: string
}

function getStoreBackend(): string {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return 'upstash-redis'
  }
  if (process.env.DATABASE_URL) {
    return 'database-configured'
  }
  if (process.env.CRE_STORE_PATH?.trim()) {
    return 'file-path'
  }
  return 'local-file-default'
}

function getChecks() {
  const checks: Record<string, HealthCheck> = {
    app: { status: 'pass', summary: 'Application server is responding.' },
    solana: {
      status: HELIUS_CONFIG.RPC_URL ? 'pass' : 'fail',
      summary: `Network=${SOLANA_CONFIG.NETWORK}, rpc=${HELIUS_CONFIG.RPC_URL || 'missing'}`,
    },
    automationAuth: {
      status: process.env.CRON_SECRET?.trim() ? 'pass' : 'fail',
      summary: process.env.CRON_SECRET?.trim()
        ? 'Cron endpoints are protected by bearer auth.'
        : 'CRON_SECRET is missing.',
    },
    crankWallet: {
      status: process.env.CRANK_WALLET_PRIVATE_KEY?.trim() ? 'pass' : 'warn',
      summary: process.env.CRANK_WALLET_PRIVATE_KEY?.trim()
        ? 'Crank signer is configured.'
        : 'CRANK_WALLET_PRIVATE_KEY is missing; automated execution cannot run on this instance.',
    },
    creDispatch: {
      status: process.env.CHAINLINK_CRE_WEBHOOK_URL?.trim() ? 'pass' : 'warn',
      summary: process.env.CHAINLINK_CRE_WEBHOOK_URL?.trim()
        ? 'CRE delivery webhook is configured.'
        : 'CHAINLINK_CRE_WEBHOOK_URL is missing; off-chain secret delivery is disabled.',
    },
    creStore: {
      status: getStoreBackend() === 'local-file-default' ? 'warn' : 'pass',
      summary: `CRE store backend=${getStoreBackend()}`,
    },
  }

  return checks
}

export async function GET() {
  const checks = getChecks()
  const statuses = Object.values(checks).map((check) => check.status)
  const status = statuses.includes('fail') ? 'fail' : statuses.includes('warn') ? 'warn' : 'pass'

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      network: SOLANA_CONFIG.NETWORK,
      checks,
    },
    { status: status === 'fail' ? 503 : 200 }
  )
}
