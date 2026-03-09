import { NextRequest, NextResponse } from 'next/server'
import { buildCreateCapsuleUnsignedTx } from '@/lib/mobile-tx'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const owner = typeof body?.owner === 'string' ? body.owner : ''
    const totalSol = typeof body?.totalSol === 'string' ? body.totalSol : ''
    const inactivityDays = Number(body?.inactivityDays)
    const beneficiaryAddress = typeof body?.beneficiaryAddress === 'string' ? body.beneficiaryAddress : ''
    const beneficiaryAmountSol = typeof body?.beneficiaryAmountSol === 'string' ? body.beneficiaryAmountSol : ''
    const intent = typeof body?.intent === 'string' ? body.intent : undefined

    const unsigned = await buildCreateCapsuleUnsignedTx({
      owner,
      totalSol,
      inactivityDays,
      beneficiaryAddress,
      beneficiaryAmountSol,
      intent,
    })

    return NextResponse.json({
      ...unsigned,
      message: 'Unsigned create_capsule transaction generated. Sign and send via Solana Mobile Wallet Adapter.',
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to build unsigned create tx' },
      { status: 400 }
    )
  }
}
