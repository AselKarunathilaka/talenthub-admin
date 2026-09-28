const fs = require('fs');
let c = fs.readFileSync('src/pages/DailyRecords.jsx', 'utf8');

// Find current overlay className in Day Details Modal
const idx = c.indexOf('inset-0 z-20 flex items-center justify-center');
if (idx === -1) {
  console.log('Not found!');
  process.exit(1);
}
const snippet = c.substring(idx - 20, idx + 120);
console.log('Current overlay class area:\n', snippet);

// Replace: add left offset for sidebar so modal centers in content area
// The admin sidebar is 90px collapsed / 176px expanded. Using 90px as minimum always-visible offset.
const OLD_CLASS = 'fixed inset-0 z-20 flex items-center justify-center p-4 pt-20 pb-14 bg-slate-900/40 backdrop-blur-sm';
const NEW_CLASS = 'fixed inset-0 z-20 flex items-center justify-center p-4 pt-16 pb-10 pl-[90px] bg-slate-900/40 backdrop-blur-sm';

if (c.includes(OLD_CLASS)) {
  c = c.replace(OLD_CLASS, NEW_CLASS);
  console.log('Fixed: modal now centers in content area (offset 90px for sidebar)');
} else {
  console.log('Could not find exact string. Trying substring replace...');
  c = c.replace('pt-20 pb-14 bg-slate-900/40', 'pt-16 pb-10 pl-[90px] bg-slate-900/40');
  console.log('Applied fallback replacement');
}

fs.writeFileSync('src/pages/DailyRecords.jsx', c);
console.log('Done');
