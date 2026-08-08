const fs = require('fs');
const path = 'src/index.css';
const content = fs.readFileSync(path, 'utf8');
const lines = content.split(/\r?\n/);

let startIdx = lines.findIndex(l => l.includes('/* Hero banner card — same border-radius as other bento cards */'));
if (startIdx !== -1) {
    // Keep the border radius but remove margin-bottom !important
    lines.splice(startIdx, 5, '  /* Hero banner card — same border-radius as other bento cards */', '  .hero-banner-card {', '    border-radius: 14px !important;', '  }');
    fs.writeFileSync(path, lines.join('\n'));
    console.log('Removed bottom hero-banner-card margin override');
} else {
    console.log('Could not find it');
}
