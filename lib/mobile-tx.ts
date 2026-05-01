import { AnchorProvider, BN, Program } from '@coral-xyz/anchor'
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js'
import idl from '@/idl/heres_program.json'
import { getProgramId, getSolanaConnection } from '@/config/solana'
import { SOLANA_CONFIG } from '@/constants'
import { getCapsulePDA, getCapsuleVaultPDA, getFeeConfigPDA } from '@/lib/program'
import { encodeIntentData, daysToSeconds } from '@/utils/intent'
import type { Beneficiary } from '@/types'
import { getAssetConfig, isAssetConfigured, SupportedAssetSymbol } from '@/lib/assets'

const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
const SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL')

type DummyWallet = {
  publicKey: PublicKey
  signTransaction: (tx: Transaction) => Promise<Transaction>
  signAllTransactions: (txs: Transaction[]) => Promise<Transaction[]>
}

function getDummyWallet(publicKey: PublicKey): DummyWallet {
  return {
    publicKey,
    signTransaction: async (tx) => tx,
    signAllTransactions: async (txs) => txs,
  }
}

function getProgramForOwner(owner: PublicKey): Program {
  const connection = getSolanaConnection()
  const provider = new AnchorProvider(connection, getDummyWallet(owner) as any, { commitment: 'confirmed' })
  const programId = getProgramId()

  const programIdl = JSON.parse(JSON.stringify(idl))
  programIdl.address = programId.toBase58()

  return new Program(programIdl as any, provider)
}

function txToBase64(tx: Transaction): string {
  const bytes = tx.serialize({ requireAllSignatures: false, verifySignatures: false })
  return Buffer.from(bytes).toString('base64')
}

function getAssociatedTokenAddress(mint: PublicKey, owner: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID
  )[0]
}

export type CreateCapsuleTxInput = {
  owner: string
  totalAmount: string
  inactivityDays: number
  beneficiaryAddress: string
  beneficiaryAmount: string
  intent?: string
  assetSymbol?: SupportedAssetSymbol
}

export async function buildCreateCapsuleUnsignedTx(input: CreateCapsuleTxInput): Promise<{
  transactionBase64: string
  capsuleAddress: string
  inactivitySeconds: number
}> {
  const owner = new PublicKey(input.owner)
  const beneficiaryAddress = new PublicKey(input.beneficiaryAddress)
  const assetSymbol = input.assetSymbol ?? 'SOL'
  if (!isAssetConfigured(assetSymbol)) {
    throw new Error(`${assetSymbol} devnet mint is not configured`)
  }
  const asset = getAssetConfig(assetSymbol)

  const totalAmountNum = Number.parseFloat(input.totalAmount)
  const beneficiaryAmountNum = Number.parseFloat(input.beneficiaryAmount)
  const inactivitySeconds = daysToSeconds(input.inactivityDays)

  if (!Number.isFinite(totalAmountNum) || totalAmountNum <= 0) {
    throw new Error('Invalid totalAmount')
  }
  if (!Number.isFinite(beneficiaryAmountNum) || beneficiaryAmountNum <= 0) {
    throw new Error('Invalid beneficiaryAmount')
  }
  if (!Number.isFinite(inactivitySeconds) || inactivitySeconds <= 0) {
    throw new Error('Invalid inactivityDays')
  }

  const beneficiaries: Beneficiary[] = [
    {
      chain: 'solana',
      address: beneficiaryAddress.toBase58(),
      amount: String(beneficiaryAmountNum),
      amountType: 'fixed',
    },
  ]

  const intentData = encodeIntentData({
    intent: input.intent || 'Mobile capsule',
    beneficiaries,
    totalAmount: String(totalAmountNum),
    assetSymbol,
    assetMint: asset.mint,
    inactivityDays: input.inactivityDays,
    delayDays: 0,
  })

  const program = getProgramForOwner(owner)
  const programId = getProgramId()
  const [capsulePDA] = getCapsulePDA(owner)
  const [vaultPDA] = getCapsuleVaultPDA(owner)
  const [feeConfigPDA] = getFeeConfigPDA()

  const platformFeeRecipient = SOLANA_CONFIG.PLATFORM_FEE_RECIPIENT
    ? new PublicKey(SOLANA_CONFIG.PLATFORM_FEE_RECIPIENT)
    : owner
  const mint = asset.mint ? new PublicKey(asset.mint) : null

  const ix = await program.methods
    .createCapsule(new BN(inactivitySeconds), Buffer.from(intentData))
    .accountsStrict({
      capsule: capsulePDA,
      vault: vaultPDA,
      owner,
      feeConfig: feeConfigPDA,
      platformFeeRecipient,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      // Anchor optional-account sentinel for "None".
      mint: mint ?? programId,
      sourceTokenAccount: mint ? getAssociatedTokenAddress(mint, owner) : programId,
      vaultTokenAccount: mint ? getAssociatedTokenAddress(mint, vaultPDA) : programId,
      associatedTokenProgram: SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
    } as any)
    .instruction()

  const connection = getSolanaConnection()
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')

  const tx = new Transaction({ feePayer: owner, blockhash, lastValidBlockHeight })
  tx.add(ix)

  return {
    transactionBase64: txToBase64(tx),
    capsuleAddress: capsulePDA.toBase58(),
    inactivitySeconds,
  }
}

export async function buildUpdateActivityUnsignedTx(ownerBase58: string): Promise<{
  transactionBase64: string
  capsuleAddress: string
}> {
  const owner = new PublicKey(ownerBase58)
  const program = getProgramForOwner(owner)
  const [capsulePDA] = getCapsulePDA(owner)

  const ix = await program.methods
    .updateActivity()
    .accounts({
      capsule: capsulePDA,
      owner,
    })
    .instruction()

  const connection = getSolanaConnection()
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')

  const tx = new Transaction({ feePayer: owner, blockhash, lastValidBlockHeight })
  tx.add(ix)

  return {
    transactionBase64: txToBase64(tx),
    capsuleAddress: capsulePDA.toBase58(),
  }
}
