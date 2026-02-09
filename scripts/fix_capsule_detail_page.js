const fs = require('fs');
const path = 'c:\\Users\\PC_1M\\Desktop\\Heres\\app\\capsules\\[address]\\page.tsx';
let content = fs.readFileSync(path, 'utf8');

// Replace all lucid- with Heres-
content = content.replace(/lucid-/g, 'Heres-');
// Replace card-lucid with card-Heres
content = content.replace(/card-lucid/g, 'card-Heres');
// Replace --lucid- with --Heres- (for css variables)
content = content.replace(/--lucid-/g, '--Heres-');

// Fix specific text occurrences if any
// "Lucid" text in UI
content = content.replace(/'Lucid'/g, "'Heres'");
content = content.replace(/>Lucid</g, ">Heres<");

fs.writeFileSync(path, content, 'utf8');
console.log('Successfully updated app/capsules/[address]/page.tsx');
