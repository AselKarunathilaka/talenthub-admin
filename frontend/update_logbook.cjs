const fs = require('fs');
const path = 'g:/github/TalentHub/frontend/src/pages/LogBook.jsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Rename Component
code = code.replace(/const Logbook = \(\) => \{/g, 'const InternLogBook = () => {');
code = code.replace(/export default Logbook;/g, 'export default InternLogBook;');

// 2. Replace Header
const headerRegex = /<div style=\{\{ marginBottom: 32 \}\} className="logbook-fade-in">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/;

const newHeader = `<div className="mb-[clamp(16px,4vw,24px)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-[clamp(12px,3vw,16px)] logbook-fade-in w-full">
              <div className="flex items-center gap-[clamp(10px,2.5vw,16px)]">
                <div className="w-[clamp(40px,10vw,56px)] h-[clamp(40px,10vw,56px)] rounded-[clamp(12px,3vw,16px)] bg-gradient-to-r from-[#000066] to-[#006600] flex items-center justify-center shrink-0 border border-slate-700 shadow-md">
                  <BookOpen className="text-white w-[clamp(20px,5vw,28px)] h-[clamp(20px,5vw,28px)]" />
                </div>
                <div className="flex flex-col justify-center">
                  <h1 className="text-[clamp(18px,5vw,26px)] font-[800] text-[#1a1a2e] leading-tight tracking-tight">
                    Smart LogBook
                  </h1>
                  <p className="text-[#6b7280] mt-[2px] text-[clamp(10px,2vw,12px)] font-medium italic">
                    "{quote}"
                  </p>
                </div>
              </div>
            </div>`;

code = code.replace(headerRegex, newHeader);

// 3. Remove Tips Card
const tipsRegex = /<InfoCard\s*icon=\{<FiInfo \/>\}\s*title="Tips for Better Logging"[\s\S]*?<\/InfoCard>/g;
code = code.replace(tipsRegex, '');
code = code.replace(/<div className="grid gap-4 md:grid-cols-2">/g, '<div className="grid gap-4">');

// 4. Scale down static font sizes to clamp
const fontReplacements = {
  'fontSize: 15,': 'fontSize: "clamp(12px, 3vw, 14px)",',
  'fontSize: 15': 'fontSize: "clamp(12px, 3vw, 14px)"',
  'fontSize: 14,': 'fontSize: "clamp(11px, 2.5vw, 13px)",',
  'fontSize: 14': 'fontSize: "clamp(11px, 2.5vw, 13px)"',
  'fontSize: 13,': 'fontSize: "clamp(11px, 2vw, 12px)",',
  'fontSize: 13': 'fontSize: "clamp(11px, 2vw, 12px)"',
  'fontSize: 12,': 'fontSize: "clamp(10px, 2vw, 12px)",',
  'fontSize: 12': 'fontSize: "clamp(10px, 2vw, 12px)"',
  'fontSize: 16,': 'fontSize: "clamp(13px, 3.5vw, 15px)",',
  'fontSize: 16': 'fontSize: "clamp(13px, 3.5vw, 15px)"',
  'fontSize: 18,': 'fontSize: "clamp(14px, 4vw, 16px)",',
  'fontSize: 18': 'fontSize: "clamp(14px, 4vw, 16px)"',
  'text-sm': 'text-[clamp(11px,2.5vw,13px)]',
  'text-xs': 'text-[clamp(10px,2vw,12px)]',
  'text-base': 'text-[clamp(13px,3vw,15px)]',
  'text-lg': 'text-[clamp(14px,4vw,16px)]',
  'text-\\[13px\\]': 'text-[clamp(11px,2.5vw,13px)]',
  'text-\\[14px\\]': 'text-[clamp(11px,2.5vw,13px)]',
  'text-\\[15px\\]': 'text-[clamp(12px,3vw,14px)]',
  'text-\\[16px\\]': 'text-[clamp(13px,3vw,15px)]',
  'text-\\[18px\\]': 'text-[clamp(14px,4vw,16px)]'
};

for (const [find, replace] of Object.entries(fontReplacements)) {
  const regex = new RegExp(find, 'g');
  code = code.replace(regex, replace);
}

fs.writeFileSync(path, code);
console.log('LogBook.jsx updated successfully!');
