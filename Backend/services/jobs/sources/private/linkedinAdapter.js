const axios = require('axios');
const cheerio = require('cheerio');
const { evaluateDomain } = require('../../utils/domainEvaluator');

async function fetchLinkedInJobs() {
  const stats = { fetched: 0, accepted: 0, rejected: 0, error: null, status: 'Working' };
  const jobs = [];

  try {
    // f_TPR=r86400 means past 24 hours. Good for freshness and auto-refresh cycles.
    const url = 'https://www.linkedin.com/jobs/search?keywords=Software%20Developer&location=India&f_TPR=r86400';
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);

    $('ul.jobs-search__results-list li').each((i, el) => {
      if (stats.fetched >= 50) return false;

      const title = $(el).find('.base-search-card__title').text().trim();
      const company = $(el).find('.base-search-card__subtitle').text().trim();
      const location = $(el).find('.job-search-card__location').text().trim() || 'India';
      let link = $(el).find('.base-card__full-link').attr('href');

      if (!title || !link) return;
      
      // Clean query params from linkedin tracking URLs for deduplication key
      const cleanUrl = link.split('?')[0];

      stats.fetched++;

      const domain = evaluateDomain(title, '', []);
      if (!domain) {
        stats.rejected++;
        return;
      }

      jobs.push({
        title,
        company,
        location,
        source: 'linkedin',
        sourceUrl: cleanUrl,
        applyUrl: link,
        primaryType: 'Job',
        domain,
        isIndiaLocation: true,
        deadline: 'Not specified',
        deduplicationKey: `LinkedIn::${cleanUrl}`
      });
      stats.accepted++;
    });

    if (stats.fetched === 0) {
      if (response.data.includes('authwall') || response.data.includes('captcha')) {
         throw new Error('Blocked by Authwall/Captcha');
      }
      throw new Error('No jobs found on page');
    }

  } catch (err) {
    stats.error = err.message || 'Unavailable';
    stats.status = 'Error';
  }

  return { jobs, stats };
}

module.exports = { fetchLinkedInJobs };
