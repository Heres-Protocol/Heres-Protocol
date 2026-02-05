import { Connection, Keypair, PublicKey } from '@solana/web3.js'
import { Program, AnchorProvider, Wallet } from '@coral-xyz/anchor'
import bs58 from 'bs58'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'

// Load environment variables
dotenv.config({ path: '.env.local' })

const idlPath = path.join(process.cwd(), 'idl', 'lucid_program.json')
const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'))

const PROGRAM_ID = new PublicKey('BiAB1qZpx8kDgS5dJxKFdCJDNMagCn8xfj4afNhRZWms')
const HELIUS_RPC = `https://devnet.helius-rpc.com/?api-key=${process.env.NEXT_PUBLIC_HELIUS_API_KEY}`

async function resetExpiredCapsules() {
    const connection = new Connection(HELIUS_RPC, 'confirmed')

    const privateKey = process.env.CRANK_WALLET_PRIVATE_KEY
    if (!privateKey) {
        console.error('CRANK_WALLET_PRIVATE_KEY not found')
        return
    }

    const keypair = Keypair.fromSecretKey(bs58.decode(privateKey))
    const wallet = new Wallet(keypair)
    const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' })
    const program = new Program(idl as any, provider)

    console.log('Fetching all capsules...')
    const capsules = await program.account.intentCapsule.all()
    console.log(`Found ${capsules.length} capsules total.`)

    const now = Math.floor(Date.now() / 1000)
    const expiredCapsules = capsules.filter((c: any) => {
        const data = c.account
        return data.isActive && (Number(data.lastActivity) + Number(data.inactivityPeriod) < now)
    })

    console.log(`Found ${expiredCapsules.length} expired active capsules.`)

    for (const capsule of expiredCapsules) {
        const owner = capsule.account.owner
        console.log(`Executing capsule for owner: ${owner.toString()}...`)

        try {
            // Decode intent_data to get beneficiaries (needed for remainingAccounts)
            const intentData = capsule.account.intentData
            const json = new TextDecoder().decode(intentData)
            const data = JSON.parse(json)

            const beneficiaries = data.beneficiaries || []
            const remainingAccounts = beneficiaries.map((b: any) => ({
                pubkey: new PublicKey(b.address),
                isSigner: false,
                isWritable: true,
            }))

            const [capsulePDA] = PublicKey.findProgramAddressSync(
                [Buffer.from('intent_capsule'), owner.toBuffer()],
                PROGRAM_ID
            )
            const [vaultPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from('capsule_vault'), owner.toBuffer()],
                PROGRAM_ID
            )
            const [feeConfigPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from('fee_config')],
                PROGRAM_ID
            )

            const platformFeeRecipient = new PublicKey(process.env.NEXT_PUBLIC_PLATFORM_FEE_RECIPIENT || 'Covn3moA8qstPgXPgueRGMSmi94yXvuDCWTjQVBxHpzb')

            const tx = await program.methods
                .executeIntent()
                .accounts({
                    capsule: capsulePDA,
                    vault: vaultPDA,
                    systemProgram: PublicKey.default,
                    feeConfig: feeConfigPDA,
                    platformFeeRecipient: platformFeeRecipient,
                })
                .remainingAccounts(remainingAccounts)
                .rpc()

            console.log(`Successfully executed: ${tx}`)
        } catch (e) {
            console.error(`Failed to execute capsule for ${owner.toString()}:`, e)
        }
    }

    console.log('Done.')
}

resetExpiredCapsules().catch(console.error)
