import { NextRequest, NextResponse } from 'next/server'
import { getDashboardSnapshot } from '@/lib/dashboard'

export async function GET(request: NextRequest) {
  try {
    const forceRefresh = request.nextUrl.searchParams.get('refresh') === '1'
    const includeHistory = request.nextUrl.searchParams.get('history') === '1'
    const fullScan = request.nextUrl.searchParams.get('full') === '1'
    const snapshot = await getDashboardSnapshot(forceRefresh, includeHistory, fullScan)
    return NextResponse.json(snapshot)
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to load dashboard snapshot' },
      { status: 500 }
    )
  }
}
