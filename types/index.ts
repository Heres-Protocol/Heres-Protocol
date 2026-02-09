/**
 * Type definitions for Heres project
 */

import { PublicKey } from '@solana/web3.js'

// Beneficiary types
export interface Beneficiary {
  address: string
  amount: string
  amountType: 'fixed' | 'percentage'
}

// Intent Capsule types
export interface IntentCapsule {
  owner: PublicKey
  inactivityPeriod: number
  lastActivity: number
  intentData: Uint8Array
  isActive: boolean
  executedAt: number | null
  accountOwner?: PublicKey
  mint?: PublicKey
}

// Wallet Activity types
export interface WalletActivity {
  wallet: string
  lastSignature: string
  lastActivityTimestamp: number
  transactionCount: number
}
