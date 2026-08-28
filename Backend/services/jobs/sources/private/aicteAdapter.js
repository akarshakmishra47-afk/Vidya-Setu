const axios = require('axios');
const cheerio = require('cheerio');
const { evaluateDomain } = require('../../utils/domainEvaluator');

async function fetchAicteJobs() {
  const stats = { fetched: 0, accepted: 0, rejected: 0, error: null, status: 'Working' };
  const jobs = [];

  try {
    const url = 'https://internship.aicte-india.org/internship-details.php';
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);

    // AICTE uses cards for internships
    $('.card').each((i, el) => {
      if (stats.fetched >= 50) return false;

      const title = $(el).find('.card-title').text().trim();
      const company = $(el).find('h6.card-subtitle').first().text().trim() || 'AICTE Partner';
      
      // Extract location from the ul list
      let location = 'India';
      $(el).find('li').each((_, li) => {
        const text = $(li).text().toLowerCase();
        if (text.includes('location')) {
          location = $(li).text().replace(/location/i, '').replace(':', '').trim();
        }
      });

      let link = $(el).find('a.btn-primary').attr('href');
      if (!link) return;
      
      if (!link.startsWith('http')) {
        link = 'https://internship.aicte-india.org/' + link;
      }

      if (!title) return;

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
        source: 'aicte',
        sourceUrl: link,
        applyUrl: link,
        primaryType: 'Internship',
        domain,
        isIndiaLocation: true,
        deadline: 'Not specified',
        deduplicationKey: `AICTE::${title}::${company}`
      });
      stats.accepted++;
    });

    if (stats.fetched === 0) {
      throw new Error('No internships found or layout changed');
    }

  } catch (err) {
    stats.error = err.message || 'Unavailable';
    stats.status = 'Error';
  }

  return { jobs, stats };
}

module.exports = { fetchAicteJobs };
