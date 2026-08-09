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

  const paidSignals = ['stipend', 'paid', 'salary', 'compensation', '₹', 'rs.', 'inr',
    'per month', '/month', 'monthly', 'remuneration', 'lpa', 'ctc'];
  const freeSignals = ['unpaid', 'no stipend', 'volunteer', 'pro bono', 'free internship',
    'no compensation', 'non-paid'];

  const isPaid = paidSignals.some(s => combined.includes(s));
  const isFree = freeSignals.some(s => combined.includes(s));

  if (isPaid && !isFree) return 'Paid';
  if (isFree && !isPaid) return 'Free';
  return 'Unknown';
}

module.exports = { validateJob, isValidUrl, classifyInternshipCompensation };
