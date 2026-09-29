/**
 * deduplicator.js
 * Multi-level deduplication and URL normalization for job records.
 * Ensures no duplicate listings appear within or across sources,
 * while preventing tracking parameter drift from creating duplicates.
 */

const crypto = require('crypto');

/**
 * Normalizes and strips marketing/session tracking parameters from URLs.
 * e.g. Removes ref, refId, trackingId, position, pageNum, utm_*, fbclid, etc.
 * @param {string} rawUrl - The raw URL string.
 * @returns {string} Sanitized URL.
 */
function cleanUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    const trackingParams = [
      'ref', 'refid', 'trackingid', 'position', 'pagenum', 'currentjobid',
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'fbclid', 'gclid', 'msclkid', 'trk', 'midtoken', 'ek', 'li_fat_id'
    ];

    for (const key of Array.from(parsed.searchParams.keys())) {
      if (trackingParams.includes(key.toLowerCase()) || key.toLowerCase().startsWith('utm_')) {
        parsed.searchParams.delete(key);
      }
    }

    // Strip hash fragment
    parsed.hash = '';

    // Reconstruct without trailing slash
    let cleaned = parsed.toString();
    if (cleaned.endsWith('/') && parsed.pathname !== '/') {
      cleaned = cleaned.slice(0, -1);
    }
    return cleaned;
  } catch (e) {
    // If URL parsing fails, strip query string manually
    return trimmed.replace(/[?#].*$/, '').replace(/\/+$/, '');
  }
}

/**
 * Normalizes text for comparison (lowercase, whitespace collapse, punctuation cleanup).
 * @param {string} text
 * @returns {string}
 */
function normalizeText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generates a cross-source normalized fingerprint for duplicate detection.
 * @param {string} title
 * @param {string} company
 * @param {string} location
 * @param {string} primaryType
 * @returns {string} MD5 hash fingerprint.
 */
function generateFingerprint(title = '', company = '', location = '', primaryType = 'Job') {
  const normTitle = normalizeText(title);
  const normCompany = normalizeText(company);
  const normLoc = normalizeText(location);
  const raw = `${normTitle}::${normCompany}::${normLoc}::${primaryType.toLowerCase()}`;
  return crypto.createHash('md5').update(raw).digest('hex');
}

/**
 * Generates a stable source-specific deduplication key.
 * Prefers source + sourceId when available.
 * Falls back to source + cleaned URL.
 *
 * @param {string} source
 * @param {string} sourceId
 * @param {string} title
 * @param {string} company
 * @param {string} applyUrl
 * @returns {string}
 */
function generateDeduplicationKey(source, sourceId, title, company, applyUrl) {
  const s = (source || 'manual').trim();

  // If explicit sourceId exists
  if (sourceId && String(sourceId).trim().length > 0) {
    return `${s}::${String(sourceId).trim()}`;
  }

  // Fallback to cleaned URL
  const cleanedUrl = cleanUrl(applyUrl);
  if (cleanedUrl) {
    return `${s}::${cleanedUrl}`;
  }

  // Fallback: hash normalized title+company
  const raw = `${normalizeText(title)}|${normalizeText(company)}`;
  return `${s}::hash_${crypto.createHash('md5').update(raw).digest('hex')}`;
}

/**
 * Deduplicates an array of job objects in-memory.
 * Removes duplicate records within the current fetch batch.
 *
 * @param {Object[]} jobs
 * @returns {Object[]} unique jobs
 */
function deduplicateInMemory(jobs) {
  const seenKeys = new Set();
  const seenFingerprints = new Set();
  const unique = [];

  for (const job of jobs) {
    const key = job.deduplicationKey || generateDeduplicationKey(
      job.source, job.sourceId, job.title, job.company, job.sourceUrl || job.applyUrl
    );
    job.deduplicationKey = key;

    const fp = job.normalizedFingerprint || generateFingerprint(
      job.title, job.company, job.location, job.primaryType
    );
    job.normalizedFingerprint = fp;

    // Check if key was already seen in this batch
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      seenFingerprints.add(fp);
      unique.push(job);
    }
  }

  return unique;
}

/**
 * Filters out jobs that already exist in the database by deduplicationKey.
 * @param {Object[]} newJobs - freshly fetched jobs
 * @param {string[]} existingKeys - deduplicationKey values already in DB
 * @returns {{ toInsert: Object[], duplicateCount: number }}
 */
function filterAgainstDB(newJobs, existingKeys) {
  const existingSet = new Set(existingKeys);
  const toInsert = [];
  let duplicateCount = 0;

  for (const job of newJobs) {
    if (existingSet.has(job.deduplicationKey)) {
      duplicateCount++;
    } else {
      toInsert.push(job);
    }
  }

  return { toInsert, duplicateCount };
}

module.exports = {
  cleanUrl,
  normalizeText,
  generateFingerprint,
  generateDeduplicationKey,
  deduplicateInMemory,
  filterAgainstDB
};
