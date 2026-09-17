const fs = require('fs');
const file = 'g:/github/TalentHub/frontend/src/pages/AdminSettings.jsx';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('createPortal')) {
  code = code.replace('import React, { useState, useEffect } from "react";', 'import React, { useState, useEffect } from "react";\nimport { createPortal } from "react-dom";');
}

// 1. userModalOpen
code = code.replace(
  /(\{userModalOpen && \()([\s\S]*?)(          <\/div>\n        \)\})/g, 
  '\(\          </div>\n        , document.body)\}'
);

// 2. alertModalOpen
code = code.replace(
  /(\{alertModalOpen && \()([\s\S]*?)(          <\/div>\n        \)\})/g, 
  '\(\          </div>\n        , document.body)\}'
);

// 3. specModalOpen
code = code.replace(
  /(\{specModalOpen && \()([\s\S]*?)(          <\/div>\n        \)\})/g, 
  '\(\          </div>\n        , document.body)\}'
);

// 4. AnimatePresence for security backdrop
code = code.replace(
  /(<AnimatePresence>\s*\{!isVerified && \()([\s\S]*?)(<\/AnimatePresence>)/g,
  (match, p1, p2, p3) => {
    return "<AnimatePresence>\n        {!isVerified && createPortal(" + p2 + "        , document.body)}\n      </AnimatePresence>";
  }
);

// 5. confirmDialog.isOpen
code = code.replace(
  /(\{confirmDialog\.isOpen && \()([\s\S]*?)(          <\/div>\n        \)\})/g, 
  '\(\          </div>\n        , document.body)\}'
);

fs.writeFileSync(file, code);
console.log('Done');
