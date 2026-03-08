import { NextRequest, NextResponse } from 'next/server'
import { PublicKey } from '@solana/web3.js'
import { registerCapsuleOwner } from '@/lib/capsule-registry'

export async function POST(request: NextRequest) {
  try {
    const { owner } = await request.json()
    if (!owner || typeof owner !== 'string') {
      return NextResponse.json({ error: 'owner required' }, { status: 400 })
    }
    // Validate it's a valid pubkey
    new PublicKey(owner)
    await registerCapsuleOwner(owner)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: 'invalid owner' }, { status: 400 })
  }
}
