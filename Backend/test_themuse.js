const { httpGet } = require('./utils/httpClient');

async function test() {
  try {
    const res = await httpGet('https://www.themuse.com/api/public/jobs?page=1');
    const data = JSON.parse(res);
    console.log("TheMuse jobs:", data.results.length);
    const unpaid = data.results.filter(j => j.name.toLowerCase().includes('unpaid') || j.name.toLowerCase().includes('volunteer'));
    console.log("Unpaid found:", unpaid.length);
  } catch(e) {
    console.log('TheMuse failed:', e.message);
  }
}
test();
