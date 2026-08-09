const http = require('http');

function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (options.method === 'POST') req.write('');
    req.end();
  });
}

async function runTests() {
  console.log("Testing GET /api/jobs?limit=300");
  let res = await fetch('http://localhost:5000/api/jobs?limit=300');
  console.log(`Status: ${res.status}`);
  let jobs = res.data.jobs || [];
  let uniqueKeys = new Set(jobs.map(j => j.deduplicationKey));
  console.log(`Total jobs returned: ${jobs.length}`);
  console.log(`Unique deduplicationKeys: ${uniqueKeys.size}`);
  console.log(`Duplicate keys: ${jobs.length - uniqueKeys.size}`);
  
  console.log("\nTriggering POST /api/jobs/fetch-latest (1st time)");
  res = await fetch('http://localhost:5000/api/jobs/fetch-latest', { method: 'POST' });
  console.log(`Status: ${res.status}, Added: ${res.data.jobsAdded}`);
  
  console.log("\nTriggering POST /api/jobs/fetch-latest (2nd time)");
  res = await fetch('http://localhost:5000/api/jobs/fetch-latest', { method: 'POST' });
  console.log(`Status: ${res.status}, Added: ${res.data.jobsAdded}`);

  console.log("\nTesting GET /api/jobs?limit=300 again");
  res = await fetch('http://localhost:5000/api/jobs?limit=300');
  console.log(`Status: ${res.status}`);
  jobs = res.data.jobs || [];
  uniqueKeys = new Set(jobs.map(j => j.deduplicationKey));
  console.log(`Total jobs returned: ${jobs.length}`);
  console.log(`Unique deduplicationKeys: ${uniqueKeys.size}`);
  console.log(`Duplicate keys: ${jobs.length - uniqueKeys.size}`);
}

runTests();
