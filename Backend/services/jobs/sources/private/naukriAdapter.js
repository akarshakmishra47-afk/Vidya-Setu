/**
 * naukriAdapter.js
 * Naukri requires enterprise API credentials for automated job distribution.
 * Marked as Unavailable to prevent dependency on missing local files and prevent fabricating data.
 */

async function fetchNaukriJobs() {
  return {
    jobs: [],
    stats: {
      fetched: 0,
      accepted: 0,
      rejected: 0,
      error: 'Naukri integration requires enterprise API credentials (public API unavailable)',
      status: 'Unavailable'
    }
  };
}

module.exports = { fetchNaukriJobs };
