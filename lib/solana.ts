/**
 * Solana program interaction utilities
 */

import { SystemProgram, PublicKey } from '@solana/web3.js'
import { Program, AnchorProvider, Wallet, BN } from '@coral-xyz/anchor'
import { WalletContextState } from '@solana/wallet-adapter-react'
import idl from '../idl/lucid_program.json'
import { getSolanaConnection, getProgramId } from '@/config/solana'
import { getCapsulePDA, getFeeConfigPDA, getCapsuleVaultPDA } from './program'
import { getTeeConnection } from './tee'
import { SOLANA_CONFIG, PLATFORM_FEE } from '@/constants'
import { MAGICBLOCK_ER } from '@/constants'
import type { IntentCapsule } from '@/types'

/** Default crank: run execute_intent check every 15 min, up to 100k iterations (MagicBlock Crank). */
export const CRANK_DEFAULT_INTERVAL_MS = 15 * 60 * 1000
export const CRANK_DEFAULT_ITERATIONS = 100_000

// Re-export connection function
export { getSolanaConnection as getConnection }

/**
 * Get Anchor provider
 */
export function getProvider(wallet: WalletContextState): AnchorProvider | null {
  if (!wallet.publicKey || !wallet.signTransaction) {
    return null
  }

  const connection = getSolanaConnection()
  
  const walletAdapter = {
    publicKey: wallet.publicKey,
    signTransaction: wallet.signTransaction,
    signAllTransactions: wallet.signAllTransactions,
  } as Wallet

  return new AnchorProvider(connection, walletAdapter, {
    commitment: 'confirmed',
  })
}

/**
 * Get Anchor program instance
 */
export function getProgram(wallet: WalletContextState): Program | null {
  const provider = getProvider(wallet)
  if (!provider) return null

  // Anchor 0.30.0+: Program constructor only needs idl and provider
  // The programId is included in the IDL's address field
  return new Program(idl as any, provider)
}

/**
 * Create a new Intent Capsule with retry logic for RPC errors
 */
