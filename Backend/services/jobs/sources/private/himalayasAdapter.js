/**
 * himalayasAdapter.js
 * Source adapter for Himalayas.app API (https://himalayas.app/jobs/api)
 * Free public API, no authentication required.
 * Max 20 results per request — we paginate up to 5 pages.
 */

const { httpGet, safeParseJson } = require('../../utils/httpClient');
const { isIndiaLocation, getIndiaRegion } = require('../../utils/indiaFilter');
const { classifyBranch, classifyExperienceLevel, classifyCategory } = require('../../utils/branchClassifier');
const { classifyCompanyType } = require('../../utils/companyClassifier');
const { classifyInternshipCompensation } = require('../../utils/jobValidator');
const { generateDeduplicationKey } = require('../../utils/deduplicator');

const SOURCE_NAME = 'himalayas';
const BASE_URL = 'https://himalayas.app/jobs/api';
const MAX_PAGES = 4;   // 4 pages × 20 = up to 80 jobs
const PAGE_SIZE = 20;

function normalizeJob(job) {
  const title    = (job.title        || '').substring(0, 200).trim();
  const company  = (job.companyName  || job.company?.name || '').substring(0, 150).trim();
  const location = (job.locationRestrictions && job.locationRestrictions.length > 0)
    ? job.locationRestrictions.join(', ')
    : (job.location || 'Remote');
  const desc     = (job.description  || job.descriptionPlain || '').substring(0, 800).trim();
  const applyUrl = job.applicationLink || job.url || '';
  const sourceId = `himalayas_${job.id}`;

  const isIntern = /\b(intern|internship|trainee|student intern|summer intern|winter intern|graduate intern)\b/i.test(title);
  const branch      = classifyBranch(title, desc);
  const expLevel    = classifyExperienceLevel(title, desc);
  const compType    = classifyCompanyType(company);
  const category    = classifyCategory(title, desc, isIntern ? 'Internship' : 'Job', false);
  const indiaRegion = getIndiaRegion(location);

  const primaryType   = isIntern ? 'Internship' : 'Job';
  const secondaryType = isIntern
    ? classifyInternshipCompensation(title, desc, '')
    : 'Full-Time';

  const postedAt = job.createdAt ? new Date(job.createdAt) : null;

  return {
    title,
    company,
    location,
    salary: 'Not specified',
    badge: '🌏 Remote India',
    tags: Array.isArray(job.tags) ? job.tags.slice(0, 8) : [],
    desc,
    primaryType,
    secondaryType,
    category: isIntern ? 'Internship' : category,
    govtCategory: 'Unknown',
    branch,
    experienceLevel: expLevel,
    companyType: compType,
    applyUrl,
    source: SOURCE_NAME,
    sourceId,
    sourceUrl: 'https://himalayas.app',
    postedAt,
    expiresAt: null,
    deadline: 'Rolling',
    experience: expLevel === 'Unknown' ? 'Fresher to 2 years' : expLevel,
    companyLogo: job.company?.logoUrl || '',
    isAktu: false,
    isIndiaLocation: true,
    indiaRegion,
    deduplicationKey: generateDeduplicationKey(SOURCE_NAME, sourceId, title, company, applyUrl),
    relevanceScore: 0
  };
}

async function fetchHimalayasJobs() {
  const stats = {
    fetched: 0, accepted: 0, rejected: 0, duplicates: 0,
    error: null, url: BASE_URL
  };
  const accepted = [];

  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      const offset = page * PAGE_SIZE;
      const url = `${BASE_URL}?limit=${PAGE_SIZE}&offset=${offset}`;
      console.log(`[Himalayas] Fetching page ${page + 1}: ${url}`);

      let body;
      try {
        body = await httpGet(url, { timeout: 15000, retries: 1 });
      } catch (pageErr) {
        console.warn(`[Himalayas] Page ${page + 1} failed: ${pageErr.message}`);
        if (page === 0) stats.error = pageErr.message;
        break;
      }

      const data = safeParseJson(body);
      if (!data) {
        console.warn(`[Himalayas] Page ${page + 1}: non-JSON response`);
        break;
      }

      const jobs = data.jobs || data.data || [];
      if (!Array.isArray(jobs) || jobs.length === 0) {
        console.log(`[Himalayas] Page ${page + 1}: no more results`);
        break;
      }

      stats.fetched += jobs.length;

      for (const job of jobs) {
        // Check India location restriction
        const restrictions = Array.isArray(job.locationRestrictions) ? job.locationRestrictions : [];
        const locationStr = restrictions.join(' ') + ' ' + (job.location || '');

        const isIndia = restrictions.length === 0  // worldwide = accept (remote roles)
          ? true
          : restrictions.some(r => isIndiaLocation(r));

        if (!isIndia) {
          stats.rejected++;
          continue;
        }

        const url = (job.applicationLink || job.url || '').trim();
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          stats.rejected++;
          continue;
        }

        if (!job.title || (!job.companyName && !job.company?.name)) {
          stats.rejected++;
          continue;
        }

        try {
          accepted.push(normalizeJob(job));
        } catch (e) {
          console.warn(`[Himalayas] Normalization error: ${e.message}`);
          stats.rejected++;
        }
      }

      // Be polite — don't hammer the API
      if (page < MAX_PAGES - 1) {
        await new Promise(r => setTimeout(r, 300));
      }
    }

    stats.accepted = accepted.length;
    console.log(`[Himalayas] fetched=${stats.fetched} accepted=${stats.accepted} rejected=${stats.rejected}`);
    return { jobs: accepted, stats };

  } catch (err) {
    stats.error = err.message;
    console.error(`[Himalayas] Fatal error: ${err.message}`);
    return { jobs: accepted, stats };
  }
}

module.exports = { fetchHimalayasJobs };
