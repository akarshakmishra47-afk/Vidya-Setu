/**
 * aicteAdapter.js
 * AICTE National Internship Portal has migrated to a client-rendered Next.js SPA.
 * Direct HTML scraping of legacy PHP endpoint is no longer supported.
 * Marked as Unavailable until an official API or headless scraper is configured.
 */

async function fetchAicteJobs() {
  return {
    jobs: [],
    stats: {
      fetched: 0,
      accepted: 0,
      rejected: 0,
      error: 'AICTE portal has migrated to a Next.js client-rendered SPA; direct HTML scraping unsupported',
      status: 'Unavailable'
    }
  };
}

module.exports = { fetchAicteJobs };
