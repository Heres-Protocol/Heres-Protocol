import { NextRequest, NextResponse } from 'next/server'
import { PublicKey } from '@solana/web3.js'
import { getCapsule } from '@/lib/solana'
import { getCapsulePDA } from '@/lib/program'
import { computeCapsuleStatus, validateWalletQuery } from '@/lib/mobile'

export async function GET(request: NextRequest) {
  try {
    const wallet = request.nextUrl.searchParams.get('wallet')
    const validation = validateWalletQuery(wallet)
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const owner = new PublicKey(wallet!)
    const capsule = await getCapsule(owner)

    if (!capsule) {
      return NextResponse.json({ wallet, items: [] })
    }

    const [capsulePda] = getCapsulePDA(owner)
    const status = computeCapsuleStatus({
      isActive: capsule.isActive,
      lastActivity: capsule.lastActivity,
      inactivityPeriod: capsule.inactivityPeriod,
      executedAt: capsule.executedAt,
    })

    const item = {
      capsuleAddress: capsulePda.toBase58(),
      owner: wallet!,
      status,
      inactivitySeconds: capsule.inactivityPeriod,
      lastActivityAt: capsule.lastActivity * 1000,
      executedAt: capsule.executedAt ? capsule.executedAt * 1000 : null,
      nextInactivityDeadline: (capsule.lastActivity + capsule.inactivityPeriod) * 1000,
    }

    return NextResponse.json({ wallet, items: [item] })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch capsules' },
      { status: 500 }
    )
  }
}
