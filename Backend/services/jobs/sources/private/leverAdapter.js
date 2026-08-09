const { httpGet } = require('../../utils/httpClient');
const { generateDeduplicationKey } = require('../../utils/deduplicator');
const { classifyBranch } = require('../../utils/branchClassifier');
const { classifyInternshipCompensation, classifyFresher, classifyJobCategory } = require('../../utils/jobValidator');

const COMPANIES = ['lever', 'kpmg']; // Expand as needed

/**
 * Validates if the location is in India or Remote (India eligible).
 */
function isIndiaLocation(locationName) {
  if (!locationName) return false;
  const loc = locationName.toLowerCase();
  
  const rejectRegex = /\b(usa|uk|united states|united kingdom|canada|singapore|philippines|australia|europe|emea|latam|apac|worldwide)\b/;
  if (rejectRegex.test(loc) && !loc.includes('india')) return false;

  const acceptRegex = /\b(india|bangalore|bengaluru|mumbai|delhi|new delhi|gurgaon|gurugram|noida|hyderabad|chennai|pune|kolkata|ahmedabad|remote.*india)\b/;
  
  if (acceptRegex.test(loc)) return true;
  return false;
}

async function fetchLeverJobs() {
  const allJobs = [];
  let totalFetched = 0;
  let totalAccepted = 0;
  let totalRejected = 0;

  for (const company of COMPANIES) {
    const url = `https://api.lever.co/v0/postings/${company}?mode=json`;
    try {
      const responseText = await httpGet(url);
      const data = JSON.parse(responseText);
      
      if (!Array.isArray(data)) continue;

      totalFetched += data.length;

      for (const job of data) {
        const title = job.text || '';
        const location = job.categories && job.categories.location ? job.categories.location : '';
        const applyUrl = job.hostedUrl || job.applyUrl;
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
          : 'Full-Time'; 

        const category = classifyJobCategory(title, 'lever');
        const isFresher = classifyFresher(title);
        
        const branch = classifyBranch(title);
        const deduplicationKey = generateDeduplicationKey('lever', `${company}_${sourceId}`);

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
          source: 'lever',
          sourceId,
          sourceUrl: `https://jobs.lever.co/${company}`,
          postedAt: new Date(job.createdAt || Date.now()),
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
      console.warn(`[Lever:${company}] Failed to fetch: ${err.message}`);
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
      url: 'lever_multiple'
    }
  };
}

module.exports = { fetchLeverJobs };
