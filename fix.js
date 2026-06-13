const fs = require('fs');

function cleanFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let lines = content.split('\n');
  let newLines = [];
  let inHeader = false;
  
  for (let i = 0; i < lines.length; i++) {
    // Remove Enhanced Top Navbar entirely
    if (lines[i].includes('{/* Enhanced Top Navbar */}')) {
      inHeader = true;
      continue;
    }
    if (inHeader && lines[i].includes('</motion.header>')) {
      inHeader = false;
      continue;
    }
    if (inHeader) continue;
    
    // Remove pt-[4.5rem] wrapping div
    if (lines[i].includes('<div className="pt-[4.5rem] sm:pt-[5.5rem]">')) {
      continue;
    }
    // Remove Main Content wrapper
    if (lines[i].includes('<main className="flex-1 p-3 sm:p-4 lg:p-6">')) {
      // replace with just <div className="p-3 sm:p-4 lg:p-6">
      newLines.push(lines[i].replace('<main className="flex-1 p-3 sm:p-4 lg:p-6">', '<div className="p-3 sm:p-4 lg:p-6 relative z-10">'));
      continue;
    }

    if (lines[i].includes('</main>')) {
        newLines.push(lines[i].replace('</main>', '</div>'));
        continue;
    }

    // Try to remove the last matching </div> that corresponds to the pt-[4.5rem] div
    if (i === lines.length - 5 && lines[i].trim() === '</div>') {
      continue;
    }
    
    newLines.push(lines[i]);
  }
  
  fs.writeFileSync(filePath, newLines.join('\n'));
}

cleanFile('frontend/src/pages/AdminDailyRecords.jsx');

function cleanQRFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let lines = content.split('\n');
  let newLines = [];
  let inHeader = false;
  
  for (let i = 0; i < lines.length; i++) {
    // Remove Top Navbar entirely
    if (lines[i].includes('{/* Top Navbar */}')) {
      inHeader = true;
      continue;
    }
    if (inHeader && lines[i].includes('</header>')) {
      inHeader = false;
      continue;
    }
    if (inHeader) continue;
    
    // Replace pt-[5.5rem]
    if (lines[i].includes('<div className="pt-[5.5rem] pb-8 px-4 sm:px-6 lg:px-8 relative z-10">')) {
      newLines.push(lines[i].replace('pt-[5.5rem] ', ''));
      continue;
    }
    
    newLines.push(lines[i]);
  }
  
  fs.writeFileSync(filePath, newLines.join('\n'));
}

cleanQRFile('frontend/src/pages/AdminQRManagement.jsx');
