const http = require('https');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data: null });
        }
      });
    }).on('error', reject);
  });
}

const ghCompanies = ['swiggy', 'zomato', 'razorpay', 'cred', 'meesho', 'udaan', 'bharatpe', 'phonepe', 'ola', 'oyo', 'myntra', 'flipkart', 'paytm', 'byjus', 'unacademy', 'upstox', 'dream11', 'sharechat', 'makemytrip', 'cleartrip'];
const leverCompanies = ['kpmg', 'wipro', 'infosys', 'tcs', 'cognizant', 'hcl', 'techmahindra', 'lnt', 'birlasoft', 'mindtree'];

async function run() {
  for (const c of ghCompanies) {
    const res = await fetchJson(`https://boards-api.greenhouse.io/v1/boards/${c}/jobs`);
    if (res.status === 200 && res.data && res.data.jobs) {
      console.log(`[GH:${c}] ${res.data.jobs.length} jobs`);
    } else {
      console.log(`[GH:${c}] ${res.status}`);
    }
  }
  for (const c of leverCompanies) {
    const res = await fetchJson(`https://api.lever.co/v0/postings/${c}?mode=json`);
    if (res.status === 200 && res.data && Array.isArray(res.data)) {
      console.log(`[Lever:${c}] ${res.data.length} jobs`);
    } else {
      console.log(`[Lever:${c}] ${res.status}`);
    }
  }
}
run();
