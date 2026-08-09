const { fetchHimalayasJobs } = require('./services/jobs/sources/private/himalayasAdapter');
const { fetchRemotiveJobs } = require('./services/jobs/sources/private/remotiveAdapter');
const { fetchArbeitnowJobs } = require('./services/jobs/sources/private/arbeitnowAdapter');
const { classifyInternshipCompensation } = require('./services/jobs/utils/jobValidator');

async function test() {
  const [h, r, a] = await Promise.all([
    fetchHimalayasJobs(),
    fetchRemotiveJobs(),
    fetchArbeitnowJobs()
  ]);
  const all = [...h.jobs, ...r.jobs, ...a.jobs];
  const internships = all.filter(j => j.primaryType === 'Internship');
  const free = internships.filter(j => j.secondaryType === 'Free');
  console.log('Total Internships fetched:', internships.length);
  console.log('Free Internships fetched:', free.length);
  
  if (free.length > 0) {
    console.log(free);
  }
}
test();
