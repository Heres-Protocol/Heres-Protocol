/**
 * E2E test with crank: CRE register -> Create -> Delegate TEE -> Schedule crank -> wait for auto-execute -> distribute -> CRE dispatch
 *
 * Prerequisites:
 *   1. Add TEST_MNEMONIC="..." to .env.local
 *   2. Run the Next.js dev server: pnpm dev  (for CRE API routes)
 *   3. npx tsx scripts/test-capsule-e2e.ts
 */

import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from '@solana/web3.js'
import { Program, AnchorProvider, BN, Wallet } from '@coral-xyz/anchor'
import { createHash, sign as cryptoSign, createPrivateKey } from 'crypto'
import { getAuthToken, createCommitAndUndelegateInstruction } from '@magicblock-labs/ephemeral-rollups-sdk'
import * as bip39 from 'bip39'
import { derivePath } from 'ed25519-hd-key'
import * as fs from 'fs'
import * as path from 'path'

// ─── Config ────────────────────────────────────────────────────────
const PROGRAM_ID = new PublicKey('CXVKwAjzQA95MPVyEbsMqSoFgHvbXAmSensTk6JJPKsM')
const RPC_URL = 'https://api.devnet.solana.com'
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
const PERMISSION_PROGRAM_ID = new PublicKey('ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1')
const DELEGATION_PROGRAM_ID = new PublicKey('DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh')
const MAGIC_PROGRAM_ID = new PublicKey('Magic11111111111111111111111111111111111111')
const MAGIC_CONTEXT = new PublicKey('MagicContext1111111111111111111111111111111')

// Toggle between TEE (PER) and regular ER
const SKIP_DELEGATION = (process.env.SKIP_DELEGATION ?? 'true') === 'true' // set SKIP_DELEGATION=false to test ER
const USE_TEE = false
const TEE_VALIDATOR = new PublicKey('FnE6VJT5QNZdedZPnCoLsARgBwoE6DeJNjBs2H1gySXA')
const ER_VALIDATOR = new PublicKey('MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57')
const ACTIVE_VALIDATOR = USE_TEE ? TEE_VALIDATOR : ER_VALIDATOR
const TEE_RPC_URL = USE_TEE ? 'https://tee.magicblock.app' : 'https://devnet.magicblock.app'
const APP_BASE_URL = 'http://localhost:3000'

const INACTIVITY_SECONDS = 60 // 1 minute
const TEST_SOL_AMOUNT = '0.01'
const TEST_EMAIL = 'test@example.com'
const TEST_UNLOCK_CODE = 'testcode123456'

// ─── Helpers ───────────────────────────────────────────────────────

function loadEnv() {
  const envPath = path.resolve(__dirname, '..', '.env.local')
  if (!fs.existsSync(envPath)) throw new Error('.env.local not found')
  const content = fs.readFileSync(envPath, 'utf-8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    let val = trimmed.slice(eqIdx + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1)
    if (!process.env[key]) process.env[key] = val
  }
}

function keypairFromMnemonic(mnemonic: string): Keypair {
  const seed = bip39.mnemonicToSeedSync(mnemonic)
  const derived = derivePath("m/44'/501'/0'/0'", seed.toString('hex')).key
  return Keypair.fromSeed(derived)
}

function getCapsulePDA(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from('intent_capsule'), owner.toBuffer()], PROGRAM_ID)
}
function getCapsuleVaultPDA(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from('capsule_vault'), owner.toBuffer()], PROGRAM_ID)
}
function getFeeConfigPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from('fee_config')], PROGRAM_ID)
}
function getPermissionPDA(capsule: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from('permission'), capsule.toBuffer()], PERMISSION_PROGRAM_ID)
}
function getBufferPDA(pda: PublicKey, programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from('buffer'), pda.toBuffer()], programId)
}
function getDelegationRecordPDA(pda: PublicKey, programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from('delegation'), pda.toBuffer()], programId)
}
function getDelegationMetadataPDA(pda: PublicKey, programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from('delegation-metadata'), pda.toBuffer()], programId)
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function signMessageWithKeypair(keypair: Keypair, message: string): string {
  const ED25519_PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex')
  const pkcs8Der = Buffer.concat([ED25519_PKCS8_PREFIX, Buffer.from(keypair.secretKey.slice(0, 32))])
  const privateKey = createPrivateKey({ key: pkcs8Der, format: 'der', type: 'pkcs8' })
  return cryptoSign(null, Buffer.from(message, 'utf8'), privateKey).toString('base64')
}

