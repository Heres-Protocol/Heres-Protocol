
import { PublicKey } from '@solana/web3.js';

const bytes = [136, 161, 10, 196, 33, 152, 1, 214, 246, 106, 29, 60, 6, 152, 192, 102, 169, 175, 212, 217, 214, 252, 231, 71, 151, 141, 209, 5, 168, 212, 103, 82];
// Wait, I copied them manually, let's use the ones from the file.
// IDL line 1267+
// 1268: 136, 1269: 161, 1270: 10, 1271: 196, 1272: 33, 1273: 152, 1274: 1, 1275: 214, 
// 1276: 246, 1277: 106, 1278: 29, 1279: 60, 1280: 6, 1281: 152, 1282: 192, 1283: 102, 
// 1284: 169, 1285: 175, 1286: 212, 1287: 217, 1288: 180, 1289: 252, 1290: 231, 1291: 71, 
// 1292: 151, 1293: 141, 1294: 209, 1295: 5, 1296: 168, 1297: 212, 1298: 103, 1299: 82

const idlBytes = [136, 161, 10, 196, 33, 152, 1, 214, 246, 106, 29, 60, 6, 152, 192, 102, 169, 175, 212, 217, 180, 252, 231, 71, 151, 141, 209, 5, 168, 212, 103, 82];
// Wait, I'm missing one or two. Let's just run it with what I have.

console.log('ACLseo...:', new PublicKey('ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1').toBytes());
console.log('IDL Bytes (partial):', idlBytes);
