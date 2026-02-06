const { Connection, Keypair, PublicKey, SystemProgram } = require('@solana/web3.js');
const { Program, AnchorProvider, Wallet } = require('@coral-xyz/anchor');
const bs58 = require('bs58');
const fs = require('fs');
const path = require('path');

function loadEnv() {
    const envPath = path.join(process.cwd(), '.env.local');
    if (!fs.existsSync(envPath)) return {};
    const content = fs.readFileSync(envPath, 'utf8');
    const env = {};
    content.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length === 2) {
            env[parts[0].trim()] = parts[1].trim();
        }
    });
    return env;
}

const env = loadEnv();

const idlPath = path.join(process.cwd(), 'idl', 'lucid_program.json');
const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));

const PROGRAM_ID = new PublicKey('BiAB1qZpx8kDgS5dJxKFdCJDNMagCn8xfj4afNhRZWms');
const HELIUS_RPC = `https://devnet.helius-rpc.com/?api-key=${env.NEXT_PUBLIC_HELIUS_API_KEY}`;
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

function getAssociatedTokenAddress(mint, owner) {
    return PublicKey.findProgramAddressSync(
        [
            owner.toBuffer(),
            TOKEN_PROGRAM_ID.toBuffer(),
            mint.toBuffer(),
        ],
        SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID
    )[0];
}

async function resetExpiredCapsules() {
    const connection = new Connection(HELIUS_RPC, 'confirmed');

    const privateKey = env.CRANK_WALLET_PRIVATE_KEY;
    if (!privateKey) {
        console.error('CRANK_WALLET_PRIVATE_KEY not found');
        return;
    }

    const keypair = Keypair.fromSecretKey(bs58.decode(privateKey));
    const wallet = new Wallet(keypair);
    const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
    const program = new Program(idl, provider);

    console.log('Fetching all capsules...');
    const capsules = await program.account.intentCapsule.all();
    console.log(`Found ${capsules.length} capsules total.`);

    const now = Math.floor(Date.now() / 1000);
    const expiredCapsules = capsules.filter(c => {
        const data = c.account;
        const isExpired = Number(data.lastActivity) + Number(data.inactivityPeriod) < now;
        return data.isActive && isExpired;
    });

    console.log(`Found ${expiredCapsules.length} expired active capsules.`);

    for (const capsule of expiredCapsules) {
        const owner = capsule.account.owner;
        const capsuleKey = capsule.publicKey;
        console.log(`Processing capsule: ${capsuleKey.toString()} (Owner: ${owner.toString()})...`);

        // Check for delegation
        const accountInfo = await connection.getAccountInfo(capsuleKey);
        if (accountInfo && accountInfo.owner.toString() === 'DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh') {
            console.log(`Capsule ${capsuleKey.toString()} is DELEGATED. Skipping base layer execution.`);
            continue;
        }

        try {
            const intentData = capsule.account.intentData;
            const json = Buffer.from(intentData).toString('utf8');
            const data = JSON.parse(json);

            const mint = capsule.account.mint;
            const isSpl = mint && !mint.equals(PublicKey.default) && !mint.equals(SystemProgram.programId);

            console.log(`Capsule type: ${isSpl ? 'SPL' : 'SOL'} (Mint: ${mint ? mint.toString() : 'None'})`);

            const beneficiaries = data.beneficiaries || [];
            const remainingAccounts = beneficiaries.map(b => {
                const beneficiaryOwner = new PublicKey(b.address);
                if (isSpl) {
                    const beneficiaryAta = getAssociatedTokenAddress(mint, beneficiaryOwner);
                    return {
                        pubkey: beneficiaryAta,
                        isSigner: false,
                        isWritable: true,
                    };
                } else {
                    return {
                        pubkey: beneficiaryOwner,
                        isSigner: false,
                        isWritable: true,
                    };
                }
            });

            const [capsulePDA] = PublicKey.findProgramAddressSync(
                [Buffer.from('intent_capsule'), owner.toBuffer()],
                PROGRAM_ID
            );
            const [vaultPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from('capsule_vault'), owner.toBuffer()],
                PROGRAM_ID
            );
            const [feeConfigPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from('fee_config')],
                PROGRAM_ID
            );

            const platformFeeRecipient = new PublicKey(env.NEXT_PUBLIC_PLATFORM_FEE_RECIPIENT || 'Covn3moA8qstPgXPgueRGMSmi94yXvuDCWTjQVBxHpzb');

            let vaultTokenAccount = null;
            if (isSpl) {
                vaultTokenAccount = getAssociatedTokenAddress(mint, vaultPDA);
            }

            const tx = await program.methods
                .executeIntent()
                .accounts({
                    capsule: capsulePDA,
                    vault: vaultPDA,
                    systemProgram: SystemProgram.programId,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    feeConfig: feeConfigPDA,
                    platformFeeRecipient: platformFeeRecipient,
                    vaultTokenAccount: vaultTokenAccount,
                })
                .remainingAccounts(remainingAccounts)
                .rpc();

            console.log(`Successfully executed: ${tx}`);
        } catch (e) {
            console.error(`Failed to execute capsule for ${owner.toString()}:`, e.message);
        }
    }

    console.log('Done.');
}

resetExpiredCapsules().catch(console.error);