/** signMessage callback compatible with wallet adapter & TEE SDK */
function makeSignMessage(keypair: Keypair): (message: Uint8Array) => Promise<Uint8Array> {
  return async (message: Uint8Array) => {
    const ED25519_PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex')
    const pkcs8Der = Buffer.concat([ED25519_PKCS8_PREFIX, Buffer.from(keypair.secretKey.slice(0, 32))])
    const privateKey = createPrivateKey({ key: pkcs8Der, format: 'der', type: 'pkcs8' })
    return new Uint8Array(cryptoSign(null, Buffer.from(message), privateKey))
  }
}

function buildCreSignedMessage(input: {
  action: string; owner: string; timestamp: number
  capsuleAddress?: string; recipientEmailHash?: string; encryptedPayloadHash?: string
}): string {
  const parts = [
    'Heres CRE Auth v1', `action:${input.action}`,
    `owner:${input.owner.trim()}`, `timestamp:${Math.trunc(input.timestamp)}`,
  ]
  if (input.capsuleAddress) parts.push(`capsule:${input.capsuleAddress.trim()}`)
  if (input.recipientEmailHash) parts.push(`recipientEmailHash:${input.recipientEmailHash.trim().toLowerCase()}`)
  if (input.encryptedPayloadHash) parts.push(`encryptedPayloadHash:${input.encryptedPayloadHash.trim().toLowerCase()}`)
  return parts.join('\n')
}

