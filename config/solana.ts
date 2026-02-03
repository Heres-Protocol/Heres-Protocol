/**
 * Solana configuration and utilities
 */

import { Connection, PublicKey } from '@solana/web3.js'
import { SOLANA_CONFIG, HELIUS_CONFIG, PER_TEE } from '@/constants'

/**
 * Get Solana connection with Helius RPC
 * Enhanced with better timeout and retry handling
 */
export function getSolanaConnection(): Connection {
  // Helius RPC URL with API key in query parameter
  // Use Helius if API key is available, otherwise fallback to public RPC
  const rpcUrl = HELIUS_CONFIG.RPC_URL
  
  // Mask API key in logs
  const maskedUrl = rpcUrl.replace(/api-key=[^&]+/, 'api-key=***')
  console.log('Creating Solana connection to:', maskedUrl)
  
  try {
    return new Connection(rpcUrl, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 120000, // 120 seconds
      httpHeaders: {
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    console.error('Error creating connection with Helius RPC, trying fallback:', error)
    // Fallback to public Solana RPC
    const fallbackUrl = HELIUS_CONFIG.RPC_URL_ALT
    console.log('Using fallback RPC:', fallbackUrl)
    return new Connection(fallbackUrl, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 120000,
    })
  }
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
