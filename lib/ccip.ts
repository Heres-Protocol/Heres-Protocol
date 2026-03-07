import { AccountMeta, Connection, Keypair, PublicKey } from '@solana/web3.js'
import { ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, NATIVE_MINT, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { BN } from '@coral-xyz/anchor'

const CCIP_DEVNET = {
  routerProgramId: 'Ccip842gzYHhvdDkSyi2YVCoAWPbYJoApMFzSxQroE9C',
  feeQuoterProgramId: 'FeeQPGkKDeRV1MgoYfMH6L8o3KeuYjwUZrgn4LRKfjHi',
  rmnRemoteProgramId: 'RmnXLft1mSEwDgMKu2okYuHkiazxntFFcZFrrcXxYg7',
  linkTokenMint: 'LinkhB3afbBKb2EQQu7s7umdZceV3wcvAUJhQAfQ23L',
}

type BuildCcipAccountsInput = {
  connection: Connection
  signer: Keypair
  vaultAuthority: PublicKey
  tokenMint: string
  destinationChainSelector: string
}

export type CcipProgramCallAccounts = {
  ccipRouter: PublicKey
  remainingAccounts: AccountMeta[]
}

function isWritable(index: number, writableIndexes: any[]): boolean {
  if (index === 0) return false
  const bnIndex = Math.floor(index / 128)
  const bitPosition = bnIndex === 0 ? 127 - (index % 128) : 255 - (index % 128)
  if (bnIndex < writableIndexes.length) {
    const mask = new BN(1).shln(bitPosition)
    if (writableIndexes[bnIndex].and) return !writableIndexes[bnIndex].and(mask).isZero()
  }
  return false
}

export async function buildCcipAccountsForVaultSend(input: BuildCcipAccountsInput): Promise<CcipProgramCallAccounts> {
  // Runtime load vendored SDK internals
  const { CCIPClient } = require('@/vendor/ccip-svm/core/client')
  const pdas = require('@/vendor/ccip-svm/utils/pdas')
  const { detectTokenProgram } = require('@/vendor/ccip-svm/utils/token')

  const selectorBigInt = BigInt(input.destinationChainSelector)
  const routerProgramId = new PublicKey(CCIP_DEVNET.routerProgramId)
  const feeQuoterProgramId = new PublicKey(CCIP_DEVNET.feeQuoterProgramId)
  const rmnRemoteProgramId = new PublicKey(CCIP_DEVNET.rmnRemoteProgramId)
  const linkTokenMint = new PublicKey(CCIP_DEVNET.linkTokenMint)
  const tokenMint = new PublicKey(input.tokenMint)
  // Use LINK token for CCIP fees (not native SOL) because the vault PDA is program-owned
  // and system_program.transfer from it would fail in the CCIP Router CPI.
  const feeTokenMint = linkTokenMint

  const client = CCIPClient.create(
    input.connection,
    input.signer,
    {
      ccipRouterProgramId: routerProgramId.toBase58(),
      feeQuoterProgramId: feeQuoterProgramId.toBase58(),
      rmnRemoteProgramId: rmnRemoteProgramId.toBase58(),
      linkTokenMint: linkTokenMint.toBase58(),
      tokenMint: tokenMint.toBase58(),
    }
  )
  const accountReader = client.getAccountReader()

  const feeTokenProgramId = TOKEN_PROGRAM_ID
  const [configPDA] = pdas.findConfigPDA(routerProgramId)
  const [destChainState] = pdas.findDestChainStatePDA(selectorBigInt, routerProgramId)
  const [nonce] = pdas.findNoncePDA(selectorBigInt, input.vaultAuthority, routerProgramId)
  const [feeBillingSigner] = pdas.findFeeBillingSignerPDA(routerProgramId)
  const [feeQuoterConfig] = pdas.findFqConfigPDA(feeQuoterProgramId)
  const [feeQuoterDestChain] = pdas.findFqDestChainPDA(selectorBigInt, feeQuoterProgramId)
  const [feeQuoterBillingTokenConfig] = pdas.findFqBillingTokenConfigPDA(feeTokenMint, feeQuoterProgramId)
  const [feeQuoterLinkTokenConfig] = pdas.findFqBillingTokenConfigPDA(linkTokenMint, feeQuoterProgramId)
  const [rmnRemoteCurses] = pdas.findRMNRemoteCursesPDA(rmnRemoteProgramId)
  const [rmnRemoteConfig] = pdas.findRMNRemoteConfigPDA(rmnRemoteProgramId)

  const userFeeTokenAta = await getAssociatedTokenAddress(
    feeTokenMint,
    input.vaultAuthority,
    true,
    feeTokenProgramId,
    ASSOCIATED_TOKEN_PROGRAM_ID
  )
  const feeTokenReceiver = await getAssociatedTokenAddress(
    feeTokenMint,
    feeBillingSigner,
    true,
    feeTokenProgramId,
    ASSOCIATED_TOKEN_PROGRAM_ID
  )

  const fixed: AccountMeta[] = [
    { pubkey: configPDA, isSigner: false, isWritable: false },
    { pubkey: destChainState, isSigner: false, isWritable: true },
    { pubkey: nonce, isSigner: false, isWritable: true },
    { pubkey: input.vaultAuthority, isSigner: false, isWritable: true }, // authority (signed via invoke_signed in program)
    { pubkey: PublicKey.default, isSigner: false, isWritable: false }, // system program (111...)
    { pubkey: feeTokenProgramId, isSigner: false, isWritable: false },
    { pubkey: feeTokenMint, isSigner: false, isWritable: false },
    { pubkey: userFeeTokenAta, isSigner: false, isWritable: true },
    { pubkey: feeTokenReceiver, isSigner: false, isWritable: true },
    { pubkey: feeBillingSigner, isSigner: false, isWritable: false },
    { pubkey: feeQuoterProgramId, isSigner: false, isWritable: false },
    { pubkey: feeQuoterConfig, isSigner: false, isWritable: false },
    { pubkey: feeQuoterDestChain, isSigner: false, isWritable: false },
    { pubkey: feeQuoterBillingTokenConfig, isSigner: false, isWritable: false },
    { pubkey: feeQuoterLinkTokenConfig, isSigner: false, isWritable: false },
    { pubkey: rmnRemoteProgramId, isSigner: false, isWritable: false },
    { pubkey: rmnRemoteCurses, isSigner: false, isWritable: false },
    { pubkey: rmnRemoteConfig, isSigner: false, isWritable: false },
  ]

  const tokenProgram = await detectTokenProgram(tokenMint, input.connection)
  const tokenAdminRegistry = await accountReader.getTokenAdminRegistry(tokenMint)
  const lookupTableAddress = tokenAdminRegistry.lookupTable
  const { value: lookupTable } = await input.connection.getAddressLookupTable(lookupTableAddress)
  if (!lookupTable) throw new Error(`Lookup table not found for token ${tokenMint.toBase58()}`)
  const lookupEntries = lookupTable.state.addresses

  const poolProgram = lookupEntries[2]
  const userTokenAccount = await getAssociatedTokenAddress(
    tokenMint,
    input.vaultAuthority,
    true,
    tokenProgram,
    ASSOCIATED_TOKEN_PROGRAM_ID
  )
  const [tokenBillingConfig] = pdas.findFqPerChainPerTokenConfigPDA(selectorBigInt, tokenMint, feeQuoterProgramId)
  const [poolChainConfig] = pdas.findTokenPoolChainConfigPDA(selectorBigInt, tokenMint, poolProgram)

  const tokenAccounts: AccountMeta[] = [
    { pubkey: userTokenAccount, isSigner: false, isWritable: true },
    { pubkey: tokenBillingConfig, isSigner: false, isWritable: false },
    { pubkey: poolChainConfig, isSigner: false, isWritable: true },
    { pubkey: lookupEntries[0], isSigner: false, isWritable: false },
    ...lookupEntries.slice(1).map((pubkey: PublicKey, index: number) => ({
      pubkey,
      isSigner: false,
      isWritable: isWritable(index + 1, tokenAdminRegistry.writableIndexes),
    })),
  ]

  return {
    ccipRouter: routerProgramId,
    remainingAccounts: [...fixed, ...tokenAccounts],
  }
}
