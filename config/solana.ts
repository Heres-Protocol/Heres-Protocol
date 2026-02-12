/**
 * Solana configuration and utilities
 */

import { Connection, PublicKey } from '@solana/web3.js'
import { SOLANA_CONFIG, HELIUS_CONFIG, PER_TEE, MAGICBLOCK_ER } from '@/constants'

let cachedConnection: Connection | null = null

/**
 * Get Solana connection with Helius RPC (Base Layer).
 * Use Helius when API key is set; otherwise fallback to public RPC.
 */
export function getSolanaConnection(): Connection {
  if (cachedConnection) return cachedConnection

  const rpcUrl = HELIUS_CONFIG.RPC_URL
  cachedConnection = new Connection(rpcUrl, {
    commitment: 'confirmed',
    wsEndpoint: HELIUS_CONFIG.RPC_URL.replace('https', 'wss'),
  })
  return cachedConnection
}

let cachedTeeConnection: Connection | null = null

/**
 * Get direct TEE RPC connection for delegated state queries.
 */
export function getTeeConnection(): Connection {
  if (cachedTeeConnection) return cachedTeeConnection

  cachedTeeConnection = new Connection(PER_TEE.RPC_URL, {
    commitment: 'confirmed',
  })
  return cachedTeeConnection
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
