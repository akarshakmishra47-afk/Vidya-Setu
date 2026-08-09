/**
 * hackathonAdapter.js
 * Hackathon source adapter.
 *
 * HONEST REPORT:
 * No reliable public hackathon API exists for India without authentication.
 * - Devfolio: No public API (only organizer SDK)
 * - Unstop: No public API (scraping prohibited)
 * - MLH: No public API
 * - HackWithIndia: No public API
 *
 * This adapter returns an empty array with an honest status report.
 * The frontend will show a "No verified hackathons currently available" message
 * with links to official portals — NEVER fabricated hackathon data.
 *
 * If a legitimate public hackathon API becomes available in the future,
 * implement it here following the normalized job schema.
 */

const SOURCE_NAME = 'hackathon';

async function fetchHackathons() {
  const stats = {
    fetched: 0,
    accepted: 0,
    rejected: 0,
    duplicates: 0,
    error: 'No public hackathon API available without authentication. ' +
           'Visit devfolio.co, unstop.com, or hackwithindia.in for live hackathon listings.',
    url: null,
    note: 'Will be implemented when a public API becomes available.'
  };

  console.log('[Hackathons] No public API available — returning empty array with status report');
  return { jobs: [], stats };
}

module.exports = { fetchHackathons };
