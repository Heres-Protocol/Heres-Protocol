/**
 * Solana configuration and utilities
 */

import { Connection, PublicKey } from '@solana/web3.js'
import { SOLANA_CONFIG, HELIUS_CONFIG, PER_TEE } from '@/constants'

let cachedConnection: Connection | null = null

/**
 * Get Solana connection with Helius RPC (cached to avoid duplicate instances and reduce RPC pressure).
 * Use Helius when API key is set; otherwise fallback to public RPC (rate-limited).
 */
export function getSolanaConnection(): Connection {
  if (cachedConnection) return cachedConnection

  const rpcUrl = HELIUS_CONFIG.RPC_URL
  try {
    cachedConnection = new Connection(rpcUrl, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 120000,
      httpHeaders: { 'Content-Type': 'application/json' },
    })
  } catch {
    const fallbackUrl = HELIUS_CONFIG.RPC_URL_ALT
    cachedConnection = new Connection(fallbackUrl, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 120000,
    })
  }
  return cachedConnection
}

/**
 * Get program ID as PublicKey
 */
export function getProgramId(): PublicKey {
  return new PublicKey(SOLANA_CONFIG.PROGRAM_ID)
}

/**
 * Validate Solana address
 */
export function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address)
    return true
  } catch {
    return false
  }
}

/**
 * TEE RPC connection for Private Ephemeral Rollup (PER).
 * Use after getTeeAuthToken; pass token so PER state can be queried.
 */
export function getTeeConnection(authToken: string): Connection {
  const url = `${PER_TEE.RPC_URL}?token=${encodeURIComponent(authToken)}`
  return new Connection(url, {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 120000,
  })
}
