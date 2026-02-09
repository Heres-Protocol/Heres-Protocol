/**
 * Application constants
 */

// Solana Configuration
export const SOLANA_CONFIG = {
  PROGRAM_ID: process.env.NEXT_PUBLIC_PROGRAM_ID || 'CXVKwAjzQA95MPVyEbsMqSoFgHvbXAmSensTk6JJPKsM',
  NETWORK: process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet',
  HELIUS_API_KEY: process.env.NEXT_PUBLIC_HELIUS_API_KEY || '',
  /** Platform wallet for creation/execution fees (?섏닔猷??섎졊 吏媛? */
  PLATFORM_FEE_RECIPIENT: process.env.NEXT_PUBLIC_PLATFORM_FEE_RECIPIENT || 'Covn3moA8qstPgXPgueRGMSmi94yXvuDCWTjQVBxHpzb',
} as const

// Helius API Configuration
export const HELIUS_CONFIG = {
  // Devnet Enhanced Transactions API
  BASE_URL: 'https://api-devnet.helius-rpc.com/v0',
  // Devnet RPC endpoint
  RPC_URL: SOLANA_CONFIG.HELIUS_API_KEY
    ? `https://devnet.helius-rpc.com/?api-key=${SOLANA_CONFIG.HELIUS_API_KEY}`
    : 'https://api.devnet.solana.com',
  // Alternative RPC endpoints for fallback
  RPC_URL_ALT: 'https://api.devnet.solana.com',
} as const

// Default Values
export const DEFAULT_VALUES = {
  INACTIVITY_DAYS: '365',
  DELAY_DAYS: '30',
} as const

/** Platform fee: creation = 0.05 SOL, execution = 3% of transferred amount (init_fee_config ???ъ슜) */
export const PLATFORM_FEE = {
  /** 罹≪뒓 ?앹꽦 ?섏닔猷? 0.05 SOL (lamports) */
  CREATION_FEE_SOL: 0.05,
  CREATION_FEE_LAMPORTS: 50_000_000, // 0.05 * 1e9
  /** ?ㅽ뻾 ?섏닔猷? 3% (basis points, 10000 = 100%) */
  EXECUTION_FEE_BPS: 300, // 3%
} as const

// Magicblock ER (Ephemeral Rollup) - Devnet validators
export const MAGICBLOCK_ER = {
  DELEGATION_PROGRAM_ID: 'DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh',
  /** Magic program ID for crank ScheduleTask CPI (matches ephemeral_rollups_sdk::consts::MAGIC_PROGRAM_ID) */
  MAGIC_PROGRAM_ID: process.env.NEXT_PUBLIC_MAGIC_PROGRAM_ID || 'Magic11111111111111111111111111111111111111',
  /** Magic context PDA for commit/undelegate CPI */
  MAGIC_CONTEXT: process.env.NEXT_PUBLIC_MAGIC_CONTEXT || 'Magic11111111111111111111111111111111111111',
  ROUTER_DEVNET: 'https://devnet-router.magicblock.app',
  ROUTER_WS: 'wss://devnet-router.magicblock.app',
  VALIDATOR_ASIA: 'MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57',
  VALIDATOR_EU: 'MEUGGrYPxKk17hCr7wpT6s8dtNokZj5U2L57vjYMS8e',
  VALIDATOR_US: 'MUS3hc9TCw4cGC12vHNoYcCGzJG1txjgQLZWVoeNHNd',
  /** TEE validator for Private Ephemeral Rollup (PER); used by default when delegating for privacy */
  VALIDATOR_TEE: 'FnE6VJT5QNZdedZPnCoLsARgBwoE6DeJNjBs2H1gySXA',
} as const

/** Private Ephemeral Rollup (PER) - TEE RPC for confidential state; use getAuthToken + ?token= for access */
export const PER_TEE = {
  /** TEE RPC base URL (devnet). Attach token: `${url}?token=${authToken}` */
  RPC_URL: process.env.NEXT_PUBLIC_TEE_RPC_URL || 'https://devnet.magicblock.app/rpc/tee',
  /** Docs page (clickable link; RPC URL is API-only and shows "Not found" in browser) */
  DOCS_URL: 'https://docs.magicblock.gg/pages/tools/tee/introduction',
} as const

// Local Storage Keys
export const STORAGE_KEYS = {
  CAPSULE_INTENT: (address: string, id: string | number) => `capsule_intent_${address}_${id}`,
  CAPSULE_CREATION_TX: (address: string) => `capsule_creation_tx_${address}`,
  CAPSULE_CREATION_TX_WITH_SIG: (address: string, signature: string) => `capsule_creation_tx_${address}_${signature}`,
  CAPSULE_EXECUTION_TX: (address: string) => `capsule_execution_tx_${address}`,
  CAPSULE_EXECUTION_TX_WITH_SIG: (address: string, signature: string) => `capsule_execution_tx_${address}_${signature}`,
  EXECUTED_CAPSULES: (address: string) => `executed_capsules_${address}`,
} as const
