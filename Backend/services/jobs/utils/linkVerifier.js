/**
 * linkVerifier.js
 * Non-blocking background link liveness checker for jobs, internships, and hackathons.
 *
 * Verifies application and source URLs:
 * - 200..399 -> 'healthy'
 * - 404, 410  -> 'broken' (marks record inactive)
 * - 403, 429, Cloudflare -> 'suspicious' (NOT deleted / NOT deactivated)
 * - Timeout / Network error -> 'unchecked' (NOT deleted)
 */

const axios = require('axios');
const Job = require('../../../models/Job');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Checks a single URL with polite headers and short timeout.
 * Uses HEAD first, falling back to GET with stream destroy.
 * @param {string} url - Target URL.
 * @returns {Promise<{ linkStatus: string, statusCode: number|null, error: string|null }>}
 */
async function verifyUrl(url) {
  if (!url || typeof url !== 'string' || (!url.startsWith('http://') && !url.startsWith('https://'))) {
    return { linkStatus: 'broken', statusCode: null, error: 'Invalid URL format' };
  }

  const client = axios.create({
    timeout: 8000,
    maxRedirects: 5,
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    },
    validateStatus: () => true // Handle status codes manually
  });

  try {
    // Attempt HEAD request first to save bandwidth
    let res;
    try {
      res = await client.head(url);
    } catch (headErr) {
      // Some servers block HEAD; fallback to GET
      res = await client.get(url, { responseType: 'stream' });
      if (res.data && typeof res.data.destroy === 'function') {
        res.data.destroy(); // Abort reading body
      }
    }

    const code = res.status;

    // Healthy (2xx, 3xx)
    if (code >= 200 && code < 400) {
      return { linkStatus: 'healthy', statusCode: code, error: null };
    }

    // Confirmed Dead (404 Not Found, 410 Gone)
    if (code === 404 || code === 410) {
      return { linkStatus: 'broken', statusCode: code, error: `HTTP ${code}` };
    }

    // Authwalls, Captchas, or Rate Limits (401, 403, 429) -> Suspicious but NOT dead
    if (code === 401 || code === 403 || code === 429) {
      return { linkStatus: 'suspicious', statusCode: code, error: `Protected by HTTP ${code}` };
    }

    // 5xx Server errors -> Temporary, keep active
    if (code >= 500) {
      return { linkStatus: 'unchecked', statusCode: code, error: `Server error HTTP ${code}` };
    }

    return { linkStatus: 'unchecked', statusCode: code, error: `Unexpected status HTTP ${code}` };

  } catch (err) {
    // Check error code
    const msg = err.message || '';
    if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
      return { linkStatus: 'broken', statusCode: null, error: err.code };
    }
    // Timeout or reset -> Keep unchecked so we never delete valid opportunities prematurely
    return { linkStatus: 'unchecked', statusCode: null, error: msg.substring(0, 80) };
  }
}

/**
 * Checks a batch of jobs in the background without blocking user requests.
 * @param {number} [batchSize=10]
 * @returns {Promise<{ checked: number, healthy: number, broken: number, suspicious: number }>}
 */
async function verifyJobLinksBatch(batchSize = 10) {
  const stats = { checked: 0, healthy: 0, broken: 0, suspicious: 0 };

  try {
    // Find active jobs that have not been checked recently (e.g. unchecked or > 3 days old)
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const jobs = await Job.find({
      isActive: true,
      $or: [
        { linkStatus: 'unchecked' },
        { lastLinkCheckedAt: null },
        { lastLinkCheckedAt: { $lt: threeDaysAgo } }
      ]
    })
      .limit(batchSize)
      .lean();

    if (!jobs || jobs.length === 0) return stats;

    for (const job of jobs) {
      const targetUrl = job.applyUrl || job.sourceUrl;
      const result = await verifyUrl(targetUrl);
      stats.checked++;

      const updateData = {
        lastLinkCheckedAt: new Date(),
        linkStatus: result.linkStatus,
        linkCheckError: result.error
      };

      if (result.linkStatus === 'healthy') {
        stats.healthy++;
      } else if (result.linkStatus === 'broken') {
        stats.broken++;
        // Confirmed dead link -> mark inactive
        updateData.isActive = false;
        console.log(`[LinkVerifier] ❌ Deactivated dead job: "${job.title}" (${result.error})`);
      } else if (result.linkStatus === 'suspicious') {
        stats.suspicious++;
      }

      await Job.updateOne({ _id: job._id }, { $set: updateData });

      // Polite throttle (200ms) between checks
      await new Promise(r => setTimeout(r, 200));
    }
  } catch (err) {
    console.error('[LinkVerifier] Batch error:', err.message);
  }

  return stats;
}

module.exports = {
  verifyUrl,
  verifyJobLinksBatch
};
