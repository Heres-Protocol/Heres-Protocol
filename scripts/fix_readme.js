const fs = require('fs');
const path = 'c:\\Users\\PC_1M\\Desktop\\Heres\\README.md';
let content = fs.readFileSync(path, 'utf8');

// Replace all Lucid with Heres (case sensitive usually good, but let's be careful about casing)
// "Lucid" -> "Heres"
content = content.replace(/Lucid/g, 'Heres');
// "lucid" -> "heres" (lowercase)
content = content.replace(/lucid/g, 'heres');
// "LUCID" -> "HERES" (uppercase)
content = content.replace(/LUCID/g, 'HERES');

// Specific fix for "Lucide-react" if it was accidentally changed (but README probably doesn't have imports)
// If README mentions "Lucid_solana", it becomes "Heres_solana" which is fine for folder structure description.

fs.writeFileSync(path, content, 'utf8');
console.log('Successfully updated README.md');
