/**
 * arbeitnowAdapter.js
 * Source adapter for Arbeitnow API (https://www.arbeitnow.com/api/v2/job_posts)
 * Free public API, no authentication required.
 * Note: Arbeitnow is primarily EU-focused — India results will be low.
 */

const { httpGet, safeParseJson } = require('../../utils/httpClient');
const { isIndiaLocation, getIndiaRegion } = require('../../utils/indiaFilter');
const { classifyBranch, classifyExperienceLevel, classifyCategory } = require('../../utils/branchClassifier');
const { classifyCompanyType } = require('../../utils/companyClassifier');
const { classifyInternshipCompensation } = require('../../utils/jobValidator');
const { generateDeduplicationKey } = require('../../utils/deduplicator');

const SOURCE_NAME = 'arbeitnow';
const API_URL = 'https://www.arbeitnow.com/api/v2/job_posts?page=1';

function normalizeJob(job) {
  const title    = (job.title    || '').substring(0, 200).trim();
  const company  = (job.company  || '').substring(0, 150).trim();
  const location = (job.location || 'Remote').trim();
  const desc     = (job.description || '').substring(0, 800).trim();
  const applyUrl = job.url || '';
  const sourceId = `arbeitnow_${job.slug || job.id}`;

  const isIntern = /\b(intern|internship|trainee|student intern|summer intern|winter intern|graduate intern)\b/i.test(title);
  const branch       = classifyBranch(title, desc);
  const expLevel     = classifyExperienceLevel(title, desc);
  const companyType  = classifyCompanyType(company);
  const category     = classifyCategory(title, desc, isIntern ? 'Internship' : 'Job', false);
  const indiaRegion  = getIndiaRegion(location);

  const primaryType   = isIntern ? 'Internship' : 'Job';
  let secondaryType;
  if (isIntern) {
    secondaryType = classifyInternshipCompensation(title, desc, '');
  } else {
    secondaryType = job.job_types && job.job_types.includes('Part Time') ? 'Part-Time' : 'Full-Time';
  }

  const postedAt = job.created_at ? new Date(job.created_at * 1000) : null;

  return {
    title,
    company,
    location,
    salary: 'Not specified',
    badge: isIntern ? '🎓 Internship' : '💼 Job',
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
    sourceUrl: 'https://arbeitnow.com',
    postedAt,
    expiresAt: null,
    deadline: 'Rolling',
    experience: expLevel === 'Unknown' ? 'Fresher to 2 years' : expLevel,
    companyLogo: '',
    isAktu: false,
    isIndiaLocation: true,
    indiaRegion,
    deduplicationKey: generateDeduplicationKey(SOURCE_NAME, sourceId, title, company, applyUrl),
    relevanceScore: 0
  };
}

async function fetchArbeitnowJobs() {
  const stats = {
    fetched: 0, accepted: 0, rejected: 0, duplicates: 0,
    error: null, url: API_URL
  };

  try {
    console.log(`[Arbeitnow] Fetching from ${API_URL}`);
    const body = await httpGet(API_URL, { timeout: 15000, retries: 2 });

    const data = safeParseJson(body);
    if (!data) {
      stats.error = 'Non-JSON response';
      return { jobs: [], stats };
    }
    if (!Array.isArray(data.data)) {
      stats.error = `Unexpected structure: ${Object.keys(data).join(', ')}`;
      return { jobs: [], stats };
    }

    stats.fetched = data.data.length;
    const accepted = [];

    for (const job of data.data) {
      const location = job.location || '';

      if (!isIndiaLocation(location)) {
        stats.rejected++;
        continue;
      }

      const url = (job.url || '').trim();
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        stats.rejected++;
        continue;
      }

      if (!job.title || !job.company) {
        stats.rejected++;
        continue;
      }

      try {
        accepted.push(normalizeJob(job));
      } catch (e) {
        console.warn(`[Arbeitnow] Normalization error: ${e.message}`);
        stats.rejected++;
      }
    }

    stats.accepted = accepted.length;
    console.log(`[Arbeitnow] fetched=${stats.fetched} accepted=${stats.accepted} rejected=${stats.rejected}`);
    return { jobs: accepted, stats };

  } catch (err) {
    stats.error = err.message;
    console.error(`[Arbeitnow] Error: ${err.message}`);
    return { jobs: [], stats };
  }
}

module.exports = { fetchArbeitnowJobs };
