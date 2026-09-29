/**
 * internshalaAdapter.js
 * Source adapter for Internshala Computer Science and Engineering internships.
 * Normalizes listings with clean URLs, compensation classification, and native Date handling.
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { evaluateDomain } = require('../../utils/domainEvaluator');
const { cleanUrl, generateDeduplicationKey, generateFingerprint } = require('../../utils/deduplicator');
const { classifyInternshipCompensation } = require('../../utils/jobValidator');
const { parseDeadline } = require('../../utils/dateParser');

const SOURCE_NAME = 'internshala';

async function fetchInternshalaJobs() {
  const stats = { fetched: 0, accepted: 0, rejected: 0, error: null, status: 'Working' };
  const jobs = [];

  try {
    const url = 'https://internshala.com/internships/computer-science-internship/';
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 15000
    });

    const $ = cheerio.load(response.data);

    $('.individual_internship').each((i, el) => {
      if (stats.fetched >= 50) return false;

      const title = $(el).find('.job-internship-name').text().trim();
      const company = $(el).find('.company-name').text().trim();
      const location = $(el).find('.row-1-item.locations a').text().trim() || 'India / Remote';
      let link = $(el).find('.job-internship-name a').attr('href') || $(el).attr('data-href');

      if (!title || !link) return;

      if (link.startsWith('/')) {
        link = `https://internshala.com${link}`;
      }

      stats.fetched++;

      const cleanedLink = cleanUrl(link);
      const domain = evaluateDomain(title);
      if (!domain) {
        stats.rejected++;
        return;
      }

      // Extract stipend if available
      const stipend = $(el).find('.stipend').text().trim() || '';
      const secondaryType = classifyInternshipCompensation(title, '', stipend);

      // Extract potential deadline text
      let rawDeadline = null;
      $(el).find('.other_detail_item').each((_, item) => {
        const itemText = $(item).text();
        if (itemText.toLowerCase().includes('apply by')) {
          rawDeadline = itemText.replace(/apply by/i, '').trim();
        }
      });

      const { deadlineDate, deadlineText } = parseDeadline(rawDeadline);

      jobs.push({
        title,
        company: company || 'Internshala Recruiter',
        location,
        salary: stipend || 'Unspecified Stipend',
        source: SOURCE_NAME,
        sourceUrl: cleanedLink,
        applyUrl: cleanedLink,
        primaryType: 'Internship',
        secondaryType,
        domain,
        experienceLevel: 'Fresher',
        experience: 'Fresher / Entry Level',
        isIndiaLocation: true,
        deadline: deadlineText,
        deadlineDate,
        deduplicationKey: `Internshala::${cleanedLink}`,
        normalizedFingerprint: generateFingerprint(title, company, location, 'Internship')
      });
      stats.accepted++;
    });

    if (stats.fetched === 0) {
      if (response.data.includes('cloudflare') || response.data.includes('challenge-running')) {
        throw new Error('Blocked by Cloudflare bot protection');
      }
      throw new Error('No internships parsed from page');
    }
  } catch (err) {
    stats.error = err.message || 'Unavailable';
    stats.status = 'Error';
  }

  return { jobs, stats };
}

module.exports = { fetchInternshalaJobs };
