import { NextRequest, NextResponse } from 'next/server'
import { buildUpdateActivityUnsignedTx } from '@/lib/mobile-tx'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const owner = typeof body?.owner === 'string' ? body.owner : ''

    const unsigned = await buildUpdateActivityUnsignedTx(owner)

    return NextResponse.json({
      ...unsigned,
      message: 'Unsigned update_activity transaction generated. Sign and send via Solana Mobile Wallet Adapter.',
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to build unsigned update_activity tx' },
      { status: 400 }
    )
  }
}
