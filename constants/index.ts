/**
 * Application constants
 */

// Solana Configuration
export const SOLANA_CONFIG = {
  PROGRAM_ID: process.env.NEXT_PUBLIC_PROGRAM_ID || 'BiAB1qZpx8kDgS5dJxKFdCJDNMagCn8xfj4afNhRZWms',
  NETWORK: process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet',
  HELIUS_API_KEY: process.env.NEXT_PUBLIC_HELIUS_API_KEY || '',
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

// Magicblock ER (Ephemeral Rollup) - Devnet validators
export const MAGICBLOCK_ER = {
  DELEGATION_PROGRAM_ID: 'DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh',
  /** Magic program ID for crank ScheduleTask CPI (see ephemeral_rollups_sdk consts) */
  MAGIC_PROGRAM_ID: process.env.NEXT_PUBLIC_MAGIC_PROGRAM_ID || 'MPUxHCpNUy3K1CSVhebAmTbcTCKVxfk9YMDcUP2ZnEA',
  /** Magic context PDA for commit/undelegate CPI; override via env if different on your cluster */
  MAGIC_CONTEXT: process.env.NEXT_PUBLIC_MAGIC_CONTEXT || 'MPUxHCpNUy3K1CSVhebAmTbcTCKVxfk9YMDcUP2ZnEA',
  ROUTER_DEVNET: 'https://devnet-router.magicblock.app',
  ROUTER_WS: 'wss://devnet-router.magicblock.app',
  VALIDATOR_ASIA: 'MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57',
  VALIDATOR_EU: 'MEUGGrYPxKk17hCr7wpT6s8dtNokZj5U2L57vjYMS8e',
  VALIDATOR_US: 'MUS3hc9TCw4cGC12vHNoYcCGzJG1txjgQLZWVoeNHNd',
  VALIDATOR_TEE: 'FnE6VJT5QNZdedZPnCoLsARgBwoE6DeJNjBs2H1gySXA',
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
