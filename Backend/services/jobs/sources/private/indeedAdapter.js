/**
 * indeedAdapter.js
 * Indeed requires official partner API credentials.
 * Public web scraping is blocked by Cloudflare and violates Indeed ToS.
 * Marked as Unavailable to prevent false failures and prevent fabricating data.
 */

async function fetchIndeedJobs() {
  return {
    jobs: [],
    stats: {
      fetched: 0,
      accepted: 0,
      rejected: 0,
      error: 'Indeed requires official partner API credentials (public scraping restricted)',
      status: 'Unavailable'
    }
  };
}

module.exports = { fetchIndeedJobs };
