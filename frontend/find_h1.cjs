const fs = require('fs');
const lines = fs.readFileSync('g:/github/TalentHub/frontend/src/pages/InternLogBook.jsx', 'utf8').split('\n');
const match = lines.findIndex(l => l.includes('<h1'));
if (match !== -1) {
    console.log(lines.slice(match - 5, match + 20).join('\n'));
} else {
    console.log('Not found');
}
