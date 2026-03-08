import { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js'
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor'

// Minimal Wallet adapter for AnchorProvider (avoids broken @coral-xyz/anchor Wallet export)
class NodeWallet {
  constructor(readonly payer: Keypair) {}
  get publicKey() { return this.payer.publicKey }
  async signTransaction(tx: any): Promise<any> { tx.partialSign(this.payer); return tx }
  async signAllTransactions(txs: any[]): Promise<any[]> { txs.forEach((tx: any) => tx.partialSign(this.payer)); return txs }
}
import idl from '../idl/HeresProgram.json'
import { getSolanaConnection, getProgramId } from '@/config/solana'
import { getCapsulePDA, getCapsuleVaultPDA, getFeeConfigPDA } from './program'
import { SOLANA_CONFIG, MAGICBLOCK_ER } from '@/constants'
import { buildCcipAccountsForVaultSend } from '@/lib/ccip'
import { getRegisteredOwners, unregisterCapsuleOwner } from '@/lib/capsule-registry'

const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
const SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL')
const DELEGATION_PROGRAM_ID = new PublicKey(MAGICBLOCK_ER.DELEGATION_PROGRAM_ID)
const PERMISSION_PROGRAM_ID = new PublicKey(MAGICBLOCK_ER.PERMISSION_PROGRAM_ID)

function getPermissionPDA(capsule: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('permission'), capsule.toBuffer()],
    PERMISSION_PROGRAM_ID
  )
}

export type DecodedCapsule = {
  publicKey: PublicKey
  isDelegated?: boolean
  needsDistributeOnly?: boolean
  account: {
    owner: PublicKey
    inactivityPeriod: BN
    lastActivity: BN
    intentData: Buffer | Uint8Array
    isActive: boolean
    executedAt: BN | null
    mint: PublicKey
  }
}

function getAssociatedTokenAddress(mint: PublicKey, owner: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID
  )[0]
}

