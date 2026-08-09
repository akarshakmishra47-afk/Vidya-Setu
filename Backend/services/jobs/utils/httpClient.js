/**
 * httpClient.js
 * Shared HTTP client with timeout, retry, and error handling.
 * Used by all source adapters.
 */

const https = require('https');
const http  = require('http');

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_RETRIES    = 2;
const RETRY_DELAY_MS     = 1500;

/**
 * Performs a GET request with timeout and retry logic.
 * @param {string} url
 * @param {Object} options
 * @param {number} [options.timeout] - ms
 * @param {number} [options.retries]
 * @param {Object} [options.headers]
 * @returns {Promise<string>} raw response body
 */
function httpGet(url, options = {}) {
  const timeout = options.timeout || DEFAULT_TIMEOUT_MS;
  const retries = options.retries !== undefined ? options.retries : DEFAULT_RETRIES;
  const headers = {
    'User-Agent': 'Mozilla/5.0 (compatible; VidyaSetu-JobBot/1.0; +https://vidyasetu.app)',
    'Accept': 'application/json, application/xml, text/xml, text/plain, */*',
    ...( options.headers || {})
  };

  return new Promise((resolve, reject) => {
    let attempt = 0;

    function makeAttempt() {
      const client = url.startsWith('https://') ? https : http;

      const req = client.get(url, { headers }, (res) => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          if (res.statusCode === 429) {
            const err = new Error(`Rate limited (HTTP 429)`);
            err.statusCode = 429;
            return tryRetry(err);
          }
          if (res.statusCode >= 400) {
            const err = new Error(`HTTP ${res.statusCode}`);
            err.statusCode = res.statusCode;
            return tryRetry(err);
          }
          resolve(body);
        });
        res.on('error', tryRetry);
      });

      req.setTimeout(timeout, () => {
        req.destroy();
        tryRetry(new Error(`Timeout after ${timeout}ms`));
      });

      req.on('error', tryRetry);
    }

    function tryRetry(err) {
      if (attempt < retries) {
        attempt++;
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        setTimeout(makeAttempt, delay);
      } else {
        reject(err);
      }
    }

    makeAttempt();
  });
}

/**
 * Parses JSON safely, returns null on failure.
 * @param {string} text
 * @returns {Object|null}
 */
function safeParseJson(text) {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (trimmed.startsWith('<')) return null; // HTML response
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

module.exports = { httpGet, safeParseJson };
