const https = require('https');
function get(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
  });
}
async function run() {
  const res = await get('https://www.hackerearth.com/api/events/upcoming/');
  const json = JSON.parse(res.data);
  console.log(JSON.stringify(json.response[0], null, 2));
}
run();