export async function getEligibleCapsules(connection: Connection, crankKeypair: Keypair): Promise<DecodedCapsule[]> {
  const wallet = new NodeWallet(crankKeypair)
  const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' })
  const program = new Program(idl as any, provider)
  const programId = getProgramId()

  // @ts-ignore — fetch all capsules with 15s timeout to avoid hanging on slow RPC
  const fetchAll = () => (program.account as any).intentCapsule.all()
  const capsulesResult = await Promise.race([
    fetchAll(),
    new Promise<null>(r => setTimeout(() => r(null), 15000)),
  ])
  if (!capsulesResult) {
    console.log('[crank] intentCapsule.all() timed out (15s)')
    return []
  }
  const capsules = capsulesResult as any[]
  const now = Math.floor(Date.now() / 1000)
  const eligible: DecodedCapsule[] = []

  // 1. Non-delegated capsules (owned by our program)
  const readyToExecute: typeof capsules = []
  const executedCapsules: typeof capsules = []

  for (const capsule of capsules) {
    const data = capsule.account
    if (data.isActive && data.executedAt == null) {
      if (data.lastActivity.toNumber() + data.inactivityPeriod.toNumber() > now) continue
      eligible.push({ ...capsule, isDelegated: false })
    } else if (!data.isActive && data.executedAt != null) {
      executedCapsules.push(capsule)
    }
  }

  // 1b. Check executed capsules vault balances in parallel
  if (executedCapsules.length > 0) {
    const vaultChecks = executedCapsules.map(async (capsule) => {
      try {
        const [vaultPDA] = getCapsuleVaultPDA(capsule.account.owner)
        const vaultBalance = await connection.getBalance(vaultPDA)
        // rent-exempt minimum is ~953,520 lamports; only flag if vault has more
        if (vaultBalance > 960_000) {
          console.log(`[crank] Found undistributed capsule ${capsule.publicKey.toBase58()} (vault=${vaultBalance} lamports)`)
          return { ...capsule, isDelegated: false, needsDistributeOnly: true } as DecodedCapsule
        }
      } catch { /* skip */ }
      return null
    })
    const results = await Promise.all(vaultChecks)
    for (const r of results) {
      if (r) eligible.push(r)
    }
  }

  // 2. Delegated capsules — check registered owners' PDAs individually
  //    getProgramAccounts(DELEGATION_PROGRAM_ID) hangs on devnet public RPC,
  //    so we use a local registry of capsule owners instead.
  const erConnection = new Connection(MAGICBLOCK_ER.ER_RPC_URL, { commitment: 'confirmed' })
  const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T | null> =>
    Promise.race([promise, new Promise<null>(r => setTimeout(() => r(null), ms))])
  try {
    // @ts-ignore
    const coder = new (await import('@coral-xyz/anchor')).BorshAccountsCoder(idl)
    const seenPDAs = new Set(capsules.map((c: any) => c.publicKey.toBase58()))
    const registeredOwners = await getRegisteredOwners()
    console.log(`[crank] Checking ${registeredOwners.length} registered owners for delegated capsules`)

    for (const ownerKey of registeredOwners) {
      const owner = new PublicKey(ownerKey)
      const [capsulePDA] = getCapsulePDA(owner)
      // Skip if already found in non-delegated scan
      if (seenPDAs.has(capsulePDA.toBase58())) continue
      try {
        const baseInfo = await connection.getAccountInfo(capsulePDA)
        if (!baseInfo) continue
        const isDelegated = baseInfo.owner.equals(DELEGATION_PROGRAM_ID)

        let raw: any
        if (isDelegated) {
          // Read state from ER
          const erInfo = await withTimeout(erConnection.getAccountInfo(capsulePDA), 5000)
          if (!erInfo) continue
          raw = coder.decode('IntentCapsule', erInfo.data)
        } else if (baseInfo.owner.equals(programId)) {
          // Back on base layer — read directly
          raw = coder.decode('IntentCapsule', baseInfo.data)
        } else {
          continue
        }

        const decoded = {
          owner: raw.owner,
          inactivityPeriod: raw.inactivity_period ?? raw.inactivityPeriod,
          lastActivity: raw.last_activity ?? raw.lastActivity,
          intentData: raw.intent_data ?? raw.intentData,
          isActive: raw.is_active ?? raw.isActive,
          executedAt: raw.executed_at ?? raw.executedAt,
          mint: raw.mint,
        }
        if (decoded.isActive && decoded.executedAt == null) {
          if (decoded.lastActivity.toNumber() + decoded.inactivityPeriod.toNumber() > now) continue
          eligible.push({ publicKey: capsulePDA, isDelegated, account: decoded as any })
        } else if (!decoded.isActive && decoded.executedAt != null) {
          console.log(`[crank] Found executed capsule ${capsulePDA.toBase58()} (delegated=${isDelegated}, needsDistributeOnly)`)
          eligible.push({ publicKey: capsulePDA, isDelegated, needsDistributeOnly: true, account: decoded as any })
        }
      } catch (ownerErr) {
        console.error(`[crank] Error checking owner ${ownerKey}:`, ownerErr instanceof Error ? ownerErr.message : ownerErr)
      }
    }
  } catch (e) {
    console.error('[crank] Error checking delegated capsules:', e instanceof Error ? e.message : e)
  }

  return eligible
}

function parseBeneficiaries(
  intentData: Buffer | Uint8Array
): Array<{
  chain: 'solana' | 'evm'
  address: string
  amount: string
  amountType: string
  destinationChainSelector?: string
}> {
  try {
    const json = new TextDecoder().decode(intentData)
    const data = JSON.parse(json) as {
      beneficiaries?: Array<{
        chain?: 'solana' | 'evm'
        address?: string
        amount?: string
        amountType?: string
        destinationChainSelector?: string
      }>
    }
    const list = data?.beneficiaries
    if (!Array.isArray(list)) return []
    return list
      .filter((b) => b?.address)
      .map((b) => ({
        chain: b.chain ?? 'solana',
        address: b.address!,
        amount: typeof b.amount === 'string' ? b.amount : String(b.amount ?? '0'),
        amountType: b.amountType ?? 'fixed',
        destinationChainSelector: b.destinationChainSelector,
      }))
  } catch {
    return []
  }
}

function parseTotalAmountLamports(intentData: Buffer | Uint8Array): number {
  try {
    const json = new TextDecoder().decode(intentData)
    const payload = JSON.parse(json) as { totalAmount?: string }
    const total = Number.parseFloat(payload.totalAmount || '0')
    if (!Number.isFinite(total) || total <= 0) return 0
    return Math.floor(total * 1_000_000_000)
  } catch {
    return 0
  }
}

