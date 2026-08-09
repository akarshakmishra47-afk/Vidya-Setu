/**
 * hackathonAdapter.js
 * Source adapter for HackerEarth API (https://www.hackerearth.com/api/events/upcoming/)
 * Free public API for upcoming hackathons/events.
 *
 * Filters for India-based opportunities (if specified, otherwise assumes online/accessible).
 * Normalizes into the unified Job schema.
 */

const { httpGet, safeParseJson } = require('../../utils/httpClient');
const { generateDeduplicationKey } = require('../../utils/deduplicator');
const { classifyBranch } = require('../../utils/branchClassifier');

const SOURCE_NAME = 'hackathon';
const API_URL = 'https://www.hackerearth.com/api/events/upcoming/';

/**
 * Normalizes a HackerEarth event into the standard schema.
 */
function normalizeHackathon(event) {
  const title = (event.title || '').substring(0, 200).trim();
  const desc = (event.description || '').substring(0, 800).trim();
  const applyUrl = event.url || event.subscribe || '';
  
  // HackerEarth IDs aren't explicitly provided, so we'll use a hash of the URL or title
  const rawId = applyUrl ? Buffer.from(applyUrl).toString('base64').substring(0, 32) : title.replace(/\s+/g, '-').toLowerCase();
  const sourceId = `hackerearth_${rawId}`;
  
  const branch = classifyBranch(title, desc);
  const startDate = event.start_timestamp ? new Date(event.start_utc_tz || event.start_timestamp) : null;
  const endDate = event.end_timestamp ? new Date(event.end_utc_tz || event.end_timestamp) : null;
  
  // Check location if any, usually hackerearth is online.
  const location = 'Remote / Online';
  const indiaRegion = 'Other';

  return {
    title,
    company: 'HackerEarth (Organizer)',
    location,
    salary: 'Not specified',
    badge: '🏆 Hackathon',
    tags: ['Hackathon', 'Competitive Programming'],
    desc,
    primaryType: 'Hackathon',
    secondaryType: 'Unknown',
    category: 'Hackathon',
    govtCategory: 'Unknown',
    branch,
    experienceLevel: 'Unknown',
    companyType: 'unknown',
    applyUrl,
    source: SOURCE_NAME,
    sourceId,
    sourceUrl: 'https://www.hackerearth.com',
    postedAt: new Date(), // They don't give a posted date
    expiresAt: endDate,
    deadline: event.end_date || 'Check official notification',
    experience: 'Fresher to Experienced',
    companyLogo: event.thumbnail || event.cover_image || '',
    isAktu: false,
    isIndiaLocation: true, // Assuming accessible from India
    indiaRegion,
    
    // Hackathon specific fields
    hackathonOrganizer: 'HackerEarth',
    hackathonStartDate: startDate,
    hackathonEndDate: endDate,
    hackathonRegistrationDeadline: startDate, // Usually starts when hackathon starts
    hackathonEligibility: 'Open to all',
    hackathonMode: 'Online',
    hackathonTechDomain: branch,
    
    deduplicationKey: generateDeduplicationKey(SOURCE_NAME, sourceId, title, 'HackerEarth (Organizer)', applyUrl),
    relevanceScore: 0
  };
}

/**
 * Fetches events from HackerEarth API
 */
async function fetchHackathons() {
  const stats = {
    fetched: 0, accepted: 0, rejected: 0, duplicates: 0,
    error: null, url: API_URL
  };

  try {
    console.log(`[Hackathons] Fetching from ${API_URL}`);
    const body = await httpGet(API_URL, { timeout: 15000, retries: 2 });
    
    const data = safeParseJson(body);
    if (!data || !Array.isArray(data.response)) {
      stats.error = 'API returned non-JSON response or missing response array';
      console.warn('[Hackathons] Invalid HackerEarth response');
      return { jobs: [], stats };
    }

    stats.fetched = data.response.length;
    const accepted = [];

    for (const event of data.response) {
      const url = (event.url || event.subscribe || '').trim();
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        stats.rejected++;
        continue;
      }
      
      if (!event.title) {
        stats.rejected++;
        continue;
      }

      try {
        const normalized = normalizeHackathon(event);
        accepted.push(normalized);
      } catch (e) {
        console.warn(`[Hackathons] Normalization error for event ${event.title}: ${e.message}`);
        stats.rejected++;
      }
    }

    stats.accepted = accepted.length;
    console.log(`[Hackathons] fetched=${stats.fetched} accepted=${stats.accepted} rejected=${stats.rejected}`);
    return { jobs: accepted, stats };

  } catch (err) {
    stats.error = err.message;
    console.error(`[Hackathons] Error: ${err.message}`);
    return { jobs: [], stats };
  }
}

module.exports = { fetchHackathons };
