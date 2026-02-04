/**
 * Crank: server-side automatic execution of eligible capsules.
 * Run via cron (e.g. POST /api/cron/execute-intent) so that when
 * last_activity + inactivity_period has passed, execute_intent is
 * called and SOL is distributed to beneficiaries without any user action.
 */

import { Connection, Keypair, PublicKey, SystemProgram, Transaction, VersionedTransaction } from '@solana/web3.js'
import { Program, AnchorProvider, Wallet } from '@coral-xyz/anchor'
import idl from '../idl/lucid_program.json'
import { getSolanaConnection, getProgramId } from '@/config/solana'
import { getCapsulePDA, getCapsuleVaultPDA, getFeeConfigPDA } from './program'
import { SOLANA_CONFIG } from '@/constants'

const INTENT_CAPSULE_DISCRIMINATOR = new Uint8Array([64, 226, 112, 218, 172, 210, 4, 113])

function readI64(bytes: Uint8Array, start: number): number {
  let result = 0n
  for (let i = 0; i < 8; i++) {
    result |= BigInt(bytes[start + i]) << BigInt(i * 8)
  }
  if (result & (1n << 63n)) result = result - (1n << 64n)
  return Number(result)
}

function readU32(bytes: Uint8Array, start: number): number {
  return bytes[start] | (bytes[start + 1] << 8) | (bytes[start + 2] << 16) | (bytes[start + 3] << 24)
}

type DecodedCapsule = {
  capsuleAddress: string
  owner: PublicKey
  inactivityPeriod: number
  lastActivity: number
  intentData: Uint8Array
  isActive: boolean
  executedAt: number | null
}

function decodeCapsuleAccount(data: Buffer, pubkey: PublicKey): DecodedCapsule | null {
  if (data.length < 8 + 32 + 8 + 8 + 4 + 1 + 1 + 1) return null
  const d = new Uint8Array(data)
  let offset = 8
  const owner = new PublicKey(d.slice(offset, offset + 32))
  offset += 32
  const inactivityPeriod = readI64(d, offset)
  offset += 8
  const lastActivity = readI64(d, offset)
  offset += 8
  const intentDataLength = readU32(d, offset)
  offset += 4
  const intentDataBytes = d.slice(offset, offset + intentDataLength)
  offset += intentDataLength
  const isActive = d[offset] === 1
  offset += 1
  let executedAt: number | null = null
  const hasExecutedAt = d[offset] === 1
  offset += 1
  if (hasExecutedAt && offset + 8 <= d.length) {
    executedAt = readI64(d, offset)
  }
  return {
    capsuleAddress: pubkey.toBase58(),
    owner,
    inactivityPeriod,
    lastActivity,
    intentData: new Uint8Array(intentDataBytes),
    isActive,
    executedAt,
  }
}

function parseBeneficiaries(intentData: Uint8Array): Array<{ address: string; amount: string; amountType: string }> {
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

function walletFromKeypair(keypair: Keypair): Wallet {
  const signTx = async <T extends Transaction | VersionedTransaction>(tx: T): Promise<T> => {
    if ('partialSign' in tx && typeof (tx as Transaction).partialSign === 'function') {
      (tx as Transaction).partialSign(keypair)
    } else if ('sign' in tx && typeof (tx as VersionedTransaction).sign === 'function') {
      (tx as VersionedTransaction).sign([keypair])
    }
    return tx
  }
  return {
    publicKey: keypair.publicKey,
    payer: keypair,
    signTransaction: signTx,
    signAllTransactions: async (txs) => {
      for (const tx of txs) await signTx(tx)
      return txs
    },
  }
}

function discriminatorMatches(data: Uint8Array): boolean {
  if (data.length < 8) return false
  for (let i = 0; i < 8; i++) {
    if (data[i] !== INTENT_CAPSULE_DISCRIMINATOR[i]) return false
  }
  return true
}

export async function getEligibleCapsules(connection: Connection): Promise<DecodedCapsule[]> {
  const programId = getProgramId()
  const res = await connection.getProgramAccounts(programId)
  const list = Array.isArray(res) ? res : (res as { value?: typeof res }).value ?? []
  const now = Math.floor(Date.now() / 1000)
  const eligible: DecodedCapsule[] = []
  for (const { pubkey, account } of list) {
    const data = account.data
    if (!data || !discriminatorMatches(new Uint8Array(data))) continue
    const capsule = decodeCapsuleAccount(Buffer.from(data), pubkey)
    if (!capsule) continue
    if (!capsule.isActive || capsule.executedAt != null) continue
    if (capsule.lastActivity + capsule.inactivityPeriod > now) continue
    eligible.push(capsule)
  }
  return eligible
}

export async function executeCapsuleIntent(
  connection: Connection,
  crankKeypair: Keypair,
  capsule: DecodedCapsule
): Promise<string> {
  const wallet = walletFromKeypair(crankKeypair)
  const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' })
  const program = new Program(idl as any, provider)

  const beneficiaries = parseBeneficiaries(capsule.intentData)
  if (beneficiaries.length === 0) throw new Error('No beneficiaries in intent data')

  const [capsulePDA] = getCapsulePDA(capsule.owner)
  const [vaultPDA] = getCapsuleVaultPDA(capsule.owner)
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

  const remainingAccounts = beneficiaries.map((b) => ({
    pubkey: new PublicKey(b.address),
    isSigner: false,
    isWritable: true,
  }))

  const tx = await program.methods
    .executeIntent()
    .accounts(accounts)
    .remainingAccounts(remainingAccounts)
    .rpc()

  return tx
}

export type CrankResult = {
  ok: boolean
  eligibleCount: number
  executedCount: number
  errors: string[]
}

export async function runCrank(crankKeypair: Keypair): Promise<CrankResult> {
  const connection = getSolanaConnection()
  const eligible = await getEligibleCapsules(connection)
  const errors: string[] = []
  let executedCount = 0

  for (const capsule of eligible) {
    try {
      await executeCapsuleIntent(connection, crankKeypair, capsule)
      executedCount += 1
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push(`${capsule.capsuleAddress}: ${msg}`)
    }
  }

  return {
    ok: errors.length === 0,
    eligibleCount: eligible.length,
    executedCount,
    errors,
  }
}
