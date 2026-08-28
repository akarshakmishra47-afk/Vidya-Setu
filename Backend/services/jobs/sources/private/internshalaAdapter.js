const axios = require('axios');
const cheerio = require('cheerio');
const { evaluateDomain } = require('../../utils/domainEvaluator');

async function fetchInternshalaJobs() {
  const stats = { fetched: 0, accepted: 0, rejected: 0, error: null, status: 'Working' };
  const jobs = [];

  try {
    const url = 'https://internshala.com/internships/computer-science-internship/';
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    });

    const $ = cheerio.load(response.data);

    $('.individual_internship').each((i, el) => {
      // Limit to 50 items
      if (stats.fetched >= 50) return false;
      
      const title = $(el).find('.job-internship-name').text().trim();
      const company = $(el).find('.company-name').text().trim();
      const location = $(el).find('.row-1-item.locations a').text().trim() || 'India';
      let link = $(el).find('.job-internship-name a').attr('href') || $(el).attr('data-href');
      
      if (!title || !link) return;
      
      if (link && link.startsWith('/')) {
        link = `https://internshala.com${link}`;
      }

      stats.fetched++;

      // Internshala doesn't expose clean deadlines on the search page, so we use 'Not specified'
      const deadline = 'Not specified';
      
      const domain = evaluateDomain(title);
      if (!domain) {
        stats.rejected++;
        return;
      }

      jobs.push({
        title,
        company,
        location,
        source: 'internshala',
        sourceUrl: link,
        primaryType: 'Internship',
        domain,
        isIndiaLocation: true,
        deadline,
        deduplicationKey: `Internshala::${link}`
      });
      stats.accepted++;
    });

    if (stats.fetched === 0) {
      throw new Error('Blocked by Cloudflare/Bot-protection');
    }
  } catch (err) {
    stats.error = err.message || 'Unavailable';
    stats.status = 'Error';
  }

  return { jobs, stats };
}

module.exports = { fetchInternshalaJobs };
