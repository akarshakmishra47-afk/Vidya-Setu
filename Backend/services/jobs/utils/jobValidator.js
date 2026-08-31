/**
 * jobValidator.js
 * Validates job records before inserting into the database.
 * Strict validation — rejects any record that doesn't meet quality requirements.
 */

/**
 * Validates a URL — must start with http:// or https://
 * @param {string} url
 * @returns {boolean}
 */
function isValidUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const u = url.trim();
  return u.startsWith('http://') || u.startsWith('https://');
}

/**
 * Validates a single normalized job object.
 * Returns { valid: boolean, reasons: string[] }
 * @param {Object} job
 * @returns {{ valid: boolean, reasons: string[] }}
 */
function validateJob(job) {
  const reasons = [];

  if (!job.title || typeof job.title !== 'string' || job.title.trim().length < 2) {
    reasons.push('Missing or invalid title');
  }
  if (!job.company || typeof job.company !== 'string' || job.company.trim().length < 1) {
    reasons.push('Missing or invalid company');
  }
  if (!job.location || typeof job.location !== 'string') {
    reasons.push('Missing location');
  }
  if (!isValidUrl(job.applyUrl)) {
    reasons.push(`Invalid applyUrl: "${job.applyUrl}"`);
  }
  if (!job.source) {
    reasons.push('Missing source');
  }
  if (!job.primaryType || !['Internship', 'Job', 'Hackathon'].includes(job.primaryType)) {
    reasons.push(`Invalid primaryType: "${job.primaryType}"`);
  }

  // Check deduplication key
  if (!job.deduplicationKey || job.deduplicationKey.trim().length < 3) {
    reasons.push('Missing or invalid deduplicationKey');
  }

  return {
    valid: reasons.length === 0,
    reasons
  };
}

/**
 * Classifies internship compensation type from available data.
 * Only marks Paid if explicitly stated; only Free if explicitly stated.
 * @param {string} title
 * @param {string} description
 * @param {string|number} salary
 * @returns {'Paid'|'Free'|'Unknown'}
 */
function classifyInternshipCompensation(title = '', description = '', salary = '') {
  const combined = (title + ' ' + description + ' ' + (salary || '')).toLowerCase();

  const freeRegex = /\b(unpaid|no stipend|volunteer|pro bono|free internship|no compensation|non-paid|without stipend|zero stipend)\b/;
  const isFree = freeRegex.test(combined);

  // If it explicitly says unpaid/no stipend, it's free. This overrides any other mention of "stipend"
  if (isFree) return 'Free';

  const paidRegex = /\b(stipend|paid|salary|compensation|₹|rs\.?|inr|per month|\/month|monthly|remuneration|lpa|ctc)\b/;
  const isPaid = paidRegex.test(combined);

  if (isPaid) return 'Paid';
  
  return 'Unknown';
}

/**
 * Classifies if a job is entry-level/fresher based on title.
 * @param {string} title
 * @param {string} [experience='']
 * @returns {boolean}
 */
function classifyFresher(title, experience = '') {
  const t = title.toLowerCase();
  const e = experience.toLowerCase();
  
  const seniorRegex = /\b(senior|lead|manager|principal|head|director|sr|vp|architect|staff)\b|\b[3-9]\+?\s*years\b|\b\d{2,}\+?\s*years\b/;
  if (seniorRegex.test(t) || seniorRegex.test(e)) return false;

  // Explicit fresher wording or strict 0-2 years logic
  const explicitFresherRegex = /\b(fresher|freshers|graduate|new graduate|campus|graduate engineer trainee|get|trainee|entry level|entry-level|0-1 years|0-2 years|0 to 1|0 to 2|0 - 1|0 - 2|no experience)\b/;
  
  if (explicitFresherRegex.test(t) || explicitFresherRegex.test(e)) return true;
  
  // Only use junior/associate if experience explicitly states low years
  const weakFresherRegex = /\b(junior|jr|associate)\b/;
  if (weakFresherRegex.test(t) && /\b(0|1|2)\b/.test(e)) return true;
  
  return false;
}

/**
 * Classifies the category of the job based on title and existing source.
 * @param {string} title
 * @param {string} source
 * @returns {'Government'|'Private'|'IT'|'Engineering'|'Other'}
 */
function classifyJobCategory(title, source) {
  if (source === 'govtRss') return 'Government';
  
  const t = title.toLowerCase();
  
  const itRegex = /\b(software|developer|frontend|backend|fullstack|data science|data scientist|machine learning|ai|qa|tester|devops|sre|product manager|ui\/ux|system administrator|cybersecurity)\b/;
  if (itRegex.test(t)) return 'IT';

  const engRegex = /\b(mechanical|civil|electrical|electronics|hardware|aerospace|chemical|metallurgy|structural|manufacturing|production|cad)\b/;
  if (engRegex.test(t)) return 'Engineering';

  return 'Private';
}

module.exports = { validateJob, isValidUrl, classifyInternshipCompensation, classifyFresher, classifyJobCategory };
