const fs = require('fs');
const path = 'src/index.css';
const content = fs.readFileSync(path, 'utf8');
const lines = content.split(/\r?\n/);

const replacement = `@media (max-width: 1100px) {
  .bento-container { padding: 16px; }
  .hero-banner-card { margin-bottom: 16px !important; }
}
@media (max-width: 768px) {
  .bento-page-content { padding-top: 0 !important; }
}
@media (max-width: 640px) {
  .bento-container { padding: 14px 10px; }
  .hero-banner-card { margin-bottom: 14px !important; }
}
@media (max-width: 360px) {
  .bento-container { padding: 10px 8px; }
  .hero-banner-card { margin-bottom: 10px !important; }
}`;

lines.splice(1898, 13, replacement);
fs.writeFileSync(path, lines.join('\n'));
console.log('Replaced by line index');
