const http = require('http');

http.get('http://localhost:5000/api/jobs/stats', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const stats = JSON.parse(data);
    console.log(JSON.stringify(stats, null, 2));
  });
});
