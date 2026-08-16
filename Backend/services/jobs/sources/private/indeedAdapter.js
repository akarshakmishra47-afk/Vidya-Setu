async function fetchIndeedJobs() {
  return { jobs: [], stats: { fetched: 0, accepted: 0, rejected: 0, error: 'Indeed restricts programmatic access via Cloudflare', status: 'Unavailable' } };
}
module.exports = { fetchIndeedJobs };
