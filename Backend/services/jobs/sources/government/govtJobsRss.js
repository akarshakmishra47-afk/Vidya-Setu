/**
 * govtJobsRss.js
 * Source adapter for Government Job RSS feeds (India).
 *
 * Sources:
 *  1. freejobalert.com/feed/ — public RSS, no auth
 *  2. sarkarinaukriblog.com/feed — public RSS, no auth
 *
 * All entries from these feeds are India government jobs by nature.
 * We parse XML manually without external dependencies.
 */

const { httpGet } = require('../../utils/httpClient');
const { classifyBranch, classifyExperienceLevel } = require('../../utils/branchClassifier');
const { classifyGovtCategory } = require('../../utils/companyClassifier');
const { generateDeduplicationKey } = require('../../utils/deduplicator');

const SOURCE_NAME = 'govtRss';

// Public RSS feeds for Indian government jobs
const RSS_FEEDS = [
  {
    name: 'freejobalert',
    url: 'https://www.freejobalert.com/feed/',
    defaultLocation: 'India (Various)'
  },
  {
    name: 'sarkarinaukri',
    url: 'https://sarkarinaukriblog.com/feed',
    defaultLocation: 'India'
  }
];

/**
 * Simple XML RSS parser — no external dependencies required.
 * Extracts items from RSS 2.0 feed.
 * @param {string} xmlText
 * @returns {Array<{title,link,description,pubDate,category}>}
 */
function parseRssFeed(xmlText) {
  const items = [];
  if (!xmlText || typeof xmlText !== 'string') return items;

  // Extract all <item> blocks
  const itemPattern = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemPattern.exec(xmlText)) !== null) {
    const block = match[1];

    const getTag = (tag) => {
      // Try CDATA first
      const cdataRe = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i');
      const plainRe = new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'i');

      const cdataMatch = cdataRe.exec(block);
      if (cdataMatch) return cdataMatch[1].trim();

      const plainMatch = plainRe.exec(block);
      if (plainMatch) return plainMatch[1].trim();

      return '';
    };

    const title       = getTag('title');
    const link        = getTag('link') || getTag('guid');
    const description = getTag('description').substring(0, 500);
    const pubDate     = getTag('pubDate');
    const category    = getTag('category');

    if (title && link) {
      items.push({ title, link, description, pubDate, category });
    }
  }

  return items;
}

/**
 * Normalizes an RSS item into the standard job schema.
 */
function normalizeGovtJob(item, feedName) {
  const title    = item.title.substring(0, 200).trim();
  const applyUrl = item.link.trim();
  const desc     = item.description || '';
  const company  = item.category || extractOrganization(title, desc) || 'Government of India';

  const branch       = classifyBranch(title, desc);
  const expLevel     = classifyExperienceLevel(title, desc);
  const govtCategory = classifyGovtCategory(title, company, desc);
  const sourceId     = `govtRss_${feedName}_${Buffer.from(applyUrl).toString('base64')}`;

  const postedAt = item.pubDate ? new Date(item.pubDate) : null;

  // Check if likely expired (older than 90 days)
  if (postedAt && (Date.now() - postedAt.getTime()) > 90 * 24 * 60 * 60 * 1000) {
    return null; // skip old entries
  }

  const isIntern = /\b(intern|internship|trainee|student intern|summer intern|winter intern|graduate intern)\b/i.test(title);
  const primaryType = isIntern ? 'Internship' : 'Job';
  
  const { classifyInternshipCompensation } = require('../../utils/jobValidator');
  const secondaryType = isIntern ? classifyInternshipCompensation(title, desc, 'As per government norms') : 'Full-Time';

  return {
    title,
    company,
    location: 'India (Various)',
    salary: 'As per government norms',
    badge: isIntern ? '🎓 Govt Internship' : '🏛️ Government',
    tags: ['Government', govtCategory, 'India'],
    desc,
    primaryType,
    secondaryType,
    category: isIntern ? 'Internship' : 'Government',
    govtCategory,
    branch,
    experienceLevel: expLevel,
    companyType: 'government',
    applyUrl,
    source: SOURCE_NAME,
    sourceId,
    sourceUrl: `https://www.freejobalert.com`,
    postedAt,
    expiresAt: null,
    deadline: 'Check official notification',
    experience: expLevel === 'Unknown' ? 'As per notification' : expLevel,
    companyLogo: '',
    isAktu: false,
    isIndiaLocation: true,
    indiaRegion: 'Other',
    deduplicationKey: generateDeduplicationKey(SOURCE_NAME, sourceId, title, company, applyUrl),
    relevanceScore: 5 // boost govt jobs
  };
}

/**
 * Extracts organization name from job title.
 */
function extractOrganization(title, desc) {
  // Common patterns: "Recruitment in XYZ", "XYZ Recruitment", "XYZ Notification"
  const patterns = [
    /recruitment\s+(?:in|for|by|at)\s+([A-Z][^\n,]+)/i,
    /([A-Z][A-Z\s]+(?:Commission|Board|Corporation|Bank|Railway|Department|Ministry|Authority))/i,
    /((?:UPSC|SSC|IBPS|RBI|NABARD|ISRO|DRDO|HAL|BHEL|ONGC|NTPC|IOCL|NHM|AIIMS))/i
  ];

  for (const pattern of patterns) {
    const match = (title + ' ' + desc).match(pattern);
    if (match) return match[1].trim().substring(0, 100);
  }
  return '';
}

/**
 * Fetches government jobs from all configured RSS feeds.
 * @returns {Promise<{ jobs: Object[], stats: Object }>}
 */
async function fetchGovtJobsRss() {
  const stats = {
    fetched: 0, accepted: 0, rejected: 0, duplicates: 0,
    error: null, feeds: {}
  };
  const allJobs = [];

  for (const feed of RSS_FEEDS) {
    const feedStats = { fetched: 0, accepted: 0, rejected: 0, error: null };

    try {
      console.log(`[GovtRSS:${feed.name}] Fetching ${feed.url}`);
      const body = await httpGet(feed.url, {
        timeout: 20000,
        retries: 1,
        headers: { 'Accept': 'application/rss+xml, application/xml, text/xml, */*' }
      });

      const items = parseRssFeed(body);
      feedStats.fetched = items.length;
      stats.fetched += items.length;

      for (const item of items) {
        // Validate URL
        const url = (item.link || '').trim();
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          feedStats.rejected++;
          stats.rejected++;
          continue;
        }

        if (!item.title || item.title.trim().length < 5) {
          feedStats.rejected++;
          stats.rejected++;
          continue;
        }

        try {
          const normalized = normalizeGovtJob(item, feed.name);
          if (!normalized) {
            // Was null — expired or filtered
            feedStats.rejected++;
            stats.rejected++;
            continue;
          }
          allJobs.push(normalized);
          feedStats.accepted++;
          stats.accepted++;
        } catch (e) {
          console.warn(`[GovtRSS:${feed.name}] Normalization error: ${e.message}`);
          feedStats.rejected++;
          stats.rejected++;
        }
      }

    } catch (err) {
      feedStats.error = err.message;
      console.error(`[GovtRSS:${feed.name}] Error: ${err.message}`);
      if (!stats.error) stats.error = `${feed.name}: ${err.message}`;
    }

    stats.feeds[feed.name] = feedStats;
    // Polite delay between feeds
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`[GovtRSS] Total: fetched=${stats.fetched} accepted=${stats.accepted} rejected=${stats.rejected}`);
  return { jobs: allJobs, stats };
}

module.exports = { fetchGovtJobsRss };
