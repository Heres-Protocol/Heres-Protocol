const fs = require('fs');
const path = 'c:\\Users\\PC_1M\\Desktop\\Heres\\app\\create\\page.tsx';
const content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');
// Truncate at line 1102 (1-indexed)
const cleanLines = lines.slice(0, 1102);
fs.writeFileSync(path, cleanLines.join('\n'), 'utf8');
console.log('Successfully fixed app/create/page.tsx');
