const axios = require('axios');
const cheerio = require('cheerio');
const { validateScholarship } = require('./scholarshipValidator');

async function fetchIndiaScholarships() {
  try {
    const url = 'https://www.indiascholarships.in/private-scholarships';
    const response = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const $ = cheerio.load(response.data);
    const items = [];
    
    $('a.group.flex.flex-col').each((i, el) => {
      const href = $(el).attr('href');
      const title = $(el).find('h3').text().trim();
      const provider = $(el).find('p.text-slate-500').text().trim() || $(el).find('p').first().text().trim();
      
      let amount = 'Unknown';
      let deadline = 'Unknown';
      
      $(el).find('span').each((j, span) => {
        const text = $(span).text().trim();
        if (text.includes('₹')) amount = text;
        else if (text.includes('Deadline:')) deadline = text.replace('Deadline:', '').trim();
      });
      
      if (title && href) {
        items.push({
          title,
          provider,
          amount,
          deadline,
          link: href.startsWith('http') ? href : `https://www.indiascholarships.in${href}`,
          description: `${provider} is offering ${amount}. Deadline: ${deadline}`
        });
      }
    });
    return { status: 200, items };
  } catch (error) {
    return { status: 500, error: error.message };
  }
}

async function fetchJson(url) {
  try {
    const response = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 });
    return { status: response.status, data: response.data };
  } catch (error) {
    return { status: error.response?.status || 500, error: error.message };
  }
}

async function fetchAllScholarships() {
  const allScholarships = [];
  const results = {
    indiascholarships: { fetched: 0, accepted: 0, rejected: 0 }
  };

  console.log('🚀 [ScholarshipFetcher] Starting full fetch cycle...');

  // Fetch from indiascholarships.in/private-scholarships
  try {
    const res = await fetchIndiaScholarships();
    if (res.status === 200 && Array.isArray(res.items)) {
      results.indiascholarships.fetched = res.items.length;
      for (const item of res.items) {
        const validated = validateScholarship(item, 'indiascholarships');
        if (validated) {
          // Override fields the validator might have overwritten with defaults
          validated.amount = item.amount;
          validated.provider = item.provider;
          // Set an actual Date if we can parse it from string like "15 Oct 2026"
          const parsedDate = new Date(item.deadline);
          if (!isNaN(parsedDate)) {
             validated.deadlineDate = parsedDate;
          }
          validated.deadline = item.deadline;
          
          allScholarships.push(validated);
          results.indiascholarships.accepted++;
        } else {
          results.indiascholarships.rejected++;
        }
      }
    }
  } catch (err) {
    console.error(`[ScholarshipFetcher] Error fetching IndiaScholarships: ${err.message}`);
  }

  console.log('📊 [ScholarshipFetcher] Source Results:');
  console.log(`  indiascholarships: fetched=${results.indiascholarships.fetched} accepted=${results.indiascholarships.accepted} rejected=${results.indiascholarships.rejected}`);

  return allScholarships;
}

module.exports = { fetchAllScholarships };
