const { PublicKey } = require('@solana/web3.js');
const bs58 = require('bs58');

const id = 'BiAB1qZpx8kDgS5dJxKFdCJDNMagCn8xfj4afNhRZWms';
const bytes = bs58.decode(id);
console.log(Array.from(bytes));
