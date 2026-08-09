const https = require('https');
function get(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, data: data.substring(0, 500) }));
    });
  });
}
async function run() {
  console.log('Devpost:', await get('https://devpost.com/api/hackathons'));
  console.log('HackerEarth:', await get('https://www.hackerearth.com/api/events/upcoming/'));
}
run();
