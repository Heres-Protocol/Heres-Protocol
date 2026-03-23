import { NextRequest, NextResponse } from 'next/server'
import { PublicKey } from '@solana/web3.js'
import { getRegisteredOwners } from '@/lib/capsule-registry'
import { getCapsule } from '@/lib/solana'
import { getCapsulePDA } from '@/lib/program'
import { computeCapsuleStatus, validateWalletQuery } from '@/lib/mobile'

export async function GET(request: NextRequest) {
  try {
    const wallet = request.nextUrl.searchParams.get('wallet')
    const validation = validateWalletQuery(wallet)
    if (!validation.ok) {
      return NextResponse.json({
        wallet: null,
        summary: { total: 0, active: 0, executed: 0, expired: 0 },
        items: [],
      })
    }

    try {
      new PublicKey(wallet!)
    } catch {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 })
    }

    const ownerSet = new Set<string>()
    ownerSet.add(wallet!)

    if (process.env.NODE_ENV !== 'production' && request.nextUrl.searchParams.get('includeRegistered') === '1') {
      const owners = await getRegisteredOwners()
      owners.forEach((owner) => ownerSet.add(owner))
    }

    const settled = await Promise.allSettled(
      Array.from(ownerSet).map(async (owner) => {
        const ownerKey = new PublicKey(owner)
        const capsule = await getCapsule(ownerKey)
        if (!capsule) return null

        const [capsulePda] = getCapsulePDA(ownerKey)
        const status = computeCapsuleStatus({
          isActive: capsule.isActive,
          lastActivity: capsule.lastActivity,
          inactivityPeriod: capsule.inactivityPeriod,
          executedAt: capsule.executedAt,
        })

        return {
          capsuleAddress: capsulePda.toBase58(),
          owner,
          status,
          inactivitySeconds: capsule.inactivityPeriod,
          lastActivityAt: capsule.lastActivity * 1000,
          executedAt: capsule.executedAt ? capsule.executedAt * 1000 : null,
          nextInactivityDeadline: (capsule.lastActivity + capsule.inactivityPeriod) * 1000,
        }
      })
    )

    const items = settled
      .filter((result): result is PromiseFulfilledResult<{
        capsuleAddress: string
        owner: string
        status: 'active' | 'expired' | 'executed' | 'inactive'
        inactivitySeconds: number
        lastActivityAt: number
        executedAt: number | null
        nextInactivityDeadline: number
      } | null> => result.status === 'fulfilled')
      .map((result) => result.value)
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => b.lastActivityAt - a.lastActivityAt)

    const summary = {
      total: items.length,
      active: items.filter((item) => item.status === 'active').length,
      executed: items.filter((item) => item.status === 'executed').length,
      expired: items.filter((item) => item.status === 'expired').length,
    }

    return NextResponse.json({
      wallet,
      summary,
      items,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch dashboard capsules' },
      { status: 500 }
    )
  }
}
