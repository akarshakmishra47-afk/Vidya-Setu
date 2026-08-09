const axios = require('axios');
const xml2js = require('xml2js');
const { validateScholarship } = require('./scholarshipValidator');

async function fetchJson(url) {
  try {
    const response = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 });
    return { status: response.status, data: response.data };
  } catch (error) {
    return { status: error.response?.status || 500, error: error.message };
  }
}

async function fetchRss(url) {
  try {
    const response = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 });
    const result = await xml2js.parseStringPromise(response.data);
    const items = result.rss?.channel[0]?.item || [];
    return { status: 200, items };
  } catch (error) {
    return { status: 500, error: error.message };
  }
}

async function fetchAllScholarships() {
  const allScholarships = [];
  const results = {
    huggingface: { fetched: 0, accepted: 0, rejected: 0 },
    rssFeed: { fetched: 0, accepted: 0, rejected: 0 }
  };

  console.log('🚀 [ScholarshipFetcher] Starting full fetch cycle...');

  // 1. Fetch from a sample open JSON dataset (representing an aggregator)
  // We strictly mark it as 'huggingface' so it is NOT presented as the official government source.
  const hfUrl = 'https://huggingface.co/datasets/Eshanjog/Indian-Scholarships/raw/main/scholarships.json';
  try {
    const res = await fetchJson(hfUrl);
    if (res.status === 200 && Array.isArray(res.data)) {
      results.huggingface.fetched = res.data.length;
      for (const item of res.data) {
        const validated = validateScholarship(item, 'huggingface');
        if (validated) {
          allScholarships.push(validated);
          results.huggingface.accepted++;
        } else {
          results.huggingface.rejected++;
        }
      }
    }
  } catch (err) {
    console.error(`[ScholarshipFetcher] Error fetching HuggingFace: ${err.message}`);
  }

  // 2. Fetch from a generic RSS feed (e.g. FreeJobAlert or generic education feed)
  // Currently pointed to a placeholder/generic feed; easily swappable to any official RSS.
  const rssUrl = 'https://www.freejobalert.com/feed/';
  try {
    const res = await fetchRss(rssUrl);
    if (res.status === 200 && Array.isArray(res.items)) {
      // Filter RSS for scholarship related terms
      const scholarshipItems = res.items.filter(i => {
        const title = i.title?.[0]?.toLowerCase() || '';
        return title.includes('scholarship') || title.includes('fellowship');
      });
      results.rssFeed.fetched = scholarshipItems.length;
      for (const item of scholarshipItems) {
        const validated = validateScholarship({
          title: item.title?.[0],
          description: item.description?.[0],
          link: item.link?.[0],
          pubDate: item.pubDate?.[0]
        }, 'rssFeed');
        if (validated) {
          allScholarships.push(validated);
          results.rssFeed.accepted++;
        } else {
          results.rssFeed.rejected++;
        }
      }
    }
  } catch (err) {
    console.error(`[ScholarshipFetcher] Error fetching RSS: ${err.message}`);
  }

  console.log('📊 [ScholarshipFetcher] Source Results:');
  console.log(`  huggingface: fetched=${results.huggingface.fetched} accepted=${results.huggingface.accepted} rejected=${results.huggingface.rejected}`);
  console.log(`  rssFeed: fetched=${results.rssFeed.fetched} accepted=${results.rssFeed.accepted} rejected=${results.rssFeed.rejected}`);

  return allScholarships;
}

module.exports = { fetchAllScholarships };
