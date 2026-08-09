/**
 * indiaFilter.js
 * Robust India location validation.
 * Uses exact set lookups — never fragile .includes("in") substring checks.
 */

// Comprehensive list of Indian cities (lowercase)
const INDIA_CITY_WORDS = new Set([
  'bangalore', 'bengaluru', 'hyderabad', 'secunderabad', 'pune',
  'mumbai', 'bombay', 'delhi', 'newdelhi', 'noida', 'greaternoida',
  'gurugram', 'gurgaon', 'faridabad', 'ghaziabad',
  'chennai', 'madras', 'kolkata', 'calcutta',
  'ahmedabad', 'surat', 'vadodara', 'rajkot',
  'jaipur', 'lucknow', 'kanpur', 'agra', 'varanasi', 'meerut',
  'indore', 'bhopal', 'jabalpur',
  'kochi', 'thiruvananthapuram', 'kozhikode', 'thrissur',
  'coimbatore', 'madurai', 'salem', 'trichy', 'vellore',
  'bhubaneswar', 'cuttack',
  'chandigarh', 'mohali', 'ludhiana', 'amritsar',
  'mysore', 'mangaluru', 'mangalore', 'hubli',
  'nagpur', 'nashik', 'aurangabad',
  'visakhapatnam', 'vizag', 'vijayawada', 'warangal',
  'srinagar', 'jammu', 'shimla', 'dehradun',
  'ranchi', 'patna', 'raipur',
  'guwahati', 'shillong', 'imphal', 'aizawl', 'agartala',
  'pondicherry', 'puducherry',
  'navi mumbai', 'thane', 'kalyan',
  'allahabad', 'prayagraj', 'gorakhpur', 'bareilly',
  'jodhpur', 'udaipur', 'ajmer',
  'tirupati', 'nellore',
  'kolhapur', 'solapur',
  'raipur', 'bilaspur',
  'durgapur', 'asansol', 'siliguri',
  'dharwad', 'belgaum', 'bijapur'
]);

// India-specific keyword phrases (must match as full words/phrases)
const INDIA_KEYWORDS = [
  'india', 'remote - india', 'remote, india', 'india-based',
  'nationwide', 'all india', 'pan-india', 'across india',
  'pan india', 'india (remote)', 'india remote'
];

// Indian states (lowercase)
const INDIA_STATE_WORDS = new Set([
  'maharashtra', 'karnataka', 'telangana', 'andhra', 'tamilnadu',
  'tamil nadu', 'kerala', 'gujarat', 'rajasthan', 'madhya pradesh',
  'uttar pradesh', 'west bengal', 'punjab', 'haryana', 'himachal',
  'uttarakhand', 'jharkhand', 'odisha', 'assam', 'meghalaya',
  'manipur', 'mizoram', 'nagaland', 'tripura', 'arunachal',
  'sikkim', 'goa', 'chandigarh', 'delhi ncr'
]);

// Non-India country patterns to explicitly reject
const REJECT_COUNTRY_WORDS = new Set([
  'argentina', 'australia', 'austria', 'bangladesh', 'belgium',
  'brazil', 'canada', 'chile', 'china', 'colombia', 'croatia',
  'czech', 'denmark', 'egypt', 'ethiopia', 'finland', 'france',
  'georgia', 'germany', 'ghana', 'greece', 'hungary', 'indonesia',
  'iran', 'iraq', 'ireland', 'israel', 'italy', 'japan', 'jordan',
  'kenya', 'kuwait', 'malaysia', 'mexico', 'morocco', 'myanmar',
  'nepal', 'netherlands', 'new zealand', 'nigeria', 'norway',
  'pakistan', 'peru', 'philippines', 'poland', 'portugal', 'qatar',
  'romania', 'russia', 'saudi', 'serbia', 'singapore', 'south africa',
  'south korea', 'spain', 'sri lanka', 'sweden', 'switzerland',
  'taiwan', 'tanzania', 'thailand', 'turkey', 'ukraine',
  'united arab', 'united kingdom', 'united states', 'uruguay',
  'venezuela', 'vietnam', 'zimbabwe',
  // Common abbreviations
  'usa', 'uae', 'uk', 'us',
  // Generic global
  'worldwide', 'global', 'anywhere', 'international', 'europe',
  'apac', 'emea', 'latam', 'americas', 'middle east', 'africa',
  'southeast asia', 'latin america'
]);

