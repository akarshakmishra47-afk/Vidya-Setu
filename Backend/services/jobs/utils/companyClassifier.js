/**
 * companyClassifier.js
 * Classifies companies as Product / Service / Government / Unknown.
 * Never guesses aggressively — defaults to 'unknown' when uncertain.
 */

const PRODUCT_COMPANIES = new Set([
  // Global Tech
  'microsoft', 'google', 'amazon', 'apple', 'meta', 'facebook', 'netflix',
  'twitter', 'x corp', 'linkedin', 'salesforce', 'oracle', 'sap', 'adobe',
  'nvidia', 'amd', 'intel', 'qualcomm', 'broadcom',
  // Cloud / SaaS
  'atlassian', 'slack', 'zoom', 'github', 'gitlab', 'bitbucket', 'jira',
  'datadog', 'splunk', 'elastic', 'cloudflare', 'okta', 'auth0', 'twilio',
  'sendgrid', 'stripe', 'braintree', 'hubspot', 'zendesk', 'freshdesk',
  'intercom', 'notion', 'figma', 'canva', 'miro',
  // Indian Product Companies
  'flipkart', 'zomato', 'swiggy', 'ola', 'oyo', 'byju', 'unacademy',
  'vedantu', 'paytm', 'phonepe', 'razorpay', 'zepto', 'blinkit',
  'grofers', 'dunzo', 'cred', 'meesho', 'nykaa', 'mamaearth',
  'sharechat', 'inmobi', 'freshworks', 'chargebee', 'zoho', 'browserstack',
  'cashfree', 'instamojo', 'lenskart', 'pepperfry', 'urban ladder',
  'urban company', 'cars24', 'spinny', 'groww', 'zerodha', 'upstox',
  'smallcase', 'cleartax', 'quickheal', 'mphasis', 'mindtickle',
  'leadsquared', 'darwinbox', 'greythr', 'keka', 'skillsoft', 'simplilearn',
  // Other Notable
  'databricks', 'snowflake', 'confluent', 'hashicorp', 'vercel', 'netlify',
  'supabase', 'firebase', 'heroku', 'digitalocean', 'linode', 'vultr',
  'hotstar', 'cricbuzz', 'justdial', 'indiamart', 'snapdeal', 'makemytrip',
  'goibibo', 'yatra', 'cleartrip', 'ixigo', 'redbus', 'abhibus'
]);

const SERVICE_COMPANIES = new Set([
  // Indian IT Services
  'tcs', 'tata consultancy', 'infosys', 'wipro', 'hcl', 'hcltech',
  'tech mahindra', 'ltimindtree', 'mphasis', 'hexaware', 'niit',
  'mindtree', 'cyient', 'mastech', 'kpit', 'zensar', 'persistent',
  'coforge', 'sonata', 'birlasoft', 'l&t technology', 'tata elxsi',
  // Global IT Services
  'accenture', 'ibm', 'cognizant', 'capgemini', 'atos',
  'deloitte', 'pwc', 'ernst', 'ey ', 'kpmg', 'bain', 'mckinsey',
  'bcg', 'boston consulting',
  // Global Banks (service-oriented IT)
  'goldman sachs', 'morgan stanley', 'jpmorgan', 'barclays', 'deutsche bank',
  'citibank', 'wells fargo', 'bank of america', 'credit suisse', 'ubs',
  // Indian Banks & Financial Services
  'icici', 'hdfc', 'axis bank', 'kotak', 'yes bank', 'sbi card',
  'bajaj finserv', 'bajaj finance', 'loan', 'nse', 'bse', 'sebi'
]);

// Government/PSU indicators
const GOVT_KEYWORDS = new Set([
  'upsc', 'ssc', 'railways', 'railway', 'bsnl', 'bhel', 'ongc', 'ntpc',
  'iocl', 'hpcl', 'bpcl', 'gail', 'sail', 'nalco', 'moil', 'nmdc',
  'npcil', 'drdo', 'isro', 'barc', 'hal', 'beml', 'bel', 'ecil',
  'rbi', 'nabard', 'sidbi', 'exim bank', 'ibps', 'bank po',
  'municipal', 'nagar nigam', 'state government', 'central government',
  'psu ', 'public sector', 'government of india', 'ministry',
  'defence', 'army', 'navy', 'air force', 'coast guard', 'crpf', 'cisf',
  'nsc', 'lic', 'gic', 'insurance', 'post office', 'india post'
]);

/**
 * Classifies a company as product, service, government, or unknown.
 * @param {string} company
 * @param {boolean} isGovt - from source metadata
 * @returns {'product'|'service'|'government'|'unknown'}
 */
function classifyCompanyType(company = '', isGovt = false) {
  if (isGovt) return 'government';

  const comp = (company || '').toLowerCase();
  if (!comp) return 'unknown';

  // Check government indicators
  for (const kw of GOVT_KEYWORDS) {
    if (comp.includes(kw)) return 'government';
  }

  // Exact or partial match for product companies
  for (const p of PRODUCT_COMPANIES) {
    if (comp.includes(p)) return 'product';
  }

  // Exact or partial match for service companies
  for (const s of SERVICE_COMPANIES) {
    if (comp.includes(s)) return 'service';
  }

  return 'unknown';
}

/**
 * Detects government category from title/company/description.
 * @param {string} title
 * @param {string} company
 * @param {string} description
 * @returns {string} govtCategory
 */
function classifyGovtCategory(title = '', company = '', description = '') {
  const combined = (title + ' ' + company + ' ' + description).toLowerCase();

  if (/railway|rrb|rrc/.test(combined)) return 'Railway';
  if (/bank|ibps|rbi|nabard|sidbi|lic|insurance/.test(combined)) return 'Banking';
  if (/defence|army|navy|air force|drdo|isro|barc|hal|crpf|cisf|coast guard/.test(combined)) return 'Defence';
  if (/psu|bhel|ongc|ntpc|iocl|hpcl|bpcl|gail|sail|bel|beml|ecil|public sector unit/.test(combined)) return 'PSU';
  if (/state government|state public|state psc|psc|state board/.test(combined)) return 'State';
  if (/upsc|ssc|central government|union government|ministry|government of india/.test(combined)) return 'Central';

  return 'Other';
}

module.exports = { classifyCompanyType, classifyGovtCategory };
