const https = require('https');

function checkATS(url, name) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          let count = 0;
          if (json.jobs) count = json.jobs.length; // Greenhouse / Lever / Workable sometimes have different formats
          else if (Array.isArray(json)) count = json.length; // Lever sometimes returns array directly
          console.log(`[${name}] ${url} - HTTP ${res.statusCode} - Jobs: ${count}`);
          resolve(count);
        } catch (e) {
          console.log(`[${name}] ${url} - Failed to parse JSON (HTTP ${res.statusCode})`);
          resolve(0);
        }
      });
    }).on('error', (e) => {
      console.log(`[${name}] ${url} - Error: ${e.message}`);
      resolve(0);
    });
  });
}

async function run() {
  const greenhouseCompanies = ['swiggy', 'cred', 'postman', 'browserstack', 'dream11', 'groww'];
  const leverCompanies = ['razorpay', 'clevertap', 'khatabook', 'locus'];
  
  for (const c of greenhouseCompanies) {
    await checkATS(`https://boards-api.greenhouse.io/v1/boards/${c}/jobs`, `Greenhouse:${c}`);
  }
  for (const c of leverCompanies) {
    await checkATS(`https://api.lever.co/v0/postings/${c}?mode=json`, `Lever:${c}`);
  }
}
run();
