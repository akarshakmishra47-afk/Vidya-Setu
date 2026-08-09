/**
 * deduplicator.js
 * Multi-level deduplication for job records.
 * Ensures no duplicate listings appear within or across sources.
 */

const crypto = require('crypto');

/**
 * Generates a stable deduplication key.
 * Prefers source+sourceId when available.
 * Falls back to a hash of normalized title+company+url.
 *
 * @param {string} source
 * @param {string} sourceId
 * @param {string} title
 * @param {string} company
 * @param {string} applyUrl
 * @returns {string}
 */
function generateDeduplicationKey(source, sourceId, title, company, applyUrl) {
  // Prefer source+sourceId (most stable)
  if (source && sourceId && sourceId.trim().length > 0) {
    return `${source}::${sourceId.trim()}`;
  }

  // Fallback: normalize and hash title+company+url
  const normalizedTitle   = (title   || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const normalizedCompany = (company || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const normalizedUrl     = (applyUrl || '').toLowerCase().replace(/[?#].*$/, '').trim(); // strip query/hash

  const raw = `${normalizedTitle}|${normalizedCompany}|${normalizedUrl}`;
  return `hash::${crypto.createHash('md5').update(raw).digest('hex')}`;
}

/**
 * Deduplicates an array of job objects in-memory.
 * Removes duplicates within the array itself.
 *
 * @param {Object[]} jobs
 * @returns {Object[]} unique jobs
 */
function deduplicateInMemory(jobs) {
  const seen = new Set();
  const unique = [];

  for (const job of jobs) {
    const key = job.deduplicationKey || generateDeduplicationKey(
      job.source, job.sourceId, job.title, job.company, job.applyUrl
    );

    if (!seen.has(key)) {
      seen.add(key);
      // Ensure the job has the key set
      job.deduplicationKey = key;
      unique.push(job);
    }
  }

  return unique;
}

/**
 * Filters out jobs that already exist in the database by deduplicationKey.
 *
 * @param {Object[]} newJobs - freshly fetched, in-memory deduplicated jobs
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

module.exports = { generateDeduplicationKey, deduplicateInMemory, filterAgainstDB };
