
import { Connection, PublicKey } from '@solana/web3.js';

async function check() {
    const connection = new Connection('https://tee.magicblock.app', 'confirmed');
    const programId = new PublicKey('CXVKwAjzQA95MPVyEbsMqSoFgHvbXAmSensTk6JJPKsM');
    try {
        const info = await connection.getAccountInfo(programId);
        if (info) {
            console.log('Program found on TEE RPC! Executable:', info.executable);
            console.log('Owner:', info.owner.toBase58());
        } else {
            console.log('Program NOT found on TEE RPC');
        }
    } catch (e) {
        console.log('Error connecting to TEE RPC:', e);
    }
}

check();