function computeBeneficiaryAmountLamports(
  beneficiary: { amount: string; amountType: string },
  totalAmountLamports: number
): number {
  if (beneficiary.amountType === 'percentage') {
    const pct = Number.parseFloat(beneficiary.amount || '0')
    if (!Number.isFinite(pct) || pct <= 0) return 0
    return Math.floor((totalAmountLamports * pct) / 100)
  }
  const fixed = Number.parseFloat(beneficiary.amount || '0')
  if (!Number.isFinite(fixed) || fixed <= 0) return 0
  return Math.floor(fixed * 1_000_000_000)
}

export async function executeCapsuleIntent(
  connection: Connection,
  crankKeypair: Keypair,
  capsule: DecodedCapsule
): Promise<string> {
  const wallet = new NodeWallet(crankKeypair)
  const [capsulePDA] = getCapsulePDA(capsule.account.owner)
  const [vaultPDA] = getCapsuleVaultPDA(capsule.account.owner)
  const [permissionPDA] = getPermissionPDA(capsulePDA)

  const beneficiaries = parseBeneficiaries(capsule.account.intentData)
  const mint = capsule.account.mint
  const isSpl = mint && !mint.equals(PublicKey.default) && !mint.equals(SystemProgram.programId)

  const remainingAccounts = beneficiaries
    .filter((b) => b.chain === 'solana')
    .map((b) => {
    const beneficiaryOwner = new PublicKey(b.address)
    if (isSpl) {
      return { pubkey: getAssociatedTokenAddress(mint, beneficiaryOwner), isSigner: false, isWritable: true }
    }
    return { pubkey: beneficiaryOwner, isSigner: false, isWritable: true }
  })

  const [feeConfigPDA] = getFeeConfigPDA()
  const platformFeeRecipient = new PublicKey(
    SOLANA_CONFIG.PLATFORM_FEE_RECIPIENT || 'Covn3moA8qstPgXPgueRGMSmi94yXvuDCWTjQVBxHpzb'
  )
  const programId = getProgramId()

  // Deployed program's execute_intent only needs 4 accounts (state update only).
  // The IDL shows 10 accounts but the on-chain binary hasn't been upgraded yet.
  const discriminator = Buffer.from([53, 130, 47, 154, 227, 220, 122, 212]) // execute_intent
  const keys = [
    { pubkey: capsulePDA, isSigner: false, isWritable: true },
    { pubkey: vaultPDA, isSigner: false, isWritable: true },
    { pubkey: PERMISSION_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: permissionPDA, isSigner: false, isWritable: false },
  ]

  const ix = new TransactionInstruction({ keys, programId, data: discriminator })

  // Route through ER RPC (Asia devnet) if capsule is delegated
  let targetConnection = connection
  if (capsule.isDelegated) {
    targetConnection = new Connection(MAGICBLOCK_ER.ER_RPC_URL, { commitment: 'confirmed' })
    console.log(`[crank] Using ER RPC for delegated capsule: ${MAGICBLOCK_ER.ER_RPC_URL}`)
  }

  const { blockhash, lastValidBlockHeight } = await targetConnection.getLatestBlockhash('confirmed')
  const tx = new Transaction({ feePayer: crankKeypair.publicKey, blockhash, lastValidBlockHeight })
  tx.add(ix)
  tx.sign(crankKeypair)

  const txSig = await targetConnection.sendRawTransaction(tx.serialize(), { skipPreflight: true })
  await targetConnection.confirmTransaction({ signature: txSig, blockhash, lastValidBlockHeight }, 'confirmed')
  return txSig
}

/**
 * Commit state from ER and undelegate capsule + vault back to base layer.
 * Calls our program's crank_undelegate instruction on ER, which does CPI to
 * Magic program. CPI provides the parent program ID context, solving
 * "parent program id: None" errors that occur with direct Magic program calls.
 */
