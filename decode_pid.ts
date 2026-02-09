import { PublicKey } from '@solana/web3.js';

const bytes = [171, 64, 2, 96, 10, 8, 71, 201, 114, 91, 150, 159, 147, 140, 75, 174, 21, 46, 156, 14, 206, 240, 91, 99, 17, 144, 243, 104, 187, 252, 1, 208];
const pubkey = new PublicKey(new Uint8Array(bytes));
console.log("Decoded IDL Program ID:", pubkey.toString());
