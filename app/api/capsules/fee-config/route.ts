import { NextRequest, NextResponse } from 'next/server'
import { ensureDashboardPrewarmScheduler, getFeeConfigStatus } from '@/lib/dashboard'

export async function GET(request: NextRequest) {
  try {
    ensureDashboardPrewarmScheduler()
    const forceRefresh = request.nextUrl.searchParams.get('refresh') === '1'
    const exists = await getFeeConfigStatus(forceRefresh)
    return NextResponse.json({ exists })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to load fee config status' },
      { status: 500 }
    )
  }
}
