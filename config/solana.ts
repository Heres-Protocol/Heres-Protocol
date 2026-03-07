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
    disableRetryOnRateLimit: true,
  })
  return cachedConnection
}

/**
 * Get ER RPC connection (Asia devnet) for delegated state queries and scheduling.
 */
export function getErConnection(): Connection {
  return new Connection(MAGICBLOCK_ER.ER_RPC_URL, {
    commitment: 'confirmed',
    wsEndpoint: MAGICBLOCK_ER.ER_WS_URL,
  })
}

/**
 * Get direct TEE RPC connection for PER (private) flows.
 */
export function getTeeConnection(token?: string): Connection {
  const url = token ? `${PER_TEE.TEE_RPC_URL}?token=${token}` : PER_TEE.TEE_RPC_URL
  return new Connection(url, {
    commitment: 'confirmed',
  })
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
