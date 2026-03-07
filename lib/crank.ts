import { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js'
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor'

// Minimal Wallet adapter for AnchorProvider (avoids broken @coral-xyz/anchor Wallet export)
class NodeWallet {
  constructor(readonly payer: Keypair) {}
  get publicKey() { return this.payer.publicKey }
  async signTransaction(tx: any): Promise<any> { tx.partialSign(this.payer); return tx }
  async signAllTransactions(txs: any[]): Promise<any[]> { txs.forEach((tx: any) => tx.partialSign(this.payer)); return txs }
}
import nacl from 'tweetnacl'
import { getAuthToken } from '@magicblock-labs/ephemeral-rollups-sdk'
import idl from '../idl/HeresProgram.json'
import { getSolanaConnection, getProgramId } from '@/config/solana'
import { getCapsulePDA, getCapsuleVaultPDA, getFeeConfigPDA } from './program'
import { SOLANA_CONFIG, MAGICBLOCK_ER, PER_TEE } from '@/constants'

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

  // @ts-ignore
  const capsules = (await program.account.intentCapsule.all()) as any[]
  const now = Math.floor(Date.now() / 1000)
  const eligible: DecodedCapsule[] = []

  // 1. Non-delegated capsules (owned by our program)
  for (const capsule of capsules) {
    const data = capsule.account
    if (!data.isActive || data.executedAt != null) continue
    if (data.lastActivity.toNumber() + data.inactivityPeriod.toNumber() > now) continue
    eligible.push({ ...capsule, isDelegated: false })
  }

  // 2. Delegated capsules (owned by Delegation Program, filtered by discriminator)
  try {
    const discriminator = idl.accounts?.find(
      (a: any) => a.name === 'IntentCapsule' || a.name === 'intentCapsule'
    )?.discriminator as number[] | undefined
    if (discriminator) {
      const bs58Mod = await import('bs58')
      const encode = bs58Mod.default?.encode || (bs58Mod as any).encode
      const delegatedAccounts = await connection.getProgramAccounts(DELEGATION_PROGRAM_ID, {
        filters: [{ memcmp: { offset: 0, bytes: encode(Buffer.from(discriminator)) } }],
      })
      // @ts-ignore
      const coder = new (await import('@coral-xyz/anchor')).BorshAccountsCoder(idl)
      for (const acc of delegatedAccounts) {
        try {
          const raw = coder.decode('IntentCapsule', acc.account.data)
          // BorshAccountsCoder returns snake_case fields; normalise to camelCase
          const decoded = {
            owner: raw.owner,
            inactivityPeriod: raw.inactivity_period ?? raw.inactivityPeriod,
            lastActivity: raw.last_activity ?? raw.lastActivity,
            intentData: raw.intent_data ?? raw.intentData,
            isActive: raw.is_active ?? raw.isActive,
            executedAt: raw.executed_at ?? raw.executedAt,
            mint: raw.mint,
          }
          if (!decoded.isActive || decoded.executedAt != null) continue
          if (decoded.lastActivity.toNumber() + decoded.inactivityPeriod.toNumber() > now) continue
          eligible.push({
            publicKey: acc.pubkey,
            isDelegated: true,
            account: decoded as any,
          })
        } catch { /* skip non-matching accounts */ }
      }
    }
  } catch (e) {
    console.error('[crank] Error scanning delegated capsules:', e instanceof Error ? e.message : e)
  }

  return eligible
}

function parseBeneficiaries(intentData: Buffer | Uint8Array): Array<{ address: string; amount: string; amountType: string }> {
  try {
    const json = new TextDecoder().decode(intentData)
    const data = JSON.parse(json) as { beneficiaries?: Array<{ address?: string; amount?: string; amountType?: string }> }
    const list = data?.beneficiaries
    if (!Array.isArray(list)) return []
    return list
      .filter((b) => b?.address)
      .map((b) => ({
        address: b.address!,
        amount: typeof b.amount === 'string' ? b.amount : String(b.amount ?? '0'),
        amountType: b.amountType ?? 'fixed',
      }))
  } catch {
    return []
  }
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

  const remainingAccounts = beneficiaries.map((b) => {
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
    { pubkey: permissionPDA, isSigner: false, isWritable: true },
  ]

  const ix = new TransactionInstruction({ keys, programId, data: discriminator })

  // Route through ER/TEE RPC if capsule is delegated
  let targetConnection = connection
  if (capsule.isDelegated) {
    // Get TEE auth token using keypair signing
    const signMessage = async (msg: Uint8Array) => nacl.sign.detached(msg, crankKeypair.secretKey)
    const { token } = await getAuthToken(PER_TEE.AUTH_URL, crankKeypair.publicKey, signMessage)
    targetConnection = new Connection(`${PER_TEE.RPC_URL}?token=${token}`, { commitment: 'confirmed' })
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

  const remainingAccounts = beneficiaries.map((b) => {
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
  errors: string[]
}

export async function runCrank(crankKeypair: Keypair): Promise<CrankResult> {
  const connection = getSolanaConnection()
  const eligible = await getEligibleCapsules(connection, crankKeypair)
  const errors: string[] = []
  let executedCount = 0
  let distributedCount = 0

  for (const capsule of eligible) {
    try {
      const txSig = await executeCapsuleIntent(connection, crankKeypair, capsule)
      executedCount += 1
      console.log(`[crank] Executed ${capsule.publicKey.toBase58()} (delegated=${capsule.isDelegated}): ${txSig}`)

      // Distribute assets on base layer (separate instruction for actual SOL/SPL transfers)
      try {
        const distTx = await distributeCapsuleAssets(connection, crankKeypair, capsule)
        distributedCount += 1
        console.log(`[crank] Distributed ${capsule.publicKey.toBase58()}: ${distTx}`)
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
    errors,
  }
}
