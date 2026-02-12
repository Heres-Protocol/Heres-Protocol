/**
 * Solana configuration and utilities
 */

import { Connection, PublicKey } from '@solana/web3.js'
import { SOLANA_CONFIG, HELIUS_CONFIG, PER_TEE, MAGICBLOCK_ER } from '@/constants'

let cachedConnection: Connection | null = null

/**
 * Get Solana connection using Magic Router (Dynamic Routing).
 * Routes transactions to Ephemeral Rollup or Base Layer automatically.
 */
export function getSolanaConnection(): Connection {
  if (cachedConnection) return cachedConnection

  const rpcUrl = MAGICBLOCK_ER.ROUTER_DEVNET
  const wsUrl = MAGICBLOCK_ER.ROUTER_WS

  cachedConnection = new Connection(rpcUrl, {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 120000,
    wsEndpoint: wsUrl,
  })

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
