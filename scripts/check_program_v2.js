const { Connection, PublicKey } = require('@solana/web3.js');

async function main() {
    const programId = new PublicKey('CXVKwAjzQA95MPVyEbsMqSoFgHvbXAmSensTk6JJPKsM');
    const teeRpc = 'https://tee.magicblock.app';
    const connection = new Connection(teeRpc, 'confirmed');

    console.log('Checking program on TEE RPC:', teeRpc);
    try {
        const info = await connection.getAccountInfo(programId);
        if (info) {
            console.log('✓ Program found on TEE RPC!');
            console.log('  Owner:', info.owner.toBase58());
            console.log('  Data size:', info.data.length);
        } else {
            console.log('✗ Program NOT FOUND on TEE RPC.');
        }
    } catch (e) {
        console.error('✗ Error checking TEE RPC:', e.message);
    }

    const devnet = 'https://api.devnet.solana.com';
    const devnetConn = new Connection(devnet, 'confirmed');
    console.log('\nChecking program on Devnet:', devnet);
    try {
        const info = await devnetConn.getAccountInfo(programId);
        if (info) {
            console.log('✓ Program found on Devnet!');
            console.log('  Owner:', info.owner.toBase58());
        } else {
            console.log('✗ Program NOT FOUND on Devnet.');
        }
    } catch (e) {
        console.error('✗ Error checking Devnet:', e.message);
    }
}

main();
