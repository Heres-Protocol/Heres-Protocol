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

  // @ts-ignore
  const capsules = (await program.account.intentCapsule.all()) as any[]
  const now = Math.floor(Date.now() / 1000)
  const eligible: DecodedCapsule[] = []

  for (const capsule of capsules) {
    const data = capsule.account
    if (!data.isActive || data.executedAt != null) continue
    if (data.lastActivity.toNumber() + data.inactivityPeriod.toNumber() > now) continue

    // Check if capsule is delegated to ER/TEE
    const accountInfo = await connection.getAccountInfo(capsule.publicKey)
    const isDelegated = accountInfo && accountInfo.owner.equals(DELEGATION_PROGRAM_ID)

    eligible.push({ ...capsule, isDelegated: Boolean(isDelegated) })
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

  // Build instruction manually — Anchor 0.32 account resolution breaks in Next.js bundle
  const discriminator = Buffer.from([53, 130, 47, 154, 227, 220, 122, 212]) // execute_intent
  const keys = [
    { pubkey: capsulePDA, isSigner: false, isWritable: true },
    { pubkey: vaultPDA, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: feeConfigPDA, isSigner: false, isWritable: false },
    { pubkey: platformFeeRecipient, isSigner: false, isWritable: true },
    // optional: mint (use program ID as sentinel for None)
    { pubkey: isSpl ? mint : programId, isSigner: false, isWritable: false },
    // optional: vault_token_account
    { pubkey: isSpl ? getAssociatedTokenAddress(mint, vaultPDA) : programId, isSigner: false, isWritable: true },
    { pubkey: PERMISSION_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: permissionPDA, isSigner: false, isWritable: true },
    ...remainingAccounts,
  ]

  const ix = new TransactionInstruction({ keys, programId, data: discriminator })

  // Route through ER/TEE RPC if capsule is delegated
  const targetConnection = capsule.isDelegated
    ? new Connection(PER_TEE.RPC_URL, { commitment: 'confirmed' })
    : connection

  const { blockhash, lastValidBlockHeight } = await targetConnection.getLatestBlockhash('confirmed')
  const tx = new Transaction({ feePayer: crankKeypair.publicKey, blockhash, lastValidBlockHeight })
  tx.add(ix)
  tx.sign(crankKeypair)

  const txSig = await targetConnection.sendRawTransaction(tx.serialize(), { skipPreflight: true })
  await targetConnection.confirmTransaction({ signature: txSig, blockhash, lastValidBlockHeight }, 'confirmed')
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

      // execute_intent handles fee distribution internally, no separate distribute step needed
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
