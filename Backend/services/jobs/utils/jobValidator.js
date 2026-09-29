/**
 * jobValidator.js
 * Centralized deterministic validation and classification engine for
 * jobs, internships, and hackathons.
 *
 * Clearly distinguishes REQUIRED fields from OPTIONAL fields.
 * Performs deterministic experience classification so senior roles
 * are NEVER mistakenly labeled as 'Fresher'.
 */

const { cleanUrl, generateFingerprint, generateDeduplicationKey } = require('./deduplicator');
const { parseDeadline, parseDate } = require('./dateParser');

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
 * Deterministically classifies experience requirements from title, experience string,
 * and description snippet.
 *
 * Ensures senior, lead, staff, or multi-year roles are NEVER classified as 'Fresher'.
 *
 * @param {string} title
 * @param {string} [experience='']
 * @param {string} [description='']
 * @returns {{ level: 'Fresher'|'Entry-Level'|'Junior'|'Experienced'|'Unknown', label: string }}
 */
function classifyExperience(title = '', experience = '', description = '') {
  const t = (title || '').toLowerCase();
  const e = (experience || '').toLowerCase();
  const d = (description || '').substring(0, 300).toLowerCase();
  const combined = `${t} ${e} ${d}`;

  // 1. Executive / Senior / Leadership Roles
  const seniorTitles = /\b(principal|staff|director|architect|head of|lead|tech lead|team lead|engineering manager|vice president|vp)\b/;
  if (seniorTitles.test(t)) {
    return { level: 'Experienced', label: 'Experienced / Senior' };
  }
  if (/\b(senior|sr\.?|sr\b|senior engineer|senior developer)\b/.test(t)) {
    return { level: 'Experienced', label: 'Experienced / Senior' };
  }

  // 2. Explicit year ranges (e.g. "5+ years", "3-5 years", "0-2 years")
  const yearsMatch = combined.match(/\b(\d+)\s*(?:-|to|\+)\s*(\d+)?\s*(?:years?|yrs?)\b/);
  if (yearsMatch) {
    const minYears = parseInt(yearsMatch[1], 10);
    const maxYears = yearsMatch[2] ? parseInt(yearsMatch[2], 10) : minYears;

    if (minYears >= 5 || maxYears >= 5) {
      return { level: 'Experienced', label: '5+ years' };
    }
    if (minYears >= 3 || maxYears >= 3) {
      return { level: 'Experienced', label: '3–5 years' };
    }
    if (minYears >= 1 || maxYears >= 2) {
      return { level: 'Junior', label: '1–3 years' };
    }
    if (minYears === 0) {
      return { level: 'Fresher', label: '0–1 years' };
    }
  }

  // 3. Unbounded years "5+ years", "3+ years"
  if (/\b(?:5\+|6\+|7\+|8\+|9\+|10\+)\s*(?:years?|yrs?)\b/.test(combined)) {
    return { level: 'Experienced', label: '5+ years' };
  }
  if (/\b(?:3\+|4\+)\s*(?:years?|yrs?)\b/.test(combined)) {
    return { level: 'Experienced', label: '3–5 years' };
  }

  // 4. Fresher, Intern, Trainee, New Graduate
  if (/\b(intern|internship|trainee|apprentice|fellowship)\b/.test(t)) {
    return { level: 'Fresher', label: 'Fresher / Entry Level' };
  }
  if (/\b(fresher|freshers|entry[ -]?level|new grad|new graduate|campus recruit|campus hiring|0[ -]?1\s*years?)\b/.test(combined)) {
    return { level: 'Fresher', label: 'Fresher / Entry Level' };
  }

  // 5. Junior / Associate Roles
  if (/\b(junior|jr\.?|associate)\b/.test(t)) {
    return { level: 'Junior', label: '1–3 years' };
  }

  // 6. Source provided non-empty text
  if (experience && experience.trim().length > 0 && e !== 'not specified' && e !== 'unknown') {
    return { level: 'Unknown', label: experience.trim() };
  }

  return { level: 'Unknown', label: 'Not specified' };
}

/**
 * Classifies internship compensation type from available data.
 * @param {string} title
 * @param {string} description
 * @param {string|number} salary
 * @returns {'Paid'|'Free'|'Unknown'}
 */
function classifyInternshipCompensation(title = '', description = '', salary = '') {
  const combined = (title + ' ' + description + ' ' + (salary || '')).toLowerCase();

  const freeRegex = /\b(unpaid|no stipend|volunteer|pro bono|free internship|no compensation|non-paid|without stipend|zero stipend)\b/;
  if (freeRegex.test(combined)) return 'Free';

  const paidRegex = /\b(stipend|paid|salary|compensation|₹|rs\.?|inr|per month|\/month|monthly|remuneration|lpa|ctc)\b/;
  if (paidRegex.test(combined)) return 'Paid';

  return 'Unknown';
}

/**
 * Validates and sanitizes a job, internship, or hackathon record before database entry.
 *
 * REQUIRED FIELDS:
 * - title (string, min 3 chars, not a test placeholder)
 * - URL (at least one valid HTTP/HTTPS url in sourceUrl or applyUrl)
 * - source (non-empty string)
 * - primaryType ('Job', 'Internship', or 'Hackathon')
 *
 * OPTIONAL FIELDS (gracefully defaulted):
 * - company, location, salary, tags, desc, domain, dates
 *
 * @param {Object} rawJob
 * @param {Date} [currentTime=new Date()]
 * @returns {{ valid: boolean, job: Object|null, reasons: string[] }}
 */
