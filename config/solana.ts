/**
 * Solana configuration and utilities
 */

import { Connection, PublicKey } from '@solana/web3.js'
import { SOLANA_CONFIG, HELIUS_CONFIG, PER_TEE, MAGICBLOCK_ER } from '@/constants'

let cachedPrimaryConnection: Connection | null = null
let cachedFallbackConnection: Connection | null = null

function createConnection(rpcUrl: string): Connection {
  const wsEndpoint = rpcUrl.startsWith('https://') ? rpcUrl.replace('https://', 'wss://') : undefined
  return new Connection(rpcUrl, {
    commitment: 'confirmed',
    ...(wsEndpoint ? { wsEndpoint } : {}),
    disableRetryOnRateLimit: true,
  })
}

export function getSolanaConnection(): Connection {
  if (cachedPrimaryConnection) return cachedPrimaryConnection
  cachedPrimaryConnection = createConnection(HELIUS_CONFIG.RPC_URL)
  return cachedPrimaryConnection
}

export function getSolanaFallbackConnection(): Connection {
  if (cachedFallbackConnection) return cachedFallbackConnection
  cachedFallbackConnection = createConnection(HELIUS_CONFIG.RPC_URL_ALT)
  return cachedFallbackConnection
}

export function getSolanaRpcUrls() {
  return {
    primary: HELIUS_CONFIG.RPC_URL,
    fallback: HELIUS_CONFIG.RPC_URL_ALT,
  }
}

export function getErConnection(): Connection {
  return new Connection(MAGICBLOCK_ER.ER_RPC_URL, {
    commitment: 'confirmed',
    wsEndpoint: MAGICBLOCK_ER.ER_WS_URL,
  })
}

export function getTeeConnection(token?: string): Connection {
  const url = token ? `${PER_TEE.TEE_RPC_URL}?token=${token}` : PER_TEE.TEE_RPC_URL
  return new Connection(url, {
    commitment: 'confirmed',
  })
}

export function getProgramId(): PublicKey {
  return new PublicKey(SOLANA_CONFIG.PROGRAM_ID)
}

export function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address)
    return true
  } catch {
    return false
  }
}
