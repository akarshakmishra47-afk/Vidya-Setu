async function fetchWellfoundJobs() {
  return { jobs: [], stats: { fetched: 0, accepted: 0, rejected: 0, error: 'Wellfound heavily restricts bot access', status: 'Unavailable' } };
}
module.exports = { fetchWellfoundJobs };
