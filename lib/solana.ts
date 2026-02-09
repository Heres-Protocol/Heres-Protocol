/**
 * Solana program interaction utilities
 */

import { SystemProgram, PublicKey } from '@solana/web3.js'
import { Program, AnchorProvider, Wallet, BN } from '@coral-xyz/anchor'
import { WalletContextState } from '@solana/wallet-adapter-react'
import idl from '../idl/HeresProgram.json'
import { getSolanaConnection, getProgramId } from '@/config/solana'
import {
  getCapsulePDA,
  getFeeConfigPDA,
  getCapsuleVaultPDA,
  getBufferPDA,
  getDelegationRecordPDA,
  getDelegationMetadataPDA,
} from './program'
import { getTeeConnection } from './tee'
import { SOLANA_CONFIG, PLATFORM_FEE } from '@/constants'
import { MAGICBLOCK_ER } from '@/constants'
import type { IntentCapsule } from '@/types'
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
const SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL')

function getAssociatedTokenAddress(mint: PublicKey, owner: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      owner.toBuffer(),
      TOKEN_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID
  )[0]
}

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
    signAllTransactions: wallet.signAllTransactions || (async (txs: any) => txs),
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
  intentData: Uint8Array,
  mint?: PublicKey
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
        tokenProgram: PublicKey
        mint: PublicKey | null
        sourceTokenAccount: PublicKey | null
        vaultTokenAccount: PublicKey | null
      } = {
        capsule: capsulePDA,
        vault: vaultPDA,
        owner: wallet.publicKey!,
        feeConfig: feeConfigPDA,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        mint: null,
        sourceTokenAccount: null,
        vaultTokenAccount: null,
      }

      if (mint) {
        accounts.mint = mint
        accounts.sourceTokenAccount = getAssociatedTokenAddress(mint, wallet.publicKey!)
        accounts.vaultTokenAccount = getAssociatedTokenAddress(mint, vaultPDA)
      }

      if (platformFeeRecipient) accounts.platformFeeRecipient = platformFeeRecipient

      const tx = await program.methods
        .createCapsule(new BN(inactivityPeriodSeconds), intentDataBuffer)
        // @ts-ignore
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
    throw new Error('RPC ?쒕쾭媛 ?쇱떆?곸쑝濡??ъ슜 遺덇??ν빀?덈떎. ?좎떆 ???ㅼ떆 ?쒕룄?댁＜?몄슂.\nRPC server is temporarily unavailable. Please try again in a few moments.')
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
  beneficiaries?: Array<{ address: string; amount: string; amountType: string }>,
  mint?: PublicKey
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
    tokenProgram: PublicKey
    feeConfig: PublicKey
    platformFeeRecipient?: PublicKey
  } = {
    capsule: capsulePDA,
    vault: vaultPDA,
    systemProgram: SystemProgram.programId,
    tokenProgram: TOKEN_PROGRAM_ID,
    feeConfig: feeConfigPDA,
  }
  if (platformFeeRecipient) accounts.platformFeeRecipient = platformFeeRecipient

  const remainingAccounts = beneficiaries?.map(b => {
    const beneficiaryOwner = new PublicKey(b.address)
    if (mint && !mint.equals(PublicKey.default)) {
      const beneficiaryAta = getAssociatedTokenAddress(mint, beneficiaryOwner)
      return {
        pubkey: beneficiaryAta,
        isSigner: false,
        isWritable: true,
      }
    }
    return {
      pubkey: beneficiaryOwner,
      isSigner: false,
      isWritable: true,
    }
  }) || []

  // Add vaultTokenAccount if SPL
  let vaultTokenAccount = null
  if (mint && !mint.equals(PublicKey.default)) {
    vaultTokenAccount = getAssociatedTokenAddress(mint, vaultPDA)
  }

  const tx = await program.methods
    .executeIntent()
    .accounts({
      ...accounts,
      // @ts-ignore
      vaultTokenAccount: vaultTokenAccount,
    })
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

  // Verify capsule account exists and is owned by our program
  const connection = getSolanaConnection()
  const accountInfo = await connection.getAccountInfo(capsulePDA)
  if (!accountInfo) {
    throw new Error('Capsule account not found. Please create a capsule first.')
  }

  const magicProgramId = new PublicKey(MAGICBLOCK_ER.MAGIC_PROGRAM_ID)
  const delegationProgramId = new PublicKey(MAGICBLOCK_ER.DELEGATION_PROGRAM_ID)

  // Check if already delegated
  if (accountInfo.owner.equals(delegationProgramId)) {
    console.log('Capsule is already delegated to MagicBlock (Ephemereality). Proceeding...')
    return 'ALREADY_DELEGATED'
  }

  if (!accountInfo.owner.equals(getProgramId())) {
    throw new Error(`Capsule is not owned by the Heres Program. Current owner: ${accountInfo.owner.toBase58()}`)
  }

  const [vaultPDA] = getCapsuleVaultPDA(wallet.publicKey)

  // Derive PDAs for Capsule delegation (Correct Owners: magicProgramId for buffer, delegationProgramId for others)
  const [bufferPDA] = getBufferPDA(capsulePDA, magicProgramId)
  const [delegationRecordPDA] = getDelegationRecordPDA(capsulePDA, delegationProgramId)
  const [delegationMetadataPDA] = getDelegationMetadataPDA(capsulePDA, delegationProgramId)

  // Derive PDAs for Vault delegation
  const [vaultBufferPDA] = getBufferPDA(vaultPDA, magicProgramId)
  const [vaultDelegationRecordPDA] = getDelegationRecordPDA(vaultPDA, delegationProgramId)
  const [vaultDelegationMetadataPDA] = getDelegationMetadataPDA(vaultPDA, delegationProgramId)

  const accounts = {
    payer: wallet.publicKey,
    owner: wallet.publicKey,
    validator: validatorPubkey ?? null,
    pda: capsulePDA,
    pdaBuffer: bufferPDA,
    pdaDelegationRecord: delegationRecordPDA,
    pdaDelegationMetadata: delegationMetadataPDA,
    vault: vaultPDA,
    vaultBuffer: vaultBufferPDA,
    vaultDelegationRecord: vaultDelegationRecordPDA,
    vaultDelegationMetadata: vaultDelegationMetadataPDA,
    // Programs at the end
    magicProgram: magicProgramId,
    delegationProgram: delegationProgramId,
    systemProgram: SystemProgram.programId,
  }

  const tx = await program.methods
    .delegateCapsule()
    // @ts-ignore
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

  const [vaultPDA] = getCapsuleVaultPDA(wallet.publicKey!)
  const [commitBufferPDA] = getBufferPDA(capsulePDA, magicProgram)

  const tx = await program.methods
    .undelegateCapsule()
    .accounts({
      payer: wallet.publicKey as PublicKey,
      owner: wallet.publicKey as PublicKey,
      capsule: capsulePDA,
      vault: vaultPDA,
      buffer: commitBufferPDA,
      // Programs at the end
      magicContext,
      magicProgram,
      systemProgram: SystemProgram.programId,
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
  args: { taskId: BN; executionIntervalMillis: BN; iterations: BN },
  mint?: PublicKey
): Promise<string> {
  const program = getProgram(wallet)
  if (!program) throw new Error('Wallet not connected')

  const [capsulePDA] = getCapsulePDA(wallet.publicKey!)
  const [vaultPDA] = getCapsuleVaultPDA(wallet.publicKey!)
  const [feeConfigPDA] = getFeeConfigPDA()
  const platformFeeRecipient = SOLANA_CONFIG.PLATFORM_FEE_RECIPIENT
    ? new PublicKey(SOLANA_CONFIG.PLATFORM_FEE_RECIPIENT)
    : (wallet.publicKey as PublicKey)

  const magicProgram = new PublicKey(MAGICBLOCK_ER.MAGIC_PROGRAM_ID)

  const accounts: {
    magicProgram: PublicKey
    payer: PublicKey
    capsule: PublicKey
    vault: PublicKey
    owner: PublicKey
    systemProgram: PublicKey
    feeConfig: PublicKey
    platformFeeRecipient: PublicKey
    tokenProgram: PublicKey
    mint: PublicKey | null
    // @ts-ignore
    sourceTokenAccount: PublicKey | null
    vaultTokenAccount: PublicKey | null
  } = {
    magicProgram,
    payer: wallet.publicKey as PublicKey,
    capsule: capsulePDA,
    vault: vaultPDA,
    owner: wallet.publicKey as PublicKey,
    systemProgram: SystemProgram.programId,
    feeConfig: feeConfigPDA,
    platformFeeRecipient,
    tokenProgram: TOKEN_PROGRAM_ID,
    mint: null,
    sourceTokenAccount: null,
    vaultTokenAccount: null,
  }

  if (mint) {
    accounts.mint = mint
    accounts.vaultTokenAccount = getAssociatedTokenAddress(mint, vaultPDA)
  }

  const tx = await program.methods
    .scheduleExecuteIntent(args)
    // @ts-ignore
    .accounts(accounts)
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
  },
  mint?: PublicKey
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
    : (wallet.publicKey as PublicKey)

  const taskId = args?.taskId ?? new BN(Date.now())
  const executionIntervalMillis = args?.executionIntervalMillis ?? new BN(CRANK_DEFAULT_INTERVAL_MS)
  const iterations = args?.iterations ?? new BN(CRANK_DEFAULT_ITERATIONS)

  const magicProgram = new PublicKey(MAGICBLOCK_ER.MAGIC_PROGRAM_ID)

  const accounts = {
    magicProgram,
    payer: wallet.publicKey as PublicKey,
    capsule: capsulePDA,
    vault: vaultPDA,
    systemProgram: SystemProgram.programId,
    tokenProgram: TOKEN_PROGRAM_ID,
    feeConfig: feeConfigPDA,
    platformFeeRecipient,
    vaultTokenAccount: null,
  }

  if (mint) {
    // @ts-ignore
    accounts.vaultTokenAccount = getAssociatedTokenAddressSync(mint, vaultPDA, true)
  }

  const tx = await program.methods
    .scheduleExecuteIntent({ args: { taskId, executionIntervalMillis, iterations } })
    // @ts-ignore
    .accounts(accounts)
    .rpc()

  return tx
}

