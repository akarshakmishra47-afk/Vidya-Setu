const fs = require('fs');

const content = fs.readFileSync('C:/Users/LENOVO/.gemini/antigravity-ide/brain/a5364a25-2300-44d9-9328-4d6992c84f05/.system_generated/messages/debf8266-1a62-4a21-9a39-7ed8d588d3e2.json', 'utf8');
const p = JSON.parse(content);
if (p.content) {
  const dsStart = p.content.lastIndexOf('{');
  // Wait, let's just find "job_urls" and go backwards to {
  const match = p.content.indexOf('"job_urls"');
  if (match !== -1) {
    const start = p.content.lastIndexOf('{', match);
    const ds = p.content.substring(start);
    fs.writeFileSync('Backend/naukri_dataset.json', ds);
    console.log('Extracted', ds.length, 'bytes');
  } else {
    console.log('Not found');
  }
}
