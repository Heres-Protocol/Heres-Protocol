/**
 * Application constants
 */

// Solana Configuration
export const SOLANA_CONFIG = {
  PROGRAM_ID: process.env.NEXT_PUBLIC_PROGRAM_ID || 'AmiL7vEZ2SpAuDXzdxC3sJMyjZqgacvwvvQdT3qosmsW',
  NETWORK: process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet',
  HELIUS_API_KEY: process.env.NEXT_PUBLIC_HELIUS_API_KEY || '',
  RPC_URL: process.env.SOLANA_RPC_URL || '',
  FALLBACK_RPC_URL:
    process.env.SOLANA_FALLBACK_RPC_URL ||
    process.env.NEXT_PUBLIC_SOLANA_FALLBACK_RPC_URL ||
    'https://api.devnet.solana.com',
  /** Platform wallet for creation/execution fees */
  PLATFORM_FEE_RECIPIENT: process.env.NEXT_PUBLIC_PLATFORM_FEE_RECIPIENT || 'Covn3moA8qstPgXPgueRGMSmi94yXvuDCWTjQVBxHpzb',
  CRANK_WALLET_PUBLIC_KEY: process.env.NEXT_PUBLIC_CRANK_WALLET_PUBLIC_KEY || '8DzPUhZ8Jd6Rfu9R7QWuZ7gMBjdrnrjH22FHyfDUPeHW',
} as const

// Helius API Configuration
export const HELIUS_CONFIG = {
  BASE_URL: 'https://api-devnet.helius-rpc.com/v0',
  RPC_URL: SOLANA_CONFIG.RPC_URL
    ? SOLANA_CONFIG.RPC_URL
    : SOLANA_CONFIG.HELIUS_API_KEY
      ? `https://devnet.helius-rpc.com/?api-key=${SOLANA_CONFIG.HELIUS_API_KEY}`
      : 'https://api.devnet.solana.com',
  RPC_URL_ALT: SOLANA_CONFIG.FALLBACK_RPC_URL || 'https://api.devnet.solana.com',
  RPC_URL_DEVNET: 'https://api.devnet.solana.com',
} as const

// Default Values
export const DEFAULT_VALUES = {
  INACTIVITY_DAYS: '365',
  DELAY_DAYS: '30',
} as const

/** Platform fee: creation = 0.05 SOL, execution = 3% of transferred amount */
export const PLATFORM_FEE = {
  CREATION_FEE_SOL: 0.05,
  CREATION_FEE_LAMPORTS: 50_000_000,
  EXECUTION_FEE_BPS: 300,
} as const

// Magicblock ER (Ephemeral Rollup) - Devnet validators
export const MAGICBLOCK_ER = {
  DELEGATION_PROGRAM_ID: 'DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh',
  MAGIC_PROGRAM_ID: process.env.NEXT_PUBLIC_MAGIC_PROGRAM_ID || 'Magic11111111111111111111111111111111111111',
  BUFFER_SEED_PROGRAM_ID:
    process.env.NEXT_PUBLIC_BUFFER_SEED_PROGRAM_ID ||
    process.env.NEXT_PUBLIC_PROGRAM_ID ||
    'AmiL7vEZ2SpAuDXzdxC3sJMyjZqgacvwvvQdT3qosmsW',
  MAGIC_CONTEXT: process.env.NEXT_PUBLIC_MAGIC_CONTEXT || 'MagicContext1111111111111111111111111111111',
  ER_RPC_URL: process.env.NEXT_PUBLIC_ER_RPC_URL || 'https://devnet-as.magicblock.app',
  ER_WS_URL: process.env.NEXT_PUBLIC_ER_WS_URL || 'wss://devnet-as.magicblock.app',
  ROUTER_DEVNET: 'https://devnet-router.magicblock.app',
  ROUTER_WS: 'wss://devnet-router.magicblock.app',
  ACTIVE_VALIDATOR: process.env.NEXT_PUBLIC_ER_VALIDATOR || 'MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57',
  VALIDATOR_ASIA: 'MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57',
  VALIDATOR_EU: 'MEUGGrYPxKk17hCr7wpT6s8dtNokZj5U2L57vjYMS8e',
  VALIDATOR_US: 'MUS3hc9TCw4cGC12vHNoYcCGzJG1txjgQLZWVoeNHNd',
  VALIDATOR_TEE: 'FnE6VJT5QNZdedZPnCoLsARgBwoE6DeJNjBs2H1gySXA',
  PERMISSION_PROGRAM_ID: 'ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1',
  CRANK_DEFAULT_INTERVAL_MS: 10000,
  CRANK_DEFAULT_ITERATIONS: 100_000,
} as const

/** Ephemeral Rollup endpoints - ER (Asia devnet primary) + TEE (PER fallback) */
export const PER_TEE = {
  RPC_URL: process.env.NEXT_PUBLIC_ER_RPC_URL || 'https://devnet-as.magicblock.app',
  TEE_RPC_URL: process.env.NEXT_PUBLIC_TEE_RPC_URL || 'https://tee.magicblock.app',
  AUTH_URL: process.env.NEXT_PUBLIC_TEE_AUTH_URL || 'https://tee.magicblock.app',
  DOCS_URL: 'https://docs.magicblock.gg/pages/ephemeral-rollups-ers/introduction',
} as const

export const MAX_CAPSULE_MODIFICATIONS = 3

export const STORAGE_KEYS = {
  CAPSULE_INTENT: (address: string, id: string | number) => `capsule_intent_${address}_${id}`,
  CAPSULE_CREATION_TX: (address: string) => `capsule_creation_tx_${address}`,
  CAPSULE_CREATION_TX_WITH_SIG: (address: string, signature: string) => `capsule_creation_tx_${address}_${signature}`,
  CAPSULE_EXECUTION_TX: (address: string) => `capsule_execution_tx_${address}`,
  CAPSULE_EXECUTION_TX_WITH_SIG: (address: string, signature: string) => `capsule_execution_tx_${address}_${signature}`,
  EXECUTED_CAPSULES: (address: string) => `executed_capsules_${address}`,
  CAPSULE_MODIFY_COUNT: (address: string) => `capsule_modify_count_${address}`,
} as const