export async function createCapsule(
  wallet: WalletContextState,
  inactivityPeriodSeconds: number,
  intentData: Uint8Array
): Promise<string> {
  const program = getProgram(wallet)
  if (!program) throw new Error('Wallet not connected')

  const [capsulePDA] = getCapsulePDA(wallet.publicKey!)

  // Convert Uint8Array to Buffer for Anchor (required by Blob.encode)
  // In browser environment, use Buffer polyfill or convert to number array
  let intentDataBuffer: Buffer | number[]
  if (typeof Buffer !== 'undefined') {
    intentDataBuffer = Buffer.from(intentData)
  } else {
    // Fallback for environments without Buffer
    intentDataBuffer = Array.from(intentData)
  }

  // Retry logic for RPC errors (503, service unavailable, etc.)
  const maxRetries = 5
  let lastError: any

  const [feeConfigPDA] = getFeeConfigPDA()
  const [vaultPDA] = getCapsuleVaultPDA(wallet.publicKey!)
  const platformFeeRecipient = SOLANA_CONFIG.PLATFORM_FEE_RECIPIENT
    ? new PublicKey(SOLANA_CONFIG.PLATFORM_FEE_RECIPIENT)
    : null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const accounts: {
        capsule: PublicKey
        vault: PublicKey
        owner: PublicKey
        feeConfig: PublicKey
        platformFeeRecipient?: PublicKey
        systemProgram: PublicKey
      } = {
        capsule: capsulePDA,
        vault: vaultPDA,
        owner: wallet.publicKey!,
        feeConfig: feeConfigPDA,
        systemProgram: SystemProgram.programId,
      }
      if (platformFeeRecipient) accounts.platformFeeRecipient = platformFeeRecipient

      const tx = await program.methods
        .createCapsule(new BN(inactivityPeriodSeconds), intentDataBuffer)
        .accounts(accounts)
        .rpc()

      return tx
    } catch (error: any) {
      lastError = error
      
      // Check if it's a retryable RPC error
      const errorMessage = error?.message || ''
      const isRetryableError = 
        errorMessage.includes('503') ||
        errorMessage.includes('Service unavailable') ||
        errorMessage.includes('failed to get recent blockhash') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('network')
      
      if (isRetryableError && attempt < maxRetries - 1) {
        // Wait before retry (exponential backoff: 2s, 4s, 8s, 16s)
        const delay = Math.min(2000 * Math.pow(2, attempt), 16000)
        console.log(`RPC error (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
      
      // If it's not a retryable error or max retries reached, throw
      throw error
    }
  }

  // If all retries failed, throw with a user-friendly message
  if (lastError?.message?.includes('503') || lastError?.message?.includes('Service unavailable')) {
    throw new Error('RPC 서버가 일시적으로 사용 불가능합니다. 잠시 후 다시 시도해주세요.\nRPC server is temporarily unavailable. Please try again in a few moments.')
  }
  
  throw lastError
}

/**
 * Update intent data
 */
export async function updateIntent(
  wallet: WalletContextState,
  newIntentData: Uint8Array
): Promise<string> {
  const program = getProgram(wallet)
  if (!program) throw new Error('Wallet not connected')

  const [capsulePDA] = getCapsulePDA(wallet.publicKey!)

  // Convert Uint8Array to Buffer for Anchor (required by Blob.encode)
  let intentDataBuffer: Buffer | number[]
  if (typeof Buffer !== 'undefined') {
    intentDataBuffer = Buffer.from(newIntentData)
  } else {
    // Fallback for environments without Buffer
    intentDataBuffer = Array.from(newIntentData)
  }

  const tx = await program.methods
    .updateIntent(intentDataBuffer)
    .accounts({
      capsule: capsulePDA,
      owner: wallet.publicKey!,
    })
    .rpc()

  return tx
}

/**
 * Execute intent when inactivity period is met. Anyone can call (no owner signature required).
 * Caller pays tx fee; SOL is transferred from capsule vault to platform (fee) and beneficiaries.
 */
export async function executeIntent(
  wallet: WalletContextState,
  ownerPublicKey: PublicKey,
  beneficiaries?: Array<{ address: string; amount: string; amountType: string }>
): Promise<string> {
  const program = getProgram(wallet)
  if (!program) throw new Error('Wallet not connected')

  const [capsulePDA] = getCapsulePDA(ownerPublicKey)
  const [vaultPDA] = getCapsuleVaultPDA(ownerPublicKey)
  const [feeConfigPDA] = getFeeConfigPDA()
  const platformFeeRecipient = SOLANA_CONFIG.PLATFORM_FEE_RECIPIENT
    ? new PublicKey(SOLANA_CONFIG.PLATFORM_FEE_RECIPIENT)
    : null

  const accounts: {
    capsule: PublicKey
    vault: PublicKey
    systemProgram: PublicKey
    feeConfig: PublicKey
    platformFeeRecipient?: PublicKey
  } = {
    capsule: capsulePDA,
    vault: vaultPDA,
    systemProgram: SystemProgram.programId,
    feeConfig: feeConfigPDA,
  }
  if (platformFeeRecipient) accounts.platformFeeRecipient = platformFeeRecipient

  const remainingAccounts = beneficiaries?.map(b => ({
    pubkey: new PublicKey(b.address),
    isSigner: false,
    isWritable: true,
  })) || []

  const tx = await program.methods
    .executeIntent()
    .accounts(accounts)
    .remainingAccounts(remainingAccounts)
    .rpc()

  return tx
}

/**
 * Delegate capsule PDA to Magicblock ER/PER. When validator is omitted, program defaults to TEE (PER) for privacy.
 * Pass validatorPubkey (e.g. MAGICBLOCK_ER.VALIDATOR_ASIA) to target a specific ER validator; omit for PER.
 */
export async function delegateCapsule(
  wallet: WalletContextState,
  validatorPubkey?: PublicKey
): Promise<string> {
  const program = getProgram(wallet)
  if (!program) throw new Error('Wallet not connected')
  if (!wallet.publicKey) throw new Error('Wallet not connected')

  const [capsulePDA] = getCapsulePDA(wallet.publicKey)

  const accounts: {
    payer: PublicKey
    owner: PublicKey
    validator?: PublicKey
    pda: PublicKey
  } = {
    payer: wallet.publicKey,
    owner: wallet.publicKey,
    pda: capsulePDA,
  }
  if (validatorPubkey) accounts.validator = validatorPubkey

  const tx = await program.methods
    .delegateCapsule()
    .accounts(accounts)
    .rpc()

  return tx
}

/**
 * Commit and undelegate capsule from Ephemeral Rollup back to Solana base layer (e.g. after execution)
 */
export async function undelegateCapsule(wallet: WalletContextState): Promise<string> {
  const program = getProgram(wallet)
  if (!program) throw new Error('Wallet not connected')

  const [capsulePDA] = getCapsulePDA(wallet.publicKey!)
  const magicProgram = new PublicKey(MAGICBLOCK_ER.MAGIC_PROGRAM_ID)
  const magicContext = new PublicKey(MAGICBLOCK_ER.MAGIC_CONTEXT)

  const tx = await program.methods
    .undelegateCapsule()
    .accounts({
      payer: wallet.publicKey!,
      owner: wallet.publicKey!,
      magicContext,
      magicProgram,
      capsule: capsulePDA,
    })
    .rpc()

  return tx
}

/**
 * Schedule crank to run execute_intent at intervals (Magicblock ScheduleTask).
 * When conditions are met, anyone (including crank) can call execute_intent without owner signature.
 */
export async function scheduleExecuteIntent(
  wallet: WalletContextState,
  args: { taskId: BN; executionIntervalMillis: BN; iterations: BN }
): Promise<string> {
  const program = getProgram(wallet)
  if (!program) throw new Error('Wallet not connected')

  const [capsulePDA] = getCapsulePDA(wallet.publicKey!)
  const [vaultPDA] = getCapsuleVaultPDA(wallet.publicKey!)
  const [feeConfigPDA] = getFeeConfigPDA()
  const platformFeeRecipient = SOLANA_CONFIG.PLATFORM_FEE_RECIPIENT
    ? new PublicKey(SOLANA_CONFIG.PLATFORM_FEE_RECIPIENT)
    : feeConfigPDA // placeholder if not set

  const magicProgram = new PublicKey(MAGICBLOCK_ER.MAGIC_PROGRAM_ID)

  const tx = await program.methods
    .scheduleExecuteIntent(args)
    .accounts({
      magicProgram,
      payer: wallet.publicKey!,
      capsule: capsulePDA,
      vault: vaultPDA,
      owner: wallet.publicKey!,
      systemProgram: SystemProgram.programId,
      feeConfig: feeConfigPDA,
      platformFeeRecipient,
    })
    .rpc()

  return tx
}

/**
 * Schedule crank on TEE/PER so execute_intent runs automatically at intervals (MagicBlock Crank).
 * Call this after delegate_capsule so execution happens on-chain without anyone visiting.
 * See: https://docs.magicblock.app/pages/tools/crank/introduction
 */
export async function scheduleExecuteIntentViaTee(
  wallet: WalletContextState,
  teeAuthToken: string,
  args?: {
    taskId?: BN
    executionIntervalMillis?: BN
    iterations?: BN
  }
): Promise<string> {
  if (!wallet.publicKey || !wallet.signTransaction) throw new Error('Wallet not connected')

  const connection = getTeeConnection(teeAuthToken)
  const walletAdapter = {
    publicKey: wallet.publicKey,
    signTransaction: wallet.signTransaction,
    signAllTransactions: wallet.signAllTransactions ?? (async (txs) => txs),
  } as Wallet
  const provider = new AnchorProvider(connection, walletAdapter, { commitment: 'confirmed' })
  const program = new Program(idl as any, provider)

  const [capsulePDA] = getCapsulePDA(wallet.publicKey)
  const [vaultPDA] = getCapsuleVaultPDA(wallet.publicKey)
  const [feeConfigPDA] = getFeeConfigPDA()
  const platformFeeRecipient = SOLANA_CONFIG.PLATFORM_FEE_RECIPIENT
    ? new PublicKey(SOLANA_CONFIG.PLATFORM_FEE_RECIPIENT)
    : feeConfigPDA

  const taskId = args?.taskId ?? new BN(Date.now())
  const executionIntervalMillis = args?.executionIntervalMillis ?? new BN(CRANK_DEFAULT_INTERVAL_MS)
  const iterations = args?.iterations ?? new BN(CRANK_DEFAULT_ITERATIONS)

  const magicProgram = new PublicKey(MAGICBLOCK_ER.MAGIC_PROGRAM_ID)

  const tx = await program.methods
    .scheduleExecuteIntent({ taskId, executionIntervalMillis, iterations })
    .accounts({
      magicProgram,
      payer: wallet.publicKey,
      capsule: capsulePDA,
      vault: vaultPDA,
      systemProgram: SystemProgram.programId,
      feeConfig: feeConfigPDA,
      platformFeeRecipient,
    })
    .rpc()

  return tx
}

/**
 * Initialize platform fee config (call once after program deploy; authority can update later via updateFeeConfig).
 * 기본 수수료: 생성 0.05 SOL, 실행 3% → PLATFORM_FEE.CREATION_FEE_LAMPORTS, PLATFORM_FEE.EXECUTION_FEE_BPS 사용.
 * @param creationFeeLamports - SOL lamports charged per capsule creation (0 to disable)
 * @param executionFeeBps - Execution fee in basis points (10000 = 100%; 300 = 3%)
 */
export async function initFeeConfig(
  wallet: WalletContextState,
  feeRecipient: PublicKey,
  creationFeeLamports: number = PLATFORM_FEE.CREATION_FEE_LAMPORTS,
  executionFeeBps: number = PLATFORM_FEE.EXECUTION_FEE_BPS
): Promise<string> {
  const program = getProgram(wallet)
  if (!program) throw new Error('Wallet not connected')
  const [feeConfigPDA] = getFeeConfigPDA()
  const tx = await program.methods
    .initFeeConfig(feeRecipient, new BN(creationFeeLamports), executionFeeBps)
    .accounts({
      feeConfig: feeConfigPDA,
      authority: wallet.publicKey!,
      systemProgram: SystemProgram.programId,
    })
    .rpc()
  return tx
}

/**
 * Update platform fee config (authority only).
 */
export async function updateFeeConfig(
  wallet: WalletContextState,
  creationFeeLamports: number,
  executionFeeBps: number
): Promise<string> {
  if (executionFeeBps > 10000) throw new Error('executionFeeBps must be <= 10000')
  const program = getProgram(wallet)
  if (!program) throw new Error('Wallet not connected')
  const [feeConfigPDA] = getFeeConfigPDA()
  const tx = await program.methods
    .updateFeeConfig(new BN(creationFeeLamports), executionFeeBps)
    .accounts({
      feeConfig: feeConfigPDA,
      authority: wallet.publicKey!,
    })
    .rpc()
  return tx
}

/**
 * Read SOL/USD (or other) price from Pyth Lazer / ephemeral oracle price feed (requires program built with --features oracle)
 */
export async function samplePrice(
  wallet: WalletContextState,
  priceUpdateAccount: PublicKey
): Promise<string> {
  const program = getProgram(wallet)
  if (!program) throw new Error('Wallet not connected')

  const tx = await program.methods
    .samplePrice()
    .accounts({
      payer: wallet.publicKey!,
      priceUpdate: priceUpdateAccount,
    })
    .rpc()

  return tx
}

/**
 * Update activity timestamp
 */
export async function updateActivity(wallet: WalletContextState): Promise<string> {
  const program = getProgram(wallet)
  if (!program) throw new Error('Wallet not connected')

  const [capsulePDA] = getCapsulePDA(wallet.publicKey!)

  const tx = await program.methods
    .updateActivity()
    .accounts({
      capsule: capsulePDA,
      owner: wallet.publicKey!,
    })
    .rpc()

  return tx
}

/**
 * Deactivate capsule
 */
export async function deactivateCapsule(wallet: WalletContextState): Promise<string> {
  const program = getProgram(wallet)
  if (!program) throw new Error('Wallet not connected')

  const [capsulePDA] = getCapsulePDA(wallet.publicKey!)

  const tx = await program.methods
    .deactivateCapsule()
    .accounts({
      capsule: capsulePDA,
      owner: wallet.publicKey!,
    })
    .rpc()

  return tx
}

/**
 * Recreate capsule from executed state
 */
export async function recreateCapsule(
  wallet: WalletContextState,
  inactivityPeriodSeconds: number,
  intentData: Uint8Array
): Promise<string> {
  const program = getProgram(wallet)
  if (!program) throw new Error('Wallet not connected')

  const [capsulePDA] = getCapsulePDA(wallet.publicKey!)
  const [vaultPDA] = getCapsuleVaultPDA(wallet.publicKey!)

  // Convert Uint8Array to Buffer for Anchor (required by Blob.encode)
  let intentDataBuffer: Buffer | number[]
  if (typeof Buffer !== 'undefined') {
    intentDataBuffer = Buffer.from(intentData)
  } else {
    // Fallback for environments without Buffer
    intentDataBuffer = Array.from(intentData)
  }

  const tx = await program.methods
    .recreateCapsule(new BN(inactivityPeriodSeconds), intentDataBuffer)
    .accounts({
      capsule: capsulePDA,
      vault: vaultPDA,
      owner: wallet.publicKey!,
      systemProgram: SystemProgram.programId,
    })
    .rpc()

  return tx
}

/**
 * Fetch capsule data
 */
export async function getCapsule(owner: PublicKey): Promise<IntentCapsule | null> {
  const connection = getSolanaConnection()
  const [capsulePDA] = getCapsulePDA(owner)

  try {
    console.log('Fetching capsule for owner:', owner.toString())
    console.log('Capsule PDA:', capsulePDA.toString())
    
    // Retry logic for RPC errors
    const maxRetries = 3
    let accountInfo = null
    let lastError: any
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Use Anchor's account decoder to parse the account
        // We need a provider to use Program.account, but we can decode manually
        accountInfo = await connection.getAccountInfo(capsulePDA)
        console.log(`Account info (attempt ${attempt + 1}):`, accountInfo ? 'Found' : 'Not found')
        break // Success, exit retry loop
      } catch (error: any) {
        lastError = error
        const errorMessage = error?.message || ''
        const isRetryableError = 
          errorMessage.includes('503') ||
          errorMessage.includes('401') ||
          errorMessage.includes('32401') ||
          errorMessage.includes('Bad request') ||
          errorMessage.includes('Service unavailable') ||
          errorMessage.includes('timeout') ||
          errorMessage.includes('network') ||
          errorMessage.includes('Unauthorized')
        
        if (isRetryableError && attempt < maxRetries - 1) {
          const delay = Math.min(2000 * Math.pow(2, attempt), 10000)
          console.log(`RPC error (attempt ${attempt + 1}/${maxRetries}): ${errorMessage}, retrying in ${delay}ms...`)
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
        throw error // Not retryable or max retries reached
      }
    }
    
    if (!accountInfo || !accountInfo.data) {
      console.log('No account info or data found for PDA:', capsulePDA.toString())
      return null
    }

    // Anchor accounts start with an 8-byte discriminator
    // Skip the discriminator and parse the account data
    const data = accountInfo.data
    
    // Discriminator is 8 bytes, skip it
    let offset = 8
    
    // owner: Pubkey (32 bytes)
    const ownerBytes = data.slice(offset, offset + 32)
    const ownerPubkey = new PublicKey(ownerBytes)
    offset += 32
    
    // Helper function to read i64 (little-endian)
    const readI64 = (bytes: Uint8Array, start: number): bigint => {
      let result = 0n
      for (let i = 0; i < 8; i++) {
        result |= BigInt(bytes[start + i]) << BigInt(i * 8)
      }
      // Handle signed integer (two's complement)
      if (result & (1n << 63n)) {
        result = result - (1n << 64n)
      }
      return result
    }
    
    // Helper function to read u32 (little-endian)
    const readU32 = (bytes: Uint8Array, start: number): number => {
      return bytes[start] | (bytes[start + 1] << 8) | (bytes[start + 2] << 16) | (bytes[start + 3] << 24)
    }
    
    // inactivity_period: i64 (8 bytes, little-endian)
    const inactivityPeriod = readI64(data, offset)
    offset += 8
    
    // last_activity: i64 (8 bytes, little-endian)
    const lastActivity = readI64(data, offset)
    offset += 8
    
    // intent_data: Vec<u8> (4 bytes length + data)
    const intentDataLength = readU32(data, offset)
    offset += 4
    const intentDataBytes = data.slice(offset, offset + intentDataLength)
    offset += intentDataLength
    
    // is_active: bool (1 byte)
    const isActive = data[offset] === 1
    offset += 1
    
    // executed_at: Option<i64> (1 byte for Some/None + 8 bytes if Some)
    let executedAt: number | null = null
    const hasExecutedAt = data[offset] === 1
    offset += 1
    if (hasExecutedAt) {
      executedAt = Number(readI64(data, offset))
      offset += 8
    }
    
    // bump: u8 (1 byte) - we don't need this for the return value

    const capsule = {
      owner: ownerPubkey,
      inactivityPeriod: Number(inactivityPeriod),
      lastActivity: Number(lastActivity),
      intentData: new Uint8Array(intentDataBytes),
      isActive,
      executedAt,
    }
    
    console.log('Successfully fetched capsule:', {
      owner: capsule.owner.toString(),
      isActive: capsule.isActive,
      executedAt: capsule.executedAt,
      inactivityPeriod: capsule.inactivityPeriod,
    })
    
    return capsule
  } catch (error) {
    console.error('Error fetching capsule:', error)
    console.error('Owner:', owner.toString())
    console.error('PDA:', capsulePDA.toString())
    // Re-throw error so caller can handle it
    throw error
  }
}

/**
 * Fetch capsule by its PDA (capsule account address).
 * Used on capsule detail page when URL has /capsules/[address].
 */
export async function getCapsuleByAddress(capsulePda: PublicKey): Promise<(IntentCapsule & { capsuleAddress: string }) | null> {
  const connection = getSolanaConnection()
  try {
    const accountInfo = await connection.getAccountInfo(capsulePda)
    if (!accountInfo || !accountInfo.data) return null
    const data = accountInfo.data
    if (data.length < 60) return null

    const readI64 = (bytes: Uint8Array, start: number): bigint => {
      let result = 0n
      for (let i = 0; i < 8; i++) {
        result |= BigInt(bytes[start + i]) << BigInt(i * 8)
      }
      if (result & (1n << 63n)) result = result - (1n << 64n)
      return result
    }
    const readU32 = (bytes: Uint8Array, start: number): number =>
      bytes[start] | (bytes[start + 1] << 8) | (bytes[start + 2] << 16) | (bytes[start + 3] << 24)

    let offset = 8
    const ownerPubkey = new PublicKey(data.slice(offset, offset + 32))
    offset += 32
    const inactivityPeriod = Number(readI64(data, offset))
    offset += 8
    const lastActivity = Number(readI64(data, offset))
    offset += 8
    const intentDataLength = readU32(data, offset)
    offset += 4
    const intentDataBytes = data.slice(offset, offset + intentDataLength)
    offset += intentDataLength
    const isActive = data[offset] === 1
    offset += 1
    let executedAt: number | null = null
    if (data[offset] === 1) {
      offset += 1
      executedAt = Number(readI64(data, offset))
    }

    return {
      owner: ownerPubkey,
      inactivityPeriod,
      lastActivity,
      intentData: new Uint8Array(intentDataBytes),
      isActive,
      executedAt,
      capsuleAddress: capsulePda.toBase58(),
    }
  } catch {
    return null
  }
}

// Re-export types
export type { IntentCapsule } from '@/types'
