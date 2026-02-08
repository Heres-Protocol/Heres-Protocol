const { PublicKey } = require('@solana/web3.js');

const programId = new PublicKey('BiAB1qZpx8kDgS5dJxKFdCJDNMagCn8xfj4afNhRZWms');
const magicProgramId = new PublicKey('MPUxHCpNUy3K1CSVhebAmTbcTCKVxfk9YMDcUP2ZnEA');
const delegationProgramId = new PublicKey('DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh');

const target = '7LG3jxWQA41qz3AVWnc63HhrKu1hiRXHUkmjpDxdfaBY';

// Check if it's one of our PDAs for some common owners
const testOwners = [
    'MPUxHCpNUy3K1CSVhebAmTbcTCKVxfk9YMDcUP2ZnEA', // TEE/Magic
    'BiAB1qZpx8kDgS5dJxKFdCJDNMagCn8xfj4afNhRZWms', // Lucid
    'FnE6VJT5QNZdedZPnCoLsARgBwoE6DeJNjBs2H1gySXA', // TEE Validator
];

for (const ownerBase58 of testOwners) {
    const owner = new PublicKey(ownerBase58);

    // Capsule PDA
    const [capsule] = PublicKey.findProgramAddressSync(
        [Buffer.from('intent_capsule'), owner.toBuffer()],
        programId
    );
    if (capsule.toBase58() === target) console.log(`SUCCESS: Capsule PDA for owner ${ownerBase58}`);

    // Vault PDA
    const [vault] = PublicKey.findProgramAddressSync(
        [Buffer.from('capsule_vault'), owner.toBuffer()],
        programId
    );
    if (vault.toBase58() === target) console.log(`SUCCESS: Vault PDA for owner ${ownerBase58}`);

    // Buffer PDA (for Capsule)
    const [buffer] = PublicKey.findProgramAddressSync(
        [Buffer.from('buffer'), capsule.toBuffer()],
        programId
    );
    if (buffer.toBase58() === target) console.log(`SUCCESS: Buffer PDA for Capsule of owner ${ownerBase58}`);

    // Record PDA (for Capsule)
    const [record] = PublicKey.findProgramAddressSync(
        [Buffer.from('delegation'), capsule.toBuffer()],
        delegationProgramId
    );
    if (record.toBase58() === target) console.log(`SUCCESS: Record PDA for Capsule of owner ${ownerBase58}`);
}

console.log('Diagnostic finished.');