function validateJob(rawJob, currentTime = new Date()) {
  const reasons = [];
  if (!rawJob || typeof rawJob !== 'object') {
    return { valid: false, job: null, reasons: ['Record is not a valid object'] };
  }

  // ── REQUIRED: Title ──
  const title = (rawJob.title || '').trim();
  if (title.length < 3) {
    reasons.push('Title must be at least 3 characters');
  }
  if (/^(test|asdf|qwerty|n\/a|untitled)$/i.test(title)) {
    reasons.push('Title appears to be a test placeholder');
  }

  // ── REQUIRED: URL (sourceUrl or applyUrl) ──
  const rawApplyUrl = cleanUrl(rawJob.applyUrl || '');
  const rawSourceUrl = cleanUrl(rawJob.sourceUrl || '');
  const primaryUrl = rawApplyUrl || rawSourceUrl;

  if (!isValidUrl(primaryUrl)) {
    reasons.push('Must have at least one valid HTTP/HTTPS URL (applyUrl or sourceUrl)');
  }

  // ── REQUIRED: Source ──
  const source = (rawJob.source || '').trim();
  if (!source) {
    reasons.push('Source identifier is required');
  }

  // ── REQUIRED: Primary Type ──
  const primaryType = rawJob.primaryType;
  if (!['Job', 'Internship', 'Hackathon'].includes(primaryType)) {
    reasons.push(`Invalid primaryType: "${primaryType}"`);
  }

  // ── Date & Deadline Normalization ──
  const { deadlineDate, deadlineText } = parseDeadline(rawJob.deadline, currentTime);
  const postedAt = parseDate(rawJob.postedAt);
  const expiresAt = parseDate(rawJob.expiresAt) || deadlineDate;

  // Pre-insert expiry check: if deadline is explicitly set and past, reject
  if (deadlineDate && deadlineDate < currentTime) {
    reasons.push(`Deadline has already passed (${deadlineDate.toISOString().split('T')[0]})`);
  }

  if (reasons.length > 0) {
    return { valid: false, job: null, reasons };
  }

  // ── OPTIONAL: Safe Defaults & Field Harmonization ──
  const company = (rawJob.company || '').trim() || (primaryType === 'Hackathon' ? 'Organizer' : 'Company');
  const location = (rawJob.location || '').trim() || 'India / Remote';
  const desc = (rawJob.desc || '').trim();
  const salary = (rawJob.salary || '').trim() || 'Not specified';
  const tags = Array.isArray(rawJob.tags) ? rawJob.tags.filter(t => typeof t === 'string' && t.trim().length > 0) : [];

  // Secondary Type Normalization
  let secondaryType = rawJob.secondaryType || 'Unknown';
  if (primaryType === 'Internship') {
    secondaryType = classifyInternshipCompensation(title, desc, salary);
  } else if (primaryType === 'Job') {
    secondaryType = secondaryType === 'Part-Time' ? 'Part-Time' : 'Full-Time';
  } else if (primaryType === 'Hackathon') {
    secondaryType = rawJob.hackathonMode || secondaryType;
    if (!['Online', 'Offline', 'Hybrid'].includes(secondaryType)) {
      secondaryType = 'Online';
    }
  }

  // Experience Classification
  const expInfo = classifyExperience(title, rawJob.experience, desc);
  const experienceLevel = rawJob.experienceLevel && rawJob.experienceLevel !== 'Unknown'
    ? rawJob.experienceLevel
    : expInfo.level;
  const experience = expInfo.label;

  // Deduplication Keys
  const deduplicationKey = rawJob.deduplicationKey || generateDeduplicationKey(
    source, rawJob.sourceId, title, company, primaryUrl
  );
  const normalizedFingerprint = rawJob.normalizedFingerprint || generateFingerprint(
    title, company, location, primaryType
  );

  const sanitizedJob = {
    ...rawJob,
    title,
    company,
    location,
    salary,
    desc,
    tags,
    primaryType,
    secondaryType,
    category: primaryType === 'Hackathon' ? 'Hackathon' : (rawJob.category || 'Other'),
    domain: rawJob.domain || 'Software Development',
    branch: rawJob.branch || 'General Engineering',
    experienceLevel,
    experience,
    companyType: rawJob.companyType || 'unknown',
    source,
    sourceId: rawJob.sourceId || '',
    sourceUrl: rawSourceUrl || primaryUrl,
    applyUrl: rawApplyUrl || primaryUrl,
    postedAt,
    expiresAt,
    deadline: deadlineText,
    deadlineDate,
    lastVerifiedAt: currentTime,
    isIndiaLocation: rawJob.isIndiaLocation !== false,
    isActive: true,
    deduplicationKey,
    normalizedFingerprint
  };

  return { valid: true, job: sanitizedJob, reasons: [] };
}

module.exports = {
  isValidUrl,
  classifyExperience,
  classifyInternshipCompensation,
  validateJob
};
