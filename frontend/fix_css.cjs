const fs = require('fs');
const path = 'src/index.css';
let content = fs.readFileSync(path, 'utf8');

const regex = /@media \(max-width: 1023px\) \{[\s\S]*?@media \(max-width: 640px\) \{[\s\S]*?padding: 14px 10px; \r?\n\}/;

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

if (regex.test(content)) {
  fs.writeFileSync(path, content.replace(regex, replacement));
  console.log('Replaced via regex!');
} else {
  console.log('Regex did not match');
}
