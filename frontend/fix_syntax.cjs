const fs = require('fs');
const file = 'g:/github/TalentHub/frontend/src/pages/AdminSettings.jsx';
let code = fs.readFileSync(file, 'utf8');

// The bad replacement for the first overlay:
//           />
//         )}
//               , document.body)}
//       </AnimatePresence>

code = code.replace(
  /          \/>\n        \)\}\n              , document\.body\)\}/,
  "          />\n        , document.body)}"
);

// wait, the first overlay replace was missing:
code = code.replace(
  /          \/>\n        \)\}/,
  "          />\n        , document.body)}"
);

fs.writeFileSync(file, code);
