const fs = require('fs');
let content = fs.readFileSync('c:/Users/LENOVO/Desktop/Vidya Setu/Frontend/index.html', 'utf-8');

// Find the problematic line with literal \r\n characters
const bad = "statsParams.delete('page');\\r\\n          statsParams.delete('primaryType');\\r\\n          statsParams.delete('secondaryType');\\r\\n          statsParams.delete('category');\\r\\n          statsParams.delete('excludeGovt');";
const good = "statsParams.delete('page');\r\n          statsParams.delete('primaryType');\r\n          statsParams.delete('secondaryType');\r\n          statsParams.delete('category');\r\n          statsParams.delete('excludeGovt');";

if (content.includes(bad)) {
  content = content.replace(bad, good);
  fs.writeFileSync('c:/Users/LENOVO/Desktop/Vidya Setu/Frontend/index.html', content);
  console.log('Fixed!');
} else {
  console.log('Bad string not found exactly. Searching...');
  // Search for the page delete and inspect
  const idx = content.indexOf("statsParams.delete('page');");
  if (idx > -1) {
    const context = content.substring(idx, idx + 300);
    console.log('Context around match:', JSON.stringify(context));
  } else {
    console.log('Could not find statsParams.delete(page) at all');
  }
}
