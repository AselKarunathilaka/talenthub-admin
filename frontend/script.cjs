const fs = require('fs');
const file = 'g:/github/TalentHub/frontend/src/pages/AdminSettings.jsx';
let content = fs.readFileSync(file, 'utf8');

// Replace showSuccess
content = content.replace(/notificationUtils\.showSuccess\((.*?)\)/g, 'showToast($1, "success")');

// Replace showError
content = content.replace(/notificationUtils\.showError\((.*?)\)/g, 'showToast($1, "error")');

// Replace showInfo
content = content.replace(/notificationUtils\.showInfo\((.*?)\)/g, 'showToast($1, "info")');

// Remove import
content = content.replace(/, notificationUtils/, '');

fs.writeFileSync(file, content);
