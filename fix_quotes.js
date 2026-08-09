const fs = require('fs');
let content = fs.readFileSync('Frontend/index.html', 'utf8');

// Replace any incorrectly nested double quotes caused by previous global replace
content = content.replace(/fontFamily:\s*"Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif"/g, "fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Arial, sans-serif'");

fs.writeFileSync('Frontend/index.html', content);
console.log('Fixed quotes');
