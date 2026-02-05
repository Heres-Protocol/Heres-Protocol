import { Connection, Keypair, PublicKey, SystemProgram } from '@solana/web3.js'
import { Program, AnchorProvider, Wallet } from '@coral-xyz/anchor'
import bs58 from 'bs58'
import fs from 'fs'
import path from 'path'

function loadEnv(): Record<string, string> {
    const envPath = path.join(process.cwd(), '.env.local')
    if (!fs.existsSync(envPath)) return {}
    const content = fs.readFileSync(envPath, 'utf8')
    const env: Record<string, string> = {}
    content.split('\n').forEach(line => {
        const parts = line.split('=')
        if (parts.length === 2) {
            env[parts[0].trim()] = parts[1].trim()
        }
    })
    return env
}

const env = loadEnv()

const idlPath = path.join(process.cwd(), 'idl', 'lucid_program.json')
const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'))

const PROGRAM_ID = new PublicKey('BiAB1qZpx8kDgS5dJxKFdCJDNMagCn8xfj4afNhRZWms')
const HELIUS_RPC = `https://devnet.helius-rpc.com/?api-key=${env.NEXT_PUBLIC_HELIUS_API_KEY}`

async function resetExpiredCapsules() {
    const connection = new Connection(HELIUS_RPC, 'confirmed')

    const privateKey = env.CRANK_WALLET_PRIVATE_KEY
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
        const isExpired = Number(data.lastActivity) + Number(data.inactivityPeriod) < now
        return data.isActive && isExpired
    })

    console.log(`Found ${expiredCapsules.length} expired active capsules.`)

    for (const capsule of expiredCapsules) {
        const owner = capsule.account.owner
        console.log(`Executing capsule for owner: ${owner.toString()}...`)

        try {
            const intentData = capsule.account.intentData as Buffer
            const json = Buffer.from(intentData).toString('utf8')
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

            const platformFeeRecipient = new PublicKey(env.NEXT_PUBLIC_PLATFORM_FEE_RECIPIENT || 'Covn3moA8qstPgXPgueRGMSmi94yXvuDCWTjQVBxHpzb')

            const tx = await program.methods
                .executeIntent()
                .accounts({
                    capsule: capsulePDA,
                    vault: vaultPDA,
                    systemProgram: SystemProgram.programId,
                    feeConfig: feeConfigPDA,
                    platformFeeRecipient: platformFeeRecipient,
                })
                .remainingAccounts(remainingAccounts)
                .rpc()

            console.log(`Successfully executed: ${tx}`)
        } catch (e: any) {
            console.error(`Failed to execute capsule for ${owner.toString()}:`, e.message)
        }
    }

    console.log('Done.')
}

resetExpiredCapsules().catch(console.error)