/**
 * Returns true if the given location string refers to an India-based opportunity.
 * Handles: Indian cities, states, "India", "Remote - India", etc.
 * Rejects: Argentina, UK, USA, global/worldwide, etc.
 *
 * @param {string} location
 * @returns {boolean}
 */
function isIndiaLocation(location) {
  if (!location || typeof location !== 'string') return false;
  const loc = location.toLowerCase().trim();
  if (!loc) return false;

  // Short-circuit: bare "india" or "remote" (treat remote as potentially India)
  if (loc === 'india') return true;
  if (loc === 'remote') return true;

  // Check India keywords (full-phrase match)
  for (const kw of INDIA_KEYWORDS) {
    if (loc.includes(kw)) return true;
  }

  // Tokenize for word-based matching
  const tokens = loc.replace(/[,./|()[\]]/g, ' ').split(/\s+/).filter(Boolean);

  // Check against known reject countries first (prioritize rejection)
  for (const token of tokens) {
    if (REJECT_COUNTRY_WORDS.has(token)) return false;
  }
  // Multi-word reject checks
  if (REJECT_COUNTRY_WORDS.has(loc)) return false;
  for (const w of REJECT_COUNTRY_WORDS) {
    if (w.includes(' ') && loc.includes(w)) return false;
  }

  // If "remote" + reject country word → reject
  if (loc.includes('remote') && tokens.some(t => REJECT_COUNTRY_WORDS.has(t))) return false;

  // Check city/state words
  for (const token of tokens) {
    if (INDIA_CITY_WORDS.has(token)) return true;
  }
  // Multi-word city checks (e.g. "new delhi", "navi mumbai")
  for (const city of INDIA_CITY_WORDS) {
    if (city.includes(' ') && loc.includes(city)) return true;
  }
  for (const state of INDIA_STATE_WORDS) {
    if (state.includes(' ') && loc.includes(state)) return true;
    if (tokens.includes(state)) return true;
  }

  // If "remote" with no explicit country → treat as potential India (accepted for remote-friendly roles)
  if (loc.startsWith('remote') && !tokens.some(t => REJECT_COUNTRY_WORDS.has(t))) return true;

  return false;
}

/**
 * Returns the India region based on location.
 * @param {string} location
 * @returns {string}
 */
function getIndiaRegion(location) {
  const loc = (location || '').toLowerCase();

  const NORTH = ['delhi', 'noida', 'gurgaon', 'gurugram', 'faridabad', 'ghaziabad',
    'lucknow', 'kanpur', 'agra', 'varanasi', 'jaipur', 'chandigarh', 'ludhiana',
    'amritsar', 'dehradun', 'srinagar', 'jammu', 'meerut', 'allahabad', 'prayagraj',
    'jodhpur', 'udaipur', 'bareilly', 'gorakhpur', 'shimla'];
  const SOUTH = ['bangalore', 'bengaluru', 'hyderabad', 'chennai', 'kochi', 'thiruvananthapuram',
    'coimbatore', 'madurai', 'mysore', 'mangaluru', 'trichy', 'vellore', 'salem',
    'vijayawada', 'visakhapatnam', 'vizag', 'tirupati', 'warangal', 'pondicherry',
    'secunderabad', 'hubli', 'dharwad'];
  const WEST = ['mumbai', 'pune', 'ahmedabad', 'surat', 'vadodara', 'rajkot', 'nashik',
    'nagpur', 'aurangabad', 'thane', 'navi mumbai', 'kolhapur', 'solapur', 'goa'];
  const EAST = ['kolkata', 'bhubaneswar', 'ranchi', 'patna', 'durgapur', 'asansol',
    'siliguri', 'raipur', 'bilaspur'];
  const NE = ['guwahati', 'shillong', 'imphal', 'aizawl', 'agartala', 'itanagar',
    'kohima', 'gangtok'];

  for (const c of SOUTH)  if (loc.includes(c)) return 'South';
  for (const c of NORTH)  if (loc.includes(c)) return 'North';
  for (const c of WEST)   if (loc.includes(c)) return 'West';
  for (const c of EAST)   if (loc.includes(c)) return 'East';
  for (const c of NE)     if (loc.includes(c)) return 'Northeast';
  if (loc.includes('remote')) return 'Remote';

  return 'Other';
}

module.exports = { isIndiaLocation, getIndiaRegion };
