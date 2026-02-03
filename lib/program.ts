/**
 * Solana program utilities
 */

import { PublicKey } from '@solana/web3.js'
import { getProgramId } from '@/config/solana'

/**
 * Derive capsule PDA (Program Derived Address)
 */
export function getCapsulePDA(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('intent_capsule'), owner.toBuffer()],
    getProgramId()
  )
}

/**
 * Derive fee config PDA (platform fee config, seeds = ["fee_config"])
 */
export function getFeeConfigPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('fee_config')],
    getProgramId()
  )
}

/**
 * Derive capsule vault PDA (holds locked SOL, seeds = ["capsule_vault", owner])
 */
export function getCapsuleVaultPDA(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('capsule_vault'), owner.toBuffer()],
    getProgramId()
  )
}