export async function commitAndUndelegateFromER(
  crankKeypair: Keypair,
  capsule: DecodedCapsule
): Promise<string> {
  const erConnection = new Connection(MAGICBLOCK_ER.ER_RPC_URL, { commitment: 'confirmed' })
  const [capsulePDA] = getCapsulePDA(capsule.account.owner)
  const [vaultPDA] = getCapsuleVaultPDA(capsule.account.owner)
  const programId = getProgramId()

  const magicProgramId = new PublicKey(MAGICBLOCK_ER.MAGIC_PROGRAM_ID)
  const magicContextId = new PublicKey(MAGICBLOCK_ER.MAGIC_CONTEXT)

  // crank_undelegate discriminator from IDL
  const crankUndelegateDisc = idl.instructions?.find(
    (i: any) => i.name === 'crank_undelegate' || i.name === 'crankUndelegate'
  )?.discriminator as number[] | undefined
  if (!crankUndelegateDisc) throw new Error('crank_undelegate instruction not found in IDL')

  const ix = new TransactionInstruction({
    keys: [
      { pubkey: crankKeypair.publicKey, isSigner: true, isWritable: true },  // payer
      { pubkey: capsulePDA, isSigner: false, isWritable: true },              // capsule
      { pubkey: vaultPDA, isSigner: false, isWritable: true },                // vault
      { pubkey: magicContextId, isSigner: false, isWritable: true },          // magic_context
      { pubkey: magicProgramId, isSigner: false, isWritable: false },         // magic_program
    ],
    programId,
    data: Buffer.from(crankUndelegateDisc),
  })

  const { blockhash, lastValidBlockHeight } = await erConnection.getLatestBlockhash('confirmed')
  const tx = new Transaction({ feePayer: crankKeypair.publicKey, blockhash, lastValidBlockHeight })
  tx.add(ix)
  tx.sign(crankKeypair)

  const txSig = await erConnection.sendRawTransaction(tx.serialize(), { skipPreflight: true })
  await erConnection.confirmTransaction({ signature: txSig, blockhash, lastValidBlockHeight }, 'confirmed')
  console.log(`[crank] crank_undelegate from ER: ${txSig}`)
  return txSig
}

/**
 * Wait for undelegation to propagate from ER to base layer.
 * Polls base layer until account owner returns to our program.
 */
async function waitForUndelegation(
  connection: Connection,
  account: PublicKey,
  timeoutMs: number = 30000
): Promise<boolean> {
  const programId = getProgramId()
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const info = await connection.getAccountInfo(account)
    if (info && info.owner.equals(programId)) return true
    await new Promise(r => setTimeout(r, 2000))
  }
  return false
}

/**
 * Distribute assets from vault to beneficiaries (call on base layer after execute_intent).
 * This is a separate on-chain instruction that handles actual SOL/SPL transfers.
 */