/**
 * Initialize platform fee config (call once after program deploy; authority can update later via updateFeeConfig).
 * 湲곕낯 ?섏닔猷? ?앹꽦 0.05 SOL, ?ㅽ뻾 3% ??PLATFORM_FEE.CREATION_FEE_LAMPORTS, PLATFORM_FEE.EXECUTION_FEE_BPS ?ъ슜.
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
  intentData: Uint8Array,
  mint?: PublicKey
): Promise<string> {
  const program = getProgram(wallet)
  if (!program) throw new Error('Wallet not connected')

  const [capsulePDA] = getCapsulePDA(wallet.publicKey!)
  const [vaultPDA] = getCapsuleVaultPDA(wallet.publicKey!)
  const [feeConfigPDA] = getFeeConfigPDA()

  // Convert Uint8Array to Buffer for Anchor (required by Blob.encode)
  let intentDataBuffer: Buffer | number[]
  if (typeof Buffer !== 'undefined') {
    intentDataBuffer = Buffer.from(intentData)
  } else {
    // Fallback for environments without Buffer
    intentDataBuffer = Array.from(intentData)
  }

  const accounts: {
    capsule: PublicKey
    vault: PublicKey
    owner: PublicKey
    systemProgram: PublicKey
    feeConfig: PublicKey
    tokenProgram: PublicKey
    mint: PublicKey | null
    sourceTokenAccount: PublicKey | null
    vaultTokenAccount: PublicKey | null
  } = {
    capsule: capsulePDA,
    vault: vaultPDA,
    owner: wallet.publicKey!,
    systemProgram: SystemProgram.programId,
    feeConfig: feeConfigPDA,
    tokenProgram: TOKEN_PROGRAM_ID,
    mint: null,
    sourceTokenAccount: null,
    vaultTokenAccount: null,
  }

  if (mint) {
    accounts.mint = mint
    accounts.sourceTokenAccount = getAssociatedTokenAddress(mint, wallet.publicKey!)
    accounts.vaultTokenAccount = getAssociatedTokenAddress(mint, vaultPDA)
  }

  const tx = await program.methods
    .recreateCapsule(new BN(inactivityPeriodSeconds), intentDataBuffer)
    // @ts-ignore
    .accounts(accounts)
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

    const capsule: IntentCapsule & { accountOwner: PublicKey } = {
      owner: ownerPubkey,
      inactivityPeriod: Number(inactivityPeriod),
      lastActivity: Number(lastActivity),
      intentData: new Uint8Array(intentDataBytes),
      isActive,
      executedAt,
      accountOwner: accountInfo.owner,
      mint: undefined,
    }

    // Skip bump (1) and vault_bump (1)
    offset += 2
    if (offset + 32 <= data.length) {
      capsule.mint = new PublicKey(data.slice(offset, offset + 32))
    }

    console.log('Successfully fetched capsule:', {
      owner: capsule.owner.toString(),
      isActive: capsule.isActive,
      executedAt: capsule.executedAt,
      inactivityPeriod: capsule.inactivityPeriod,
      accountOwner: capsule.accountOwner.toString(),
      mint: capsule.mint?.toString(),
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
      offset += 8
    }

    // @ts-ignore
    const result = {
      owner: ownerPubkey,
      inactivityPeriod,
      lastActivity,
      intentData: new Uint8Array(intentDataBytes),
      isActive,
      executedAt,
      capsuleAddress: capsulePda.toBase58(),
      accountOwner: accountInfo.owner, // Return the actual account owner (Heres or Delegation program)
      mint: undefined,
    }

    // Skip bump (1) and vault_bump (1)
    offset += 2
    if (offset + 32 <= data.length) {
      // @ts-ignore
      result.mint = new PublicKey(data.slice(offset, offset + 32))
    }
    return result as IntentCapsule & { capsuleAddress: string }
  } catch {
    return null
  }
}

// Re-export types
export type { IntentCapsule } from '@/types'