function sleep(ms: number) { return new Promise(resolve => setTimeout(resolve, ms)) }
function log(step: string, msg: string) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] [${step}] ${msg}`)
}

// ─── Main ──────────────────────────────────────────────────────────

async function main() {
  loadEnv()
  const mnemonic = process.env.TEST_MNEMONIC
  if (!mnemonic) throw new Error('TEST_MNEMONIC not set in .env.local')

  const keypair = keypairFromMnemonic(mnemonic)
  const owner = keypair.publicKey
  log('INIT', `Owner: ${owner.toBase58()}`)

  // Derive a separate beneficiary address (index 1)
  const beneficiarySeed = bip39.mnemonicToSeedSync(mnemonic)
  const beneficiaryDerived = derivePath("m/44'/501'/1'/0'", beneficiarySeed.toString('hex')).key
  const beneficiaryKeypair = Keypair.fromSeed(beneficiaryDerived)
  const beneficiary = beneficiaryKeypair.publicKey
  log('INIT', `Beneficiary: ${beneficiary.toBase58()}`)

  const connection = new Connection(RPC_URL, 'confirmed')
  const balance = await connection.getBalance(owner)
  log('INIT', `Balance: ${(balance / 1e9).toFixed(4)} SOL`)
  if (balance < 0.05 * 1e9) throw new Error('Insufficient balance')

  // Check dev server
  try { await fetch(`${APP_BASE_URL}/api/intent-delivery/status?capsule=test&owner=test&timestamp=0`) }
  catch { throw new Error(`Dev server not running at ${APP_BASE_URL}. Run: pnpm dev`) }
  log('INIT', 'Dev server running')

  const wallet = new Wallet(keypair)
  const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' })
  const idl = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'idl', 'heres_program.json'), 'utf-8'))
  idl.address = PROGRAM_ID.toBase58()
  const program = new Program(idl as any, provider)

  const [capsulePDA] = getCapsulePDA(owner)
  const [vaultPDA] = getCapsuleVaultPDA(owner)
  const [feeConfigPDA] = getFeeConfigPDA()

  const feeConfigAccount = await connection.getAccountInfo(feeConfigPDA)
  const platformFeeRecipient = feeConfigAccount && feeConfigAccount.data.length >= 72
    ? new PublicKey(feeConfigAccount.data.slice(40, 72))
    : owner
  log('INIT', `Fee recipient: ${platformFeeRecipient.toBase58()}`)
  log('INIT', `Capsule PDA: ${capsulePDA.toBase58()}`)

  // ─── Cancel existing capsule ───────────────────────────────────
  const existing = await connection.getAccountInfo(capsulePDA)
  if (existing) {
    // If capsule is delegated, undelegate first
    if (existing.owner.equals(DELEGATION_PROGRAM_ID)) {
      log('INIT', 'Capsule is delegated. Committing & undelegating on base layer...')
      try {
        const undelegateIx = createCommitAndUndelegateInstruction(owner, [capsulePDA, vaultPDA])
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
        const tx = new Transaction({ feePayer: owner, blockhash, lastValidBlockHeight })
        tx.add(undelegateIx)
        tx.sign(keypair)
        const txSig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: true })
        await connection.confirmTransaction({ signature: txSig, blockhash, lastValidBlockHeight }, 'confirmed')
        log('INIT', `Commit & undelegate TX: ${txSig}`)

        for (let i = 0; i < 20; i++) {
          await sleep(3000)
          const acct = await connection.getAccountInfo(capsulePDA)
          if (acct && acct.owner.equals(PROGRAM_ID)) { log('INIT', 'Capsule back on base layer.'); break }
          if (i % 3 === 2) log('INIT', `Waiting for undelegation... ${(i+1)*3}s`)
        }
      } catch (e: any) {
        log('INIT', `Undelegate failed: ${e.message?.slice(0, 200)}`)
      }
    }

    log('INIT', 'Cancelling existing capsule...')
    try {
      const tx = await program.methods.cancelCapsule()
        .accounts({ capsule: capsulePDA, vault: vaultPDA, owner, systemProgram: SystemProgram.programId }).rpc()
      log('INIT', `Cancelled. TX: ${tx}`)
      await sleep(2000)
    } catch (e: any) { log('INIT', `Cancel failed: ${e.message?.slice(0, 80)}`) }
  }

  // ═══ Step 1: CRE Register ═════════════════════════════════════
  log('STEP 1', 'Registering CRE secret...')
  const fakeEncryptedPayload = JSON.stringify({
    v: 1, alg: 'AES-GCM', kdf: 'PBKDF2', hash: 'SHA-256', iterations: 120000,
    salt: Buffer.from('test-salt-12345678').toString('base64'),
    iv: Buffer.from('test-iv-1234').toString('base64'),
    ciphertext: Buffer.from('E2E test encrypted with ' + TEST_UNLOCK_CODE).toString('base64'),
  })
  const normalizedEmail = TEST_EMAIL.trim().toLowerCase()
  const recipientEmailHash = sha256Hex(normalizedEmail)
  const encryptedPayloadHash = sha256Hex(fakeEncryptedPayload)
  const ts1 = Date.now()
  const sig1 = signMessageWithKeypair(keypair, buildCreSignedMessage({
    action: 'register-secret', owner: owner.toBase58(), timestamp: ts1, recipientEmailHash, encryptedPayloadHash,
  }))
  const regRes = await fetch(`${APP_BASE_URL}/api/intent-delivery/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ owner: owner.toBase58(), recipientEmail: normalizedEmail, encryptedPayload: fakeEncryptedPayload, timestamp: ts1, signature: sig1 }),
  })
  const regJson = await regRes.json() as any
  if (!regRes.ok) throw new Error(`CRE register failed: ${regJson.error}`)
  log('STEP 1', `CRE registered! ref=${regJson.secretRef}`)

  // ═══ Step 2: Create Capsule ═══════════════════════════════════
  log('STEP 2', 'Creating capsule...')
  const intentData = JSON.stringify({
    intent: 'E2E crank test', totalAmount: TEST_SOL_AMOUNT, inactivityDays: 1, delayDays: 0,
    beneficiaries: [{ address: beneficiary.toBase58(), amount: TEST_SOL_AMOUNT, amountType: 'fixed' }],
    cre: { enabled: true, secretRef: regJson.secretRef, secretHash: regJson.secretHash, recipientEmailHash, deliveryChannel: 'email' },
  })
  const createTx = await program.methods
    .createCapsule(new BN(INACTIVITY_SECONDS), Buffer.from(intentData))
    .accounts({
      capsule: capsulePDA, vault: vaultPDA, owner, feeConfig: feeConfigPDA, platformFeeRecipient,
      systemProgram: SystemProgram.programId, tokenProgram: TOKEN_PROGRAM_ID,
      mint: null, sourceTokenAccount: null, vaultTokenAccount: null,
      associatedTokenProgram: new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'),
    }).rpc()
  log('STEP 2', `Capsule created! TX: ${createTx}`)

  if (SKIP_DELEGATION) {
    // ═══ Base Layer Flow: Wait for inactivity period, then execute directly ═══
    log('STEP 3', `Skipping delegation. Waiting ${INACTIVITY_SECONDS}s for inactivity period...`)
    for (let elapsed = 0; elapsed < INACTIVITY_SECONDS + 10; elapsed += 10) {
      await sleep(10000)
      log('STEP 3', `${elapsed + 10}s / ${INACTIVITY_SECONDS}s`)
    }

    log('STEP 4', 'Executing intent on base layer...')
    const [permissionPDA] = getPermissionPDA(capsulePDA)
    try {
      const executeTx = await program.methods.executeIntent()
        .accounts({ capsule: capsulePDA, vault: vaultPDA, permissionProgram: PERMISSION_PROGRAM_ID, permission: permissionPDA }).rpc()
      log('STEP 4', `Execute TX: ${executeTx}`)
    } catch (e: any) {
      log('STEP 4', `Execute failed: ${e.message?.slice(0, 200)}`)
      if (e.logs) console.log('Logs:', e.logs.slice(-5))
    }
    await sleep(2000)

  } else {
    // ═══ ER Flow: Delegate → Crank → Execute on ER → Undelegate ═══
    log('STEP 3', 'Delegating capsule to ER...')
    const [bufferPDA] = getBufferPDA(capsulePDA, MAGIC_PROGRAM_ID)
    const [delegationRecordPDA] = getDelegationRecordPDA(capsulePDA, DELEGATION_PROGRAM_ID)
    const [delegationMetadataPDA] = getDelegationMetadataPDA(capsulePDA, DELEGATION_PROGRAM_ID)
    const [vaultBufferPDA] = getBufferPDA(vaultPDA, MAGIC_PROGRAM_ID)
    const [vaultDelegationRecordPDA] = getDelegationRecordPDA(vaultPDA, DELEGATION_PROGRAM_ID)
    const [vaultDelegationMetadataPDA] = getDelegationMetadataPDA(vaultPDA, DELEGATION_PROGRAM_ID)

    try {
      const delegateTx = await program.methods.delegateCapsule()
        .accounts({
          payer: owner, owner, validator: ACTIVE_VALIDATOR,
          pda: capsulePDA, pdaBuffer: bufferPDA, pdaDelegationRecord: delegationRecordPDA, pdaDelegationMetadata: delegationMetadataPDA,
          vault: vaultPDA, vaultBuffer: vaultBufferPDA, vaultDelegationRecord: vaultDelegationRecordPDA, vaultDelegationMetadata: vaultDelegationMetadataPDA,
          magicProgram: MAGIC_PROGRAM_ID, delegationProgram: DELEGATION_PROGRAM_ID, systemProgram: SystemProgram.programId,
        }).rpc()
      log('STEP 3', `Delegated! TX: ${delegateTx}`)
    } catch (e: any) {
      log('STEP 3', `Delegation failed: ${e.message?.slice(0, 120)}`)
    }

    await sleep(5000)

    let erRpcUrl = TEE_RPC_URL
    if (USE_TEE) {
      log('STEP 4', 'Getting TEE auth token...')
      try {
        const result = await getAuthToken(TEE_RPC_URL, owner, makeSignMessage(keypair))
        erRpcUrl = `${TEE_RPC_URL}?token=${result.token}`
        log('STEP 4', 'TEE auth obtained!')
      } catch (e: any) { log('STEP 4', `TEE auth failed: ${e.message?.slice(0, 100)}`) }
    } else {
      log('STEP 4', 'Using regular ER (no auth)')
    }

    log('STEP 4', 'Scheduling crank on ER...')
    const erConn = new Connection(erRpcUrl, 'confirmed')
    const erProv = new AnchorProvider(erConn, wallet, { commitment: 'confirmed' })
    const erIdl = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'idl', 'heres_program.json'), 'utf-8'))
    erIdl.address = PROGRAM_ID.toBase58()
    const erProg = new Program(erIdl as any, erProv)
    const [permissionPDA] = getPermissionPDA(capsulePDA)

    try {
      const ix = await erProg.methods
        .scheduleExecuteIntent({ taskId: new BN(Date.now()), executionIntervalMillis: new BN(10000), iterations: new BN(100) })
        .accounts({ magicProgram: MAGIC_PROGRAM_ID, payer: owner, capsule: capsulePDA, vault: vaultPDA, permissionProgram: PERMISSION_PROGRAM_ID, permission: permissionPDA })
        .instruction()
      const { blockhash, lastValidBlockHeight } = await erConn.getLatestBlockhash('confirmed')
      const tx = new Transaction({ feePayer: owner, blockhash, lastValidBlockHeight })
      tx.add(ix)
      tx.sign(keypair)
      const txSig = await erConn.sendRawTransaction(tx.serialize(), { skipPreflight: true })
      await erConn.confirmTransaction({ signature: txSig, blockhash, lastValidBlockHeight }, 'confirmed')
      log('STEP 4', `Crank scheduled! TX: ${txSig}`)
    } catch (e: any) {
      log('STEP 4', `Crank scheduling failed: ${e.message?.slice(0, 120)}`)
    }

    // Wait for crank or manual execute
    const maxWait = INACTIVITY_SECONDS + 60
    log('STEP 5', `Waiting up to ${maxWait}s for crank...`)
    let executed = false
    for (let elapsed = 0; elapsed < maxWait; elapsed += 10) {
      await sleep(10000)
      try {
        const erAccount = await erConn.getAccountInfo(capsulePDA)
        if (erAccount && erAccount.data.length > 60) {
          const off = 8 + 32 + 8 + 8
          const iLen = erAccount.data[off] | (erAccount.data[off+1] << 8) | (erAccount.data[off+2] << 16) | (erAccount.data[off+3] << 24)
          if (erAccount.data[off + 4 + iLen] !== 1) {
            log('STEP 5', `Crank executed on ER after ${elapsed + 10}s!`)
            executed = true
            break
          }
        }
      } catch {}
      log('STEP 5', `${elapsed + 10}s elapsed...`)
    }

    if (!executed) {
      log('STEP 5', 'Fallback: manual execute on ER...')
      try {
        const ix = await erProg.methods.executeIntent()
          .accounts({ capsule: capsulePDA, vault: vaultPDA, permissionProgram: PERMISSION_PROGRAM_ID, permission: permissionPDA }).instruction()
        const { blockhash, lastValidBlockHeight } = await erConn.getLatestBlockhash('confirmed')
        const tx = new Transaction({ feePayer: owner, blockhash, lastValidBlockHeight })
        tx.add(ix)
        tx.sign(keypair)
        const txSig = await erConn.sendRawTransaction(tx.serialize(), { skipPreflight: true })
        await erConn.confirmTransaction({ signature: txSig, blockhash, lastValidBlockHeight }, 'confirmed')
        log('STEP 5', `Manual execute TX: ${txSig}`)
      } catch (e: any) { log('STEP 5', `Execute failed: ${e.message?.slice(0, 150)}`) }
    }

    // Undelegate
    log('STEP 5b', 'Undelegating on ER...')
    try {
      const [bufPDA] = getBufferPDA(capsulePDA, MAGIC_PROGRAM_ID)
      const ix = await erProg.methods.undelegateCapsule()
        .accounts({ payer: owner, owner, capsule: capsulePDA, vault: vaultPDA, buffer: bufPDA, magicContext: MAGIC_CONTEXT, magicProgram: MAGIC_PROGRAM_ID, systemProgram: SystemProgram.programId })
        .instruction()
      const { blockhash, lastValidBlockHeight } = await erConn.getLatestBlockhash('confirmed')
      const tx = new Transaction({ feePayer: owner, blockhash, lastValidBlockHeight })
      tx.add(ix)
      tx.sign(keypair)
      const txSig = await erConn.sendRawTransaction(tx.serialize(), { skipPreflight: true })
      await erConn.confirmTransaction({ signature: txSig, blockhash, lastValidBlockHeight }, 'confirmed')
      log('STEP 5b', `Undelegate TX: ${txSig}`)
    } catch (e: any) { log('STEP 5b', `Undelegate failed: ${e.message?.slice(0, 150)}`) }

    log('STEP 5b', 'Waiting for base layer propagation...')
    for (let i = 0; i < 30; i++) {
      await sleep(5000)
      const acct = await connection.getAccountInfo(capsulePDA)
      if (acct && acct.owner.equals(PROGRAM_ID)) { log('STEP 5b', `Back on base layer after ${(i+1)*5}s`); break }
      if (i % 3 === 2) log('STEP 5b', `${(i+1)*5}s elapsed... still delegated`)
    }
  }

  // ═══ Step 6: Distribute Assets ════════════════════════════════
  log('STEP 6', 'Distributing assets...')
  try {
    const distributeTx = await program.methods.distributeAssets()
      .accounts({
        capsule: capsulePDA, vault: vaultPDA, systemProgram: SystemProgram.programId, tokenProgram: TOKEN_PROGRAM_ID,
        feeConfig: feeConfigPDA, platformFeeRecipient, mint: null, vaultTokenAccount: null,
      })
      .remainingAccounts([{ pubkey: beneficiary, isSigner: false, isWritable: true }])
      .rpc()
    log('STEP 6', `Distributed! TX: ${distributeTx}`)
  } catch (e: any) {
    log('STEP 6', `Distribute failed: ${e.message?.slice(0, 120)}`)
  }
  await sleep(2000)

  // ═══ Step 7: CRE Dispatch ═════════════════════════════════════
  log('STEP 7', 'Triggering CRE delivery...')
  const dispatchSecret = process.env.CRE_DISPATCH_SECRET || process.env.CRON_SECRET || ''
  const cronRes = await fetch(`${APP_BASE_URL}/api/cre/dispatch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${dispatchSecret}` },
    body: JSON.stringify({ capsuleAddress: capsulePDA.toBase58() }),
  })
  const cronJson = await cronRes.json() as any
  log('STEP 7', `CRE dispatch [${cronRes.status}]: ${JSON.stringify(cronJson)}`)

  // ═══ Step 8: Check CRE Status ═════════════════════════════════
  log('STEP 8', 'Checking CRE delivery status...')
  const ts8 = Date.now()
  const statusSig = signMessageWithKeypair(keypair, buildCreSignedMessage({
    action: 'delivery-status', owner: owner.toBase58(), timestamp: ts8, capsuleAddress: capsulePDA.toBase58(),
  }))
  const statusRes = await fetch(`${APP_BASE_URL}/api/intent-delivery/status?${new URLSearchParams({
    capsule: capsulePDA.toBase58(), owner: owner.toBase58(), timestamp: String(ts8),
  })}`, { headers: { 'x-cre-signature': statusSig } })
  if (statusRes.ok) {
    log('STEP 8', `Status: ${JSON.stringify(await statusRes.json())}`)
  } else {
    log('STEP 8', `Status check [${statusRes.status}]: ${await statusRes.text()}`)
  }

  // ─── Done ──────────────────────────────────────────────────────
  const finalBalance = await connection.getBalance(owner)
  const beneficiaryBalance = await connection.getBalance(beneficiary)
  log('DONE', `Owner final balance: ${(finalBalance / 1e9).toFixed(4)} SOL`)
  log('DONE', `Beneficiary balance: ${(beneficiaryBalance / 1e9).toFixed(9)} SOL`)
  log('DONE', beneficiaryBalance > 0 ? 'Beneficiary received SOL! Demo ready.' : 'Beneficiary did not receive SOL.')
  log('DONE', 'Full E2E test complete!')
}

main().catch((err) => {
  console.error('\nTest failed:', err.message)
  process.exit(1)
})
