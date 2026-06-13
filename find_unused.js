const fs = require('fs');
const path = require('path');

function getFiles(dir, extFilter) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
            results = results.concat(getFiles(fullPath, extFilter));
        } else {
            if (extFilter.some(ext => fullPath.endsWith(ext))) {
                results.push(fullPath);
            }
        }
    });
    return results;
}

const frontendSrc = path.join(__dirname, 'frontend/src');
const allFiles = getFiles(frontendSrc, ['.js', '.jsx']);

const allContents = allFiles.map(file => fs.readFileSync(file, 'utf8'));

const unused = [];

allFiles.forEach(file => {
    const basename = path.basename(file, path.extname(file));
    if (basename === 'index' || basename === 'App' || basename === 'main') return;
    
    let isImported = false;
    for (let content of allContents) {
        if (content.includes(`/${basename}'`) || 
            content.includes(`/${basename}"`) || 
            content.includes(`/${basename}`) && content.includes('import ') ||
            content.includes(`./${basename}`) ||
            content.includes(`../${basename}`)) {
            isImported = true;
            break;
        }
    }
    
    if (!isImported) {
        unused.push(file);
    }
});

console.log('Potentially Unused Files in Frontend:');
unused.forEach(f => console.log(f));
