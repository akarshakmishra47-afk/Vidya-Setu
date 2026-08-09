
const fs = require('fs');
let content = fs.readFileSync('Frontend/index.html', 'utf8');
const newFont = 'Inter, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Arial, sans-serif';
content = content.replace(/font-family:\s*[^;!]+?(?=\s*(?:!important)?\s*;)/g, 'font-family: ' + newFont);
content = content.replace(/fontFamily:\s*"[^"]+"/g, 'fontFamily: \"' + newFont + '\"');
content = content.replace(/fontFamily:\s*''[^'']+''/g, 'fontFamily: \'' + newFont + '\'');
fs.writeFileSync('Frontend/index.html', content);
console.log('Fonts updated successfully');

