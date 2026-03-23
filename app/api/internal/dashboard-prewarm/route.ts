import { NextRequest, NextResponse } from 'next/server'
import { ensureDashboardPrewarmScheduler, triggerDashboardPrewarm } from '@/lib/dashboard'

function isCronRequest(request: NextRequest): boolean {
  const userAgent = request.headers.get('user-agent') || ''
  return userAgent.includes('vercel-cron/1.0')
}

function isAuthorized(request: NextRequest): boolean {
  const token = process.env.DASHBOARD_PREWARM_TOKEN || process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  const headerToken = request.headers.get('x-prewarm-token')

  if (token) {
    return authHeader === `Bearer ${token}` || headerToken === token
  }

  return isCronRequest(request)
}

async function handleIndex(request: NextRequest, defaultForceRefresh: boolean) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const forceParam = request.nextUrl.searchParams.get('force')
  const forceRefresh = forceParam == null ? defaultForceRefresh : forceParam === '1'

  ensureDashboardPrewarmScheduler()
  await triggerDashboardPrewarm(forceRefresh)

  return NextResponse.json({
    ok: true,
    forced: forceRefresh,
    warmedAt: Date.now(),
  })
}

export async function GET(request: NextRequest) {
  try {
    return await handleIndex(request, true)
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to index dashboard cache' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    return await handleIndex(request, true)
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to index dashboard cache' },
      { status: 500 }
    )
  }
}
