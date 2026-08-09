/**
 * jobFetcher.js
 * Main orchestrator for the Vidya-Setu Jobs & Internships module.
 *
 * Calls all configured source adapters in parallel.
 * Normalizes, validates, deduplicates, and returns results.
 * Handles source failures gracefully — one failing source never breaks others.
 *
 * NO DUMMY DATA. NO FALLBACK FAKE JOBS. REAL DATA ONLY.
 * If all sources fail, returns { jobs: [], stats: {...} } honestly.
 */

const { fetchRemotiveJobs }   = require('./sources/private/remotiveAdapter');
const { fetchArbeitnowJobs }  = require('./sources/private/arbeitnowAdapter');
const { fetchHimalayasJobs }  = require('./sources/private/himalayasAdapter');
const { fetchGovtJobsRss }    = require('./sources/government/govtJobsRss');
const { fetchHackathons }     = require('./sources/hackathons/hackathonAdapter');
const { fetchGreenhouseJobs } = require('./sources/private/greenhouseAdapter');
const { fetchLeverJobs }      = require('./sources/private/leverAdapter');
const { validateJob }         = require('./utils/jobValidator');
const { deduplicateInMemory } = require('./utils/deduplicator');

// ── Configuration ─────────────────────────────────────────────────────────────
const AUTO_REFRESH_MS = Number(process.env.JOBS_REFRESH_MS) || (60 * 60 * 1000); // 60 minutes

// ── Refresh State (module-level singletons) ────────────────────────────────────
let _isRefreshing   = false;
let _lastRefreshTime  = null;
let _lastRefreshError = null;

function isRefreshing()        { return _isRefreshing; }
function setRefreshing(v)      { _isRefreshing = v; }
function getLastRefreshTime()  { return _lastRefreshTime; }
function setLastRefreshTime(t) { _lastRefreshTime = t; }
function getLastRefreshError() { return _lastRefreshError; }
function setLastRefreshError(e){ _lastRefreshError = e; }

// ── Main Fetch Function ────────────────────────────────────────────────────────

/**
 * Fetches jobs from all configured sources in parallel.
 * Each source failure is isolated — other sources continue working.
 *
 * @returns {Promise<{
 *   jobs: Object[],
 *   stats: Object,
 *   sourceStats: Object
 * }>}
 */
async function fetchLatestJobs() {
  console.log('\n🚀 [JobFetcher] Starting full fetch cycle from all sources...\n');

  const startTime = Date.now();

  // Run all sources in parallel; each catches its own errors
  const [
    remotiveResult,
    arbeitnowResult,
    himalayasResult,
    govtRssResult,
    hackathonResult,
    greenhouseResult,
    leverResult
  ] = await Promise.all([
    fetchRemotiveJobs().catch(err => ({ jobs: [], stats: { fetched: 0, accepted: 0, rejected: 0, duplicates: 0, error: err.message } })),
    fetchArbeitnowJobs().catch(err => ({ jobs: [], stats: { fetched: 0, accepted: 0, rejected: 0, duplicates: 0, error: err.message } })),
    fetchHimalayasJobs().catch(err => ({ jobs: [], stats: { fetched: 0, accepted: 0, rejected: 0, duplicates: 0, error: err.message } })),
    fetchGovtJobsRss().catch(err   => ({ jobs: [], stats: { fetched: 0, accepted: 0, rejected: 0, duplicates: 0, error: err.message } })),
    fetchHackathons().catch(err    => ({ jobs: [], stats: { fetched: 0, accepted: 0, rejected: 0, duplicates: 0, error: err.message } })),
    fetchGreenhouseJobs().catch(err => ({ jobs: [], stats: { fetched: 0, accepted: 0, rejected: 0, duplicates: 0, error: err.message } })),
    fetchLeverJobs().catch(err      => ({ jobs: [], stats: { fetched: 0, accepted: 0, rejected: 0, duplicates: 0, error: err.message } }))
  ]);

  const sourceStats = {
    remotive:   remotiveResult.stats,
    arbeitnow:  arbeitnowResult.stats,
    himalayas:  himalayasResult.stats,
    govtRss:    govtRssResult.stats,
    hackathons: hackathonResult.stats,
    greenhouse: greenhouseResult.stats,
    lever:      leverResult.stats
  };

  // Log per-source summary
  console.log('\n📊 [JobFetcher] Source Results:');
  for (const [name, s] of Object.entries(sourceStats)) {
    const status = s.error ? `❌ ERROR: ${s.error}` : `✅ OK`;
    console.log(`  ${name}: fetched=${s.fetched} accepted=${s.accepted} rejected=${s.rejected} [${status}]`);
  }

  // Merge all jobs
  const allJobs = [
    ...remotiveResult.jobs,
    ...arbeitnowResult.jobs,
    ...himalayasResult.jobs,
    ...govtRssResult.jobs,
    ...hackathonResult.jobs,
    ...greenhouseResult.jobs,
    ...leverResult.jobs
  ];

  console.log(`\n📦 [JobFetcher] Total raw jobs from all sources: ${allJobs.length}`);

  // Validate all jobs
  const validJobs = [];
  let validationRejections = 0;

  for (const job of allJobs) {
    const { valid, reasons } = validateJob(job);
    if (valid) {
      validJobs.push(job);
    } else {
      validationRejections++;
      // Only log first 10 validation failures to avoid log spam
      if (validationRejections <= 10) {
        console.warn(`[JobFetcher] Validation rejected: ${job.title || 'untitled'} — ${reasons.join('; ')}`);
      }
    }
  }

  console.log(`✅ [JobFetcher] After validation: ${validJobs.length} valid (${validationRejections} rejected)`);

  // Deduplicate in-memory across all sources
  const uniqueJobs = deduplicateInMemory(validJobs);
  const inMemoryDuplicates = validJobs.length - uniqueJobs.length;

  console.log(`🔄 [JobFetcher] After deduplication: ${uniqueJobs.length} unique (${inMemoryDuplicates} duplicates removed)`);

  const elapsed = Date.now() - startTime;
  console.log(`⏱️  [JobFetcher] Fetch cycle complete in ${elapsed}ms\n`);

  const aggregateStats = {
    totalFetched: allJobs.length,
    totalValid: validJobs.length,
    totalUnique: uniqueJobs.length,
    validationRejected: validationRejections,
    inMemoryDuplicates,
    elapsed
  };

  return { jobs: uniqueJobs, stats: aggregateStats, sourceStats };
}

module.exports = {
  fetchLatestJobs,
  isRefreshing,
  setRefreshing,
  getLastRefreshTime,
  setLastRefreshTime,
  getLastRefreshError,
  setLastRefreshError,
  AUTO_REFRESH_MS
};
