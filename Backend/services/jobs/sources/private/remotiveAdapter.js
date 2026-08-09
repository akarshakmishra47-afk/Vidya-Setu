/**
 * remotiveAdapter.js
 * Source adapter for Remotive API (https://remotive.com/api/remote-jobs)
 * Free public API, no authentication required.
 *
 * Filters strictly for India-based opportunities.
 * Returns source statistics even on failure.
 */

const { httpGet, safeParseJson } = require('../../utils/httpClient');
const { isIndiaLocation, getIndiaRegion } = require('../../utils/indiaFilter');
const { classifyBranch, classifyExperienceLevel, classifyCategory } = require('../../utils/branchClassifier');
const { classifyCompanyType } = require('../../utils/companyClassifier');
const { classifyInternshipCompensation } = require('../../utils/jobValidator');
const { generateDeduplicationKey } = require('../../utils/deduplicator');

const SOURCE_NAME = 'remotive';
const API_URL = 'https://remotive.com/api/remote-jobs?limit=100';

// Remotive categories relevant for B.Tech students
const CATEGORIES = [
  'software-dev',
  'data',
  'devops-sysadmin',
  'qa',
  'product',
  'design',
  'backend',
  'frontend',
  'fullstack'
];

/**
 * Normalizes a single Remotive job into the standard schema.
 */
function normalizeJob(job) {
  const title   = (job.title         || '').substring(0, 200).trim();
  const company = (job.company_name  || '').substring(0, 150).trim();
  const location = job.candidate_required_location || 'Remote';
  const desc    = (job.description   || '').substring(0, 800).trim();
  const applyUrl = job.url || '';
  const sourceId = `remotive_${job.id}`;

  const branch       = classifyBranch(title, desc);
  const expLevel     = classifyExperienceLevel(title, desc);
  const companyType  = classifyCompanyType(company);
  const category     = classifyCategory(title, desc, 'Job', false);
  const indiaRegion  = getIndiaRegion(location);

  const isIntern = /\b(intern|internship|trainee|student intern|summer intern|winter intern|graduate intern)\b/i.test(title);
  const primaryType   = isIntern ? 'Internship' : 'Job';
  const secondaryType = isIntern
    ? classifyInternshipCompensation(title, desc, '')
    : 'Full-Time';

  const postedAt = job.publication_date ? new Date(job.publication_date) : null;

  return {
    title,
    company,
    location,
    salary: 'Not specified',
    badge: isIntern ? '🎓 Internship' : '💼 Remote Job',
    tags: Array.isArray(job.tags) ? job.tags.slice(0, 8) : [],
    desc,
    primaryType,
    secondaryType,
    category: isIntern ? 'Internship' : category,
    govtCategory: 'Unknown',
    branch,
    experienceLevel: expLevel,
    companyType,
    applyUrl,
    source: SOURCE_NAME,
    sourceId,
    sourceUrl: 'https://remotive.com',
    postedAt,
    expiresAt: null,
    deadline: 'Rolling',
    experience: expLevel === 'Unknown' ? 'Fresher to 2 years' : expLevel,
    companyLogo: job.company_logo_url || '',
    isAktu: false,
    isIndiaLocation: true,
    indiaRegion,
    deduplicationKey: generateDeduplicationKey(SOURCE_NAME, sourceId, title, company, applyUrl),
    relevanceScore: 0
  };
}

/**
 * Fetches jobs from Remotive API, filtered for India.
 * @returns {Promise<{ jobs: Object[], stats: Object }>}
 */
async function fetchRemotiveJobs() {
  const stats = {
    fetched: 0, accepted: 0, rejected: 0, duplicates: 0,
    error: null, url: API_URL
  };

  try {
    console.log(`[Remotive] Fetching from ${API_URL}`);
    const body = await httpGet(API_URL, { timeout: 15000, retries: 2 });

    const data = safeParseJson(body);
    if (!data) {
      stats.error = 'API returned non-JSON response';
      console.warn('[Remotive] Non-JSON response received');
      return { jobs: [], stats };
    }
    if (!Array.isArray(data.jobs)) {
      stats.error = `Unexpected response structure: ${Object.keys(data).join(', ')}`;
      console.warn('[Remotive] Unexpected structure:', Object.keys(data));
      return { jobs: [], stats };
    }

    stats.fetched = data.jobs.length;
    const accepted = [];

    for (const job of data.jobs) {
      const locationField = job.candidate_required_location || '';

      // Skip if not India
      if (!isIndiaLocation(locationField)) {
        stats.rejected++;
        continue;
      }

      // Skip invalid URLs
      const url = (job.url || '').trim();
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        stats.rejected++;
        continue;
      }

      // Skip if missing critical fields
      if (!job.title || !job.company_name) {
        stats.rejected++;
        continue;
      }

      try {
        const normalized = normalizeJob(job);
        accepted.push(normalized);
      } catch (e) {
        console.warn(`[Remotive] Normalization error for job ${job.id}: ${e.message}`);
        stats.rejected++;
      }
    }

    stats.accepted = accepted.length;
    console.log(`[Remotive] fetched=${stats.fetched} accepted=${stats.accepted} rejected=${stats.rejected}`);
    return { jobs: accepted, stats };

  } catch (err) {
    stats.error = err.message;
    console.error(`[Remotive] Error: ${err.message}`);
    return { jobs: [], stats };
  }
}

module.exports = { fetchRemotiveJobs };
