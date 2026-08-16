async function fetchAicteJobs() {
  return { jobs: [], stats: { fetched: 0, accepted: 0, rejected: 0, error: 'AICTE internship portal lacks public JSON API', status: 'Unavailable' } };
}
module.exports = { fetchAicteJobs };
