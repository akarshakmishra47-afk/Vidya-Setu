/**
 * hackathonAdapter.js
 * Source adapter for HackerEarth API (https://www.hackerearth.com/api/events/upcoming/)
 * Free public API for upcoming hackathons/events.
 *
 * Normalizes upcoming hackathons into the unified Job schema with proper
 * event dates, clean URLs, and flexible technical classification.
 */

const crypto = require('crypto');
const { httpGet, safeParseJson } = require('../../utils/httpClient');
const { cleanUrl, generateDeduplicationKey, generateFingerprint } = require('../../utils/deduplicator');
const { classifyBranch } = require('../../utils/branchClassifier');
const { evaluateHackathon } = require('../../utils/domainEvaluator');
const { parseDate } = require('../../utils/dateParser');

const SOURCE_NAME = 'hackathon';
const API_URL = 'https://www.hackerearth.com/api/events/upcoming/';

/**
 * Normalizes a HackerEarth event into the standard schema.
 */
function normalizeHackathon(event) {
  const title = (event.title || '').substring(0, 200).trim();
  const desc = (event.description || '').substring(0, 800).trim();
  const applyUrl = cleanUrl(event.url || event.subscribe || '');

  const rawId = applyUrl
    ? crypto.createHash('md5').update(applyUrl).digest('hex')
    : title.replace(/\s+/g, '-').toLowerCase();
  const sourceId = `hackerearth_${rawId}`;

  const branch = classifyBranch(title, desc);
  const hackEvaluation = evaluateHackathon(title, desc, ['Hackathon', 'Competitive Programming']);
  const domain = hackEvaluation.valid ? hackEvaluation.domain : 'Competitive Programming';

  const startDate = parseDate(event.start_utc_tz || event.start_timestamp);
  const endDate = parseDate(event.end_utc_tz || event.end_timestamp) || parseDate(event.end_date);

  const now = new Date();
  // If hackathon already concluded, return null to omit
  if (endDate && endDate < now) {
    return null;
  }

  const deadline = endDate ? endDate.toISOString().split('T')[0] : (event.end_date || null);
  const location = 'Remote / Online';

  return {
    title,
    company: 'HackerEarth (Organizer)',
    location,
    salary: 'Not specified',
    badge: '🏆 Hackathon',
    tags: ['Hackathon', 'Competitive Programming', branch].filter(Boolean),
    desc,
    primaryType: 'Hackathon',
    secondaryType: 'Online',
    category: 'Hackathon',
    govtCategory: 'Unknown',
    branch,
    domain,
    experienceLevel: 'Fresher',
    experience: 'Open to Students & Developers',
    companyType: 'unknown',
    applyUrl,
    source: SOURCE_NAME,
    sourceId,
    sourceUrl: applyUrl || 'https://www.hackerearth.com',
    postedAt: new Date(),
    expiresAt: endDate,
    deadline,
    deadlineDate: endDate,
    companyLogo: event.thumbnail || event.cover_image || '',
    isAktu: false,
    isIndiaLocation: true,
    indiaRegion: 'Other',

    // Hackathon specific fields
    hackathonOrganizer: 'HackerEarth',
    hackathonStartDate: startDate,
    hackathonEndDate: endDate,
    hackathonRegistrationDeadline: startDate || endDate,
    hackathonEligibility: 'Open to all students & developers',
    hackathonMode: 'Online',
    hackathonTechDomain: domain,

    deduplicationKey: generateDeduplicationKey(SOURCE_NAME, sourceId, title, 'HackerEarth', applyUrl),
    normalizedFingerprint: generateFingerprint(title, 'HackerEarth', location, 'Hackathon'),
    relevanceScore: 10
  };
}

/**
 * Fetches events from HackerEarth API
 */
async function fetchHackathons() {
  const stats = {
    fetched: 0, accepted: 0, rejected: 0, duplicates: 0,
    error: null, status: 'Working', url: API_URL
  };

  try {
    console.log(`[Hackathons] Fetching from ${API_URL}`);
    const body = await httpGet(API_URL, { timeout: 15000, retries: 2 });

    const data = safeParseJson(body);
    if (!data || !Array.isArray(data.response)) {
      stats.error = 'API returned non-JSON response or missing response array';
      stats.status = 'Error';
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
        if (!normalized) {
          // Ended or invalid
          stats.rejected++;
          continue;
        }
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
    stats.status = 'Error';
    console.error(`[Hackathons] Error: ${err.message}`);
    return { jobs: [], stats };
  }
}

module.exports = { fetchHackathons };
