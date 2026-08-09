const { httpGet } = require('../../utils/httpClient');
const { generateDeduplicationKey } = require('../../utils/deduplicator');
const { classifyBranch } = require('../../utils/branchClassifier');
const { classifyInternshipCompensation, classifyFresher, classifyJobCategory } = require('../../utils/jobValidator');

const COMPANIES = [
  'postman', 'groww', 'airbnb', 'pinterest', 'coinbase', 
  'stripe', 'robinhood', 'instacart', 'discord', 'reddit', 
  'figma', 'gitlab', 'twitch', 'dropbox'
];

/**
 * Validates if the location is in India or Remote (India eligible).
 * Rejects strictly global/US/UK locations.
 */
function isIndiaLocation(locationName) {
  if (!locationName) return false;
  const loc = locationName.toLowerCase();
  
  // Reject non-India global/remote hubs if they don't explicitly mention India
  const rejectRegex = /\b(usa|uk|united states|united kingdom|canada|singapore|philippines|australia|europe|emea|latam|apac|worldwide)\b/;
  if (rejectRegex.test(loc) && !loc.includes('india')) return false;

  // Accept India, Indian cities, and Remote (if India is implied or explicitly stated)
  const acceptRegex = /\b(india|bangalore|bengaluru|mumbai|delhi|new delhi|gurgaon|gurugram|noida|hyderabad|chennai|pune|kolkata|ahmedabad|remote.*india)\b/;
  
  if (acceptRegex.test(loc)) return true;
  
  // If it just says 'remote' without restricting to another country, we might accept it, 
  // but to be safe and strict as per user: 'Reject Remote without India qualification'.
  return false;
}

async function fetchGreenhouseJobs() {
  const allJobs = [];
  let totalFetched = 0;
  let totalAccepted = 0;
  let totalRejected = 0;

  for (const company of COMPANIES) {
    const url = `https://boards-api.greenhouse.io/v1/boards/${company}/jobs`;
    try {
      const responseText = await httpGet(url);
      const data = JSON.parse(responseText);
      
      if (!data.jobs || !Array.isArray(data.jobs)) continue;

      totalFetched += data.jobs.length;

      for (const job of data.jobs) {
        const title = job.title || '';
        const location = job.location ? job.location.name : '';
        const applyUrl = job.absolute_url;
        const sourceId = job.id ? job.id.toString() : '';

        if (!applyUrl || (!applyUrl.startsWith('http://') && !applyUrl.startsWith('https://'))) {
          totalRejected++;
          continue;
        }

        if (!isIndiaLocation(location)) {
          totalRejected++;
          continue;
        }

        const isIntern = /\b(intern|internship|trainee)\b/i.test(title);
        const primaryType = isIntern ? 'Internship' : 'Job';
        
        const secondaryType = isIntern 
          ? classifyInternshipCompensation(title, '', '') 
          : 'Full-Time'; // Greenhouse API rarely provides salary directly in board endpoint

        const category = classifyJobCategory(title, 'greenhouse');
        const isFresher = classifyFresher(title);
        
        const branch = classifyBranch(title);
        const deduplicationKey = generateDeduplicationKey('greenhouse', `${company}_${sourceId}`);

        allJobs.push({
          title: title,
          company: company.charAt(0).toUpperCase() + company.slice(1),
          location: location || 'Remote / India',
          salary: 'Not specified',
          badge: isIntern ? '🎓 Internship' : '💼 Private',
          tags: [company, category],
          desc: 'Click Apply Now to view full description on the company website.',
          primaryType,
          secondaryType,
          category: isIntern ? 'Internship' : category,
          govtCategory: 'Unknown',
          branch,
          experienceLevel: isFresher ? 'Fresher' : 'Unknown',
          companyType: 'product',
          applyUrl,
          source: 'greenhouse',
          sourceId,
          sourceUrl: `https://boards.greenhouse.io/${company}`,
          postedAt: new Date(job.updated_at || Date.now()),
          expiresAt: null,
          deadline: 'Not specified',
          experience: isFresher ? 'Fresher' : 'Experienced',
          companyLogo: '',
          isAktu: false,
          isIndiaLocation: true,
          indiaRegion: 'Other',
          deduplicationKey,
          relevanceScore: isFresher ? 5 : 2
        });
        
        totalAccepted++;
      }
    } catch (err) {
      console.warn(`[Greenhouse:${company}] Failed to fetch: ${err.message}`);
    }
  }

  return {
    jobs: allJobs,
    stats: {
      fetched: totalFetched,
      accepted: totalAccepted,
      rejected: totalRejected,
      duplicates: 0,
      error: null,
      url: 'greenhouse_multiple'
    }
  };
}

module.exports = { fetchGreenhouseJobs };