export async function distributeCapsuleAssets(
  connection: Connection,
  crankKeypair: Keypair,
  capsule: DecodedCapsule
): Promise<string> {
  const [capsulePDA] = getCapsulePDA(capsule.account.owner)
  const [vaultPDA] = getCapsuleVaultPDA(capsule.account.owner)
  const [feeConfigPDA] = getFeeConfigPDA()
  const programId = getProgramId()

  const beneficiaries = parseBeneficiaries(capsule.account.intentData)
  const mint = capsule.account.mint
  const isSpl = mint && !mint.equals(PublicKey.default) && !mint.equals(SystemProgram.programId)

  // Read fee_config to get actual fee_recipient
  const feeConfigInfo = await connection.getAccountInfo(feeConfigPDA)
  let feeRecipient: PublicKey
  if (feeConfigInfo) {
    try {
      const { BorshAccountsCoder } = await import('@coral-xyz/anchor')
      const coder = new BorshAccountsCoder(idl as any)
      const feeData = coder.decode('FeeConfig', feeConfigInfo.data)
      feeRecipient = new PublicKey(feeData.fee_recipient ?? feeData.feeRecipient)
    } catch {
      feeRecipient = new PublicKey(SOLANA_CONFIG.PLATFORM_FEE_RECIPIENT || 'Covn3moA8qstPgXPgueRGMSmi94yXvuDCWTjQVBxHpzb')
    }
  } else {
    feeRecipient = new PublicKey(SOLANA_CONFIG.PLATFORM_FEE_RECIPIENT || 'Covn3moA8qstPgXPgueRGMSmi94yXvuDCWTjQVBxHpzb')
  }

  const remainingAccounts = beneficiaries
    .filter((b) => b.chain === 'solana')
    .map((b) => {
    const beneficiaryOwner = new PublicKey(b.address)
    if (isSpl) {
      return { pubkey: getAssociatedTokenAddress(mint, beneficiaryOwner), isSigner: false, isWritable: true }
    }
    return { pubkey: beneficiaryOwner, isSigner: false, isWritable: true }
  })

  // distribute_assets discriminator: sha256("global:distribute_assets")[0..8]
  const discriminator = Buffer.from([239, 241, 19, 219, 144, 191, 154, 18])
  const keys = [
    { pubkey: capsulePDA, isSigner: false, isWritable: false },
    { pubkey: vaultPDA, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: feeConfigPDA, isSigner: false, isWritable: false },
    { pubkey: feeRecipient, isSigner: false, isWritable: true },
    // optional: mint (sentinel for None)
    { pubkey: isSpl ? mint : programId, isSigner: false, isWritable: false },
    // optional: vault_token_account (sentinel for None)
    { pubkey: isSpl ? getAssociatedTokenAddress(mint, vaultPDA) : programId, isSigner: false, isWritable: isSpl },
    ...remainingAccounts,
  ]

  const ix = new TransactionInstruction({ keys, programId, data: discriminator })
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
  const tx = new Transaction({ feePayer: crankKeypair.publicKey, blockhash, lastValidBlockHeight })
  tx.add(ix)
  tx.sign(crankKeypair)

  const txSig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: true })
  await connection.confirmTransaction({ signature: txSig, blockhash, lastValidBlockHeight }, 'confirmed')
  return txSig
}

export type CrankResult = {
  ok: boolean
  eligibleCount: number
  executedCount: number
  distributedCount: number
  ccipSentCount: number
  errors: string[]
}

