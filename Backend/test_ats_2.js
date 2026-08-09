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
          if (json.jobs) count = json.jobs.length; 
          else if (Array.isArray(json)) count = json.length; 
          console.log(`[${name}] ${url} - HTTP ${res.statusCode} - Jobs: ${count}`);
          resolve(count);
        } catch (e) {
          resolve(0);
        }
      });
    }).on('error', (e) => {
      resolve(0);
    });
  });
}

async function run() {
  const gh = ['uber', 'airbnb', 'pinterest', 'coinbase', 'stripe', 'robinhood', 'instacart', 'doordash', 'discord', 'reddit', 'canva', 'figma', 'notion', 'github', 'gitlab', 'twitch', 'slack', 'dropbox', 'box', 'zoom'];
  const lev = ['netflix', 'atlassian', 'coursera', 'yelp', 'lever'];
  
  for (const c of gh) {
    await checkATS(`https://boards-api.greenhouse.io/v1/boards/${c}/jobs`, `Greenhouse:${c}`);
  }
  for (const c of lev) {
    await checkATS(`https://api.lever.co/v0/postings/${c}?mode=json`, `Lever:${c}`);
  }
}
run();
