const fs = require('fs');
const path = 'c:\\Users\\PC_1M\\Desktop\\Heres\\app\\dashboard\\page.tsx';
let content = fs.readFileSync(path, 'utf8');

// replace corrupted text
content = content.replace(/'\?\?/g, "'...'");
content = content.replace(/\?\?/g, '...');
content = content.replace(/諛고룷 \.\.\. 1\.\.\. 珥덇린\.\.\.\.\.\./g, 'Deployment Initialized');
content = content.replace(/\.\대\.\ 珥덇린\.\붾맖/g, 'Already Initialized');
content = content.replace(/\.\섏닔猷\.\.\.\젙 \(諛고룷 \.\.\. 1\.\.\)/g, 'Fee Configuration (Initial)');
content = content.replace(/Fee config媛€ \.\놁쑝硫\.\.\. \.\.\.踰덈쭔 \.\뻾\.\꽭\.\./g, 'Execute once if fee config is missing.');
content = content.replace(/泥섎━ 以\.\.\.\.\./g, 'Processing...');
content = content.replace(/\.\깃났:/g, 'Success:');
content = content.replace(/\.\몃옖\.\.\.\ \蹂닿린/g, 'View Transaction');

fs.writeFileSync(path, content, 'utf8');
console.log('Successfully fixed app/dashboard/page.tsx');
