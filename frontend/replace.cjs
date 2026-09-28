const fs = require('fs');
const file = 'g:/github/TalentHub/frontend/src/pages/DailyRecords.jsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('framer-motion')) {
  content = content.replace(
    'import { useNavigate, useLocation, Link } from "react-router-dom";',
    'import { useNavigate, useLocation, Link } from "react-router-dom";\nimport { motion, AnimatePresence } from "framer-motion";'
  );
}

// Replace the modal start
content = content.replace(
  /\{isDayModalOpen && selectedDate && \(\s*<div className=\"fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900\/40 backdrop-blur-sm\">\s*<div className=\"bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-\[85vh\]\">/g,
  `<AnimatePresence>
      {isDayModalOpen && selectedDate && (
        <motion.div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
          initial={isAdmin ? { opacity: 0 } : false}
          animate={isAdmin ? { opacity: 1 } : false}
          exit={isAdmin ? { opacity: 0 } : false}
          onClick={() => setIsDayModalOpen(false)}
        >
          <motion.div 
            className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            initial={isAdmin ? { scale: 0.9, y: 20 } : false}
            animate={isAdmin ? { scale: 1, y: 0 } : false}
            exit={isAdmin ? { scale: 0.9, y: 20 } : false}
            onClick={(e) => e.stopPropagation()}
          >`
);

// Replace the modal end which matches the end of the day modal structure
content = content.replace(
  /<\/div>\s*<\/div>\s*<\/div>\s*\)\}/,
  `</div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>`
);

fs.writeFileSync(file, content);
console.log('Replacement done.');