export async function runCrank(crankKeypair: Keypair): Promise<CrankResult> {
  const connection = getSolanaConnection()
  const programId = getProgramId()
  const eligible = await getEligibleCapsules(connection, crankKeypair)
  const errors: string[] = []
  let executedCount = 0
  let distributedCount = 0
  let ccipSentCount = 0

  for (const capsule of eligible) {
    try {
      const [capsulePDA] = getCapsulePDA(capsule.account.owner)
      const [vaultPDA] = getCapsuleVaultPDA(capsule.account.owner)

      // Skip execute for capsules that only need distribution
      if (!capsule.needsDistributeOnly) {
        const txSig = await executeCapsuleIntent(connection, crankKeypair, capsule)
        executedCount += 1
        console.log(`[crank] Executed ${capsule.publicKey.toBase58()} (delegated=${capsule.isDelegated}): ${txSig}`)

        // If delegated, send commit+undelegate but don't wait — distribute on next cycle
        if (capsule.isDelegated) {
          try {
            const undelegTx = await commitAndUndelegateFromER(crankKeypair, capsule)
            console.log(`[crank] Commit+undelegate sent (no wait): ${undelegTx}`)
          } catch (undelegErr) {
            const msg = undelegErr instanceof Error ? undelegErr.message : String(undelegErr)
            console.log(`[crank] Commit+undelegate failed (will retry): ${msg}`)
          }
          // Skip distribute — capsule will appear as needsDistributeOnly on next cycle
          continue
        }
      } else {
        console.log(`[crank] Skipping execute for already-executed capsule ${capsule.publicKey.toBase58()}, proceeding to distribute`)

        // If still delegated, send commit+undelegate — distribute on next cycle
        if (capsule.isDelegated) {
          try {
            const undelegTx = await commitAndUndelegateFromER(crankKeypair, capsule)
            console.log(`[crank] Commit+undelegate sent: ${undelegTx} — distribute next cycle`)
          } catch (undelegErr) {
            const msg = undelegErr instanceof Error ? undelegErr.message : String(undelegErr)
            console.log(`[crank] Commit+undelegate failed: ${msg}`)
          }
          continue
        }
      }

      // Distribute assets on base layer (separate instruction for actual SOL/SPL transfers)
      // Pre-check: verify vault has enough balance to cover totalAmount + fees
      try {
        const totalAmountLamportsCheck = parseTotalAmountLamports(capsule.account.intentData)
        const vaultBalanceCheck = await connection.getBalance(vaultPDA)
        // Need totalAmount + small margin for tx fees (rent stays in vault)
        const minRequired = totalAmountLamportsCheck + 50_000
        if (vaultBalanceCheck < minRequired) {
          console.log(`[crank] Skipping distribute for ${capsule.publicKey.toBase58()}: vault=${vaultBalanceCheck} < required=${minRequired}`)
          continue
        }
      } catch (balErr) {
        console.log(`[crank] Vault balance check failed for ${capsule.publicKey.toBase58()}, skipping distribute`)
        continue
      }
      try {
        const distTx = await distributeCapsuleAssets(connection, crankKeypair, capsule)
        distributedCount += 1
        console.log(`[crank] Distributed ${capsule.publicKey.toBase58()}: ${distTx}`)

        const mint = capsule.account.mint
        const isSpl = mint && !mint.equals(PublicKey.default) && !mint.equals(SystemProgram.programId)
        const beneficiaries = parseBeneficiaries(capsule.account.intentData)
        const totalAmountLamports = parseTotalAmountLamports(capsule.account.intentData)

        const ccipSentSet = new Set<number>() // track sent indexes to prevent double-send
        for (const [beneficiaryIndex, beneficiary] of beneficiaries.entries()) {
          if (beneficiary.chain !== 'evm') continue
          if (!isSpl) {
            errors.push(`${capsule.publicKey.toBase58()} ccip: only SPL token source is supported`)
            continue
          }
          if (ccipSentSet.has(beneficiaryIndex)) continue
          ccipSentSet.add(beneficiaryIndex)

          const selector = beneficiary.destinationChainSelector || '16015286601757825753'
          const tokenAmount = computeBeneficiaryAmountLamports(beneficiary, totalAmountLamports)
          if (tokenAmount <= 0) continue

          try {
            const ccipAccounts = await buildCcipAccountsForVaultSend({
              connection,
              signer: crankKeypair,
              vaultAuthority: vaultPDA,
              tokenMint: mint.toBase58(),
              destinationChainSelector: selector,
            })
            const [feeConfigPDA] = getFeeConfigPDA()
            const discriminator = Buffer.from([40, 216, 105, 132, 83, 51, 109, 225]) // send_ccip_from_vault
            const arg = Buffer.alloc(2)
            arg.writeUInt16LE(beneficiaryIndex, 0)
            const ix = new TransactionInstruction({
              programId,
              keys: [
                { pubkey: capsulePDA, isSigner: false, isWritable: true },
                { pubkey: vaultPDA, isSigner: false, isWritable: true },
                { pubkey: feeConfigPDA, isSigner: false, isWritable: false },
                { pubkey: ccipAccounts.ccipRouter, isSigner: false, isWritable: false },
                ...ccipAccounts.remainingAccounts,
              ],
              data: Buffer.concat([discriminator, arg]),
            })

            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
            const tx = new Transaction({ feePayer: crankKeypair.publicKey, blockhash, lastValidBlockHeight })
            tx.add(ix)
            tx.sign(crankKeypair)
            const ccipTx = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: true })
            await connection.confirmTransaction({ signature: ccipTx, blockhash, lastValidBlockHeight }, 'confirmed')
            ccipSentCount += 1
            console.log(`[crank] CCIP sent(on-chain CPI) ${capsule.publicKey.toBase58()} -> ${beneficiary.address} tx=${ccipTx}`)
          } catch (ccipErr) {
            const msg = ccipErr instanceof Error ? ccipErr.message : String(ccipErr)
            errors.push(`${capsule.publicKey.toBase58()} ccip: ${msg}`)
          }
        }
      } catch (distErr) {
        const distMsg = distErr instanceof Error ? distErr.message : String(distErr)
        errors.push(`${capsule.publicKey.toBase58()} distribute: ${distMsg}`)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push(`${capsule.publicKey.toBase58()}: ${msg}`)
    }
  }

  return {
    ok: errors.length === 0,
    eligibleCount: eligible.length,
    executedCount,
    distributedCount,
    ccipSentCount,
    errors,
  }
}
