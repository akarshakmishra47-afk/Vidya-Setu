const fs = require('fs');
const lines = fs.readFileSync('C:/Users/LENOVO/.gemini/antigravity-ide/brain/a5364a25-2300-44d9-9328-4d6992c84f05/.system_generated/logs/transcript_full.jsonl', 'utf8').split('\n');
let ds = '';
for (let i = lines.length - 1; i >= 0; i--) {
  if (!lines[i].includes('USER_INPUT')) continue;
  try {
    const p = JSON.parse(lines[i]);
    if (p.content && p.content.includes('IMPORT FULL NAUKRI DATASET')) {
      const start = p.content.lastIndexOf('{');
      // Wait, there are multiple braces, find the start of {"job_urls"
      const match = p.content.match(/\{\s*"job_urls"/);
      if (match) {
        ds = p.content.substring(match.index);
        break;
      }
    }
  } catch(e) {}
}

if (ds) {
  fs.writeFileSync('naukri_dataset.json', ds);
  console.log('Dataset successfully extracted to naukri_dataset.json');
} else {
  console.log('Failed to extract dataset.');
}
