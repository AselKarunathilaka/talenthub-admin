const fs = require('fs');
const lines = fs.readFileSync('g:/github/TalentHub/frontend/src/pages/AdminSeatManagement.jsx', 'utf8').split('\n');
const match = lines.findIndex(l => l.includes('ref={mapViewportRef}'));
console.log(lines.slice(match - 15, match + 20).join('\n'));
