const { fetchNaukriJobs } = require('./services/jobs/sources/private/naukriAdapter');

async function test() {
  console.log('Testing fetchNaukriJobs...');
  const result = await fetchNaukriJobs();
  console.log('Stats:', result.stats);
  console.log('First 3 jobs:');
  console.log(JSON.stringify(result.jobs.slice(0, 3), null, 2));
}

test();
