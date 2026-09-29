/**
 * linkedinAdapter.js
 * Source adapter for LinkedIn public software job searches in India.
 * Normalizes listings with clean URLs, accurate experience classification,
 * real publication dates, and native Date handling.
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { evaluateDomain } = require('../../utils/domainEvaluator');
const { cleanUrl, generateDeduplicationKey, generateFingerprint } = require('../../utils/deduplicator');
const { classifyExperience } = require('../../utils/jobValidator');
const { parseDate, parseRelativeDate } = require('../../utils/dateParser');

const SOURCE_NAME = 'linkedin';

async function fetchLinkedInJobs() {
  const stats = { fetched: 0, accepted: 0, rejected: 0, error: null, status: 'Working' };
  const jobs = [];

  try {
    // f_TPR=r86400 means past 24 hours.
    const url = 'https://www.linkedin.com/jobs/search?keywords=Software%20Developer&location=India&f_TPR=r86400';
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 15000
    });

    const $ = cheerio.load(response.data);

    $('ul.jobs-search__results-list li').each((i, el) => {
      if (stats.fetched >= 50) return false;

      const title = $(el).find('.base-search-card__title').text().trim();
      const company = $(el).find('.base-search-card__subtitle').text().trim();
      const location = $(el).find('.job-search-card__location').text().trim() || 'India';
      let link = $(el).find('.base-card__full-link').attr('href');

      if (!title || !link) return;

      const cleanedUrl = cleanUrl(link);
      stats.fetched++;

      const domain = evaluateDomain(title, '', []);
      if (!domain) {
        stats.rejected++;
        return;
      }

      // Extract posting date if available
      const timeTag = $(el).find('time');
      const datetimeAttr = timeTag.attr('datetime');
      const timeText = timeTag.text().trim();
      const postedAt = parseDate(datetimeAttr) || parseRelativeDate(timeText) || new Date();

      // Classify experience accurately
      const expInfo = classifyExperience(title, '', '');

      // Detect if title indicates internship vs full-time job
      const isIntern = /\b(intern|internship|trainee)\b/i.test(title);
      const primaryType = isIntern ? 'Internship' : 'Job';

      jobs.push({
        title,
        company: company || 'LinkedIn Recruiter',
        location,
        source: SOURCE_NAME,
        sourceUrl: cleanedUrl,
        applyUrl: cleanedUrl,
        primaryType,
        secondaryType: isIntern ? 'Unknown' : 'Full-Time',
        domain,
        experienceLevel: expInfo.level,
        experience: expInfo.label,
        isIndiaLocation: true,
        postedAt,
        deadline: null,
        deadlineDate: null,
        deduplicationKey: `LinkedIn::${cleanedUrl}`,
        normalizedFingerprint: generateFingerprint(title, company, location, primaryType)
      });
      stats.accepted++;
    });

    if (stats.fetched === 0) {
      if (response.data.includes('authwall') || response.data.includes('captcha')) {
        throw new Error('Blocked by LinkedIn Authwall / Captcha');
      }
      throw new Error('No jobs parsed from LinkedIn results page');
    }

  } catch (err) {
    stats.error = err.message || 'Unavailable';
    stats.status = 'Error';
  }

  return { jobs, stats };
}

module.exports = { fetchLinkedInJobs };
