import { NextRequest, NextResponse } from 'next/server'
import { ensureDashboardPrewarmScheduler, getCapsuleDetail } from '@/lib/dashboard'

export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    ensureDashboardPrewarmScheduler()
    const forceRefresh = request.nextUrl.searchParams.get('refresh') === '1'
    const id = decodeURIComponent(context.params.id)
    const payload = await getCapsuleDetail(id, forceRefresh)

    if (!payload) {
      return NextResponse.json({ error: 'Capsule not found' }, { status: 404 })
    }

    return NextResponse.json(payload)
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to load capsule detail' },
      { status: 500 }
    )
  }
}
