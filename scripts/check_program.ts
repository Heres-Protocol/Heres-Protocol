
import { Connection, PublicKey } from '@solana/web3.js';

async function check() {
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    const programId = new PublicKey('CXVKwAjzQA95MPVyEbsMqSoFgHvbXAmSensTk6JJPKsM');
    const info = await connection.getAccountInfo(programId);
    if (info) {
        console.log('Program found! Executable:', info.executable);
        console.log('Owner:', info.owner.toBase58());
    } else {
        console.log('Program NOT found on devnet');
    }
}

check();
