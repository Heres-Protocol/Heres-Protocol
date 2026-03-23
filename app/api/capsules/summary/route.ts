import { NextRequest, NextResponse } from 'next/server'
import { ensureDashboardPrewarmScheduler, getCapsulesSummary } from '@/lib/dashboard'

export async function GET(request: NextRequest) {
  try {
    ensureDashboardPrewarmScheduler()
    const forceRefresh = request.nextUrl.searchParams.get('refresh') === '1'
    const payload = await getCapsulesSummary(forceRefresh)
    return NextResponse.json(payload)
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to load capsule summary' },
      { status: 500 }
    )
  }
}
