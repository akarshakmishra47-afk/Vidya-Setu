async function fetchLinkedInJobs() {
  return { jobs: [], stats: { fetched: 0, accepted: 0, rejected: 0, error: 'LinkedIn API requires authentication/scraping bypass', status: 'Unavailable' } };
}
module.exports = { fetchLinkedInJobs };
