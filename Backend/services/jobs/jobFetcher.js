/**
 * jobFetcher.js
 * Main orchestrator for the Vidya-Setu Jobs, Internships & Hackathons module.
 *
 * Implements:
 * - Real validation on every opportunity via validateJob
 * - Deterministic experience and domain classification
 * - Source-safe stale record retention (preserves valid opportunities outside top 50)
 * - Native Date deadline expiration
 * - Zero LLM token ingestion
 * - Background link liveness verification trigger
 */

const { fetchHackathons }     = require('./sources/hackathons/hackathonAdapter');
const { fetchInternshalaJobs } = require('./sources/private/internshalaAdapter');
const { fetchLinkedInJobs }    = require('./sources/private/linkedinAdapter');
const { fetchUnstopJobs, fetchUnstopHackathons } = require('./sources/private/unstopAdapter');
const { fetchIndeedJobs }      = require('./sources/private/indeedAdapter');
const { fetchNaukriJobs }      = require('./sources/private/naukriAdapter');
const { fetchAicteJobs }       = require('./sources/private/aicteAdapter');

const { validateJob }         = require('./utils/jobValidator');
const { evaluateDomain, evaluateHackathon, DOMAINS } = require('./utils/domainEvaluator');
const { verifyJobLinksBatch } = require('./utils/linkVerifier');
const Job = require('../../models/Job');

const AUTO_REFRESH_MS = 24 * 60 * 60 * 1000; // Exactly 24 hours (86,400,000 ms)

let _isRefreshing   = false;
let _lastRefreshTime  = null;
let _lastRefreshError = null;
let _lastSourceStats  = {};

function isRefreshing()        { return _isRefreshing; }
function setRefreshing(v)      { _isRefreshing = v; }
function getLastRefreshTime()  { return _lastRefreshTime; }
function setLastRefreshTime(t) { _lastRefreshTime = t; }
function getLastRefreshError() { return _lastRefreshError; }
function setLastRefreshError(e){ _lastRefreshError = e; }
function getLastSourceStats()  { return _lastSourceStats; }

/**
 * Executes a full ingestion cycle from all active sources.
 * Validates, deduplicates, and synchronizes opportunities into MongoDB.
 * @returns {Promise<{ stats: Object, sourceStats: Object }>}
 */
async function fetchLatestJobs() {
  console.log('\n🚀 [JobFetcher] Starting full fetch cycle from all sources...\n');
  const startTime = Date.now();
  const currentFetchTime = new Date();

  // Run all active adapters concurrently with isolated failure handling
  const [
    hackathonResult, internshalaResult, linkedinResult,
    unstopResult, unstopHackathonsResult, indeedResult,
    naukriResult, aicteResult
  ] = await Promise.all([
    fetchHackathons().catch(e => ({ jobs: [], stats: { error: e.message, status: 'Error' } })),
    fetchInternshalaJobs().catch(e => ({ jobs: [], stats: { error: e.message, status: 'Error' } })),
    fetchLinkedInJobs().catch(e => ({ jobs: [], stats: { error: e.message, status: 'Error' } })),
    fetchUnstopJobs().catch(e => ({ jobs: [], stats: { error: e.message, status: 'Error' } })),
    fetchUnstopHackathons().catch(e => ({ jobs: [], stats: { error: e.message, status: 'Error' } })),
    fetchIndeedJobs().catch(e => ({ jobs: [], stats: { error: e.message, status: 'Unavailable' } })),
    fetchNaukriJobs().catch(e => ({ jobs: [], stats: { error: e.message, status: 'Unavailable' } })),
    fetchAicteJobs().catch(e => ({ jobs: [], stats: { error: e.message, status: 'Unavailable' } }))
  ]);

  const results = {
    hackathon: hackathonResult,
    internshala: internshalaResult,
    linkedin: linkedinResult,
    'Unstop Jobs/Internships': unstopResult,
    'Unstop Hackathons': unstopHackathonsResult,
    indeed: indeedResult,
    naukri: naukriResult,
    aicte: aicteResult
  };

  const sourceStats = {};
  let totalInserted = 0;
  let totalUpdated = 0;
  let totalReactivated = 0;
  let totalDeactivated = 0;

  for (const [sourceName, result] of Object.entries(results)) {
    const jobs = result.jobs || [];
    const stats = result.stats || { error: 'Unknown error', status: 'Failed' };

    sourceStats[sourceName] = {
      status: stats.status || (stats.error ? 'Unavailable' : 'Working'),
      fetched: stats.fetched || 0,
      accepted: 0,
      rejected: stats.rejected || 0,
      inserted: 0,
      updated: 0,
      reactivated: 0,
      deactivated: 0,
      error: stats.error || null,
      lastSuccessfulSync: stats.status === 'Working' ? currentFetchTime : null
    };

    if (sourceStats[sourceName].status === 'Working') {
      const activeKeys = new Set();

      for (const rawJob of jobs) {
        // ── Phase 2: Centralized Validation ──
        const validation = validateJob(rawJob, currentFetchTime);
        if (!validation.valid) {
          sourceStats[sourceName].rejected++;
          continue;
        }

        const job = validation.job;

        // ── Phase 10: Flexible Domain Assignment ──
        if (job.primaryType === 'Hackathon') {
          if (!job.domain || job.domain === 'Unknown' || job.domain === 'Other') {
            const hEval = evaluateHackathon(job.title, job.desc || '', job.tags || []);
            job.domain = hEval.valid ? hEval.domain : 'Competitive Programming';
          }
        } else {
          // Jobs & Internships: evaluate domain if missing
          if (!job.domain || job.domain === 'Unknown') {
            job.domain = evaluateDomain(job.title, job.desc || '', job.tags || []) || 'Software Development';
          }
        }

        // Ensure domain is in the supported enum
        if (!DOMAINS.includes(job.domain)) {
          job.domain = job.primaryType === 'Hackathon' ? 'Competitive Programming' : 'Software Development';
        }

        activeKeys.add(job.deduplicationKey);
        sourceStats[sourceName].accepted++;

        const jobData = {
          ...job,
          isActive: true,
          lastVerifiedAt: currentFetchTime,
          fetchedAt: currentFetchTime
        };

        const existing = await Job.findOne({ deduplicationKey: job.deduplicationKey });
        if (existing) {
          if (!existing.isActive) {
            await Job.updateOne({ _id: existing._id }, { $set: jobData });
            sourceStats[sourceName].reactivated++;
            totalReactivated++;
          } else {
            await Job.updateOne({ _id: existing._id }, { $set: jobData });
            sourceStats[sourceName].updated++;
            totalUpdated++;
          }
        } else {
          await Job.create(jobData);
          sourceStats[sourceName].inserted++;
          totalInserted++;
        }
      }

      // ── Phase 5: Safer Stale-Opportunity Strategy ──
      const activeKeysArray = Array.from(activeKeys);
      const dbSourceName = jobSourceMap(sourceName);

      // Distinguish limited-search scrapers (LinkedIn, Internshala) from full feeds (HackerEarth)
      const isLimitedScraper = ['linkedin', 'internshala'].includes(dbSourceName);

      let staleFilter;
      if (isLimitedScraper) {
        // Only expire/deactivate listings not seen in the top 50 if they haven't been seen for 7+ days,
        // or if their deadline has genuinely passed
        const sevenDaysAgo = new Date(currentFetchTime.getTime() - 7 * 24 * 60 * 60 * 1000);
        staleFilter = {
          source: dbSourceName,
          isActive: true,
          deduplicationKey: { $nin: activeKeysArray },
          $or: [
            { lastVerifiedAt: { $lt: sevenDaysAgo } },
            { deadlineDate: { $ne: null, $lt: currentFetchTime } },
            { linkStatus: 'broken' }
          ]
        };
      } else {
        // For API feeds, deactivate items missing from the active batch
        staleFilter = {
          source: dbSourceName,
          isActive: true,
          deduplicationKey: { $nin: activeKeysArray }
        };

        if (sourceName === 'Unstop Jobs/Internships') {
          staleFilter.primaryType = { $in: ['Job', 'Internship'] };
        } else if (sourceName === 'Unstop Hackathons') {
          staleFilter.primaryType = 'Hackathon';
        }
      }

      const staleResult = await Job.updateMany(staleFilter, { $set: { isActive: false } });
      sourceStats[sourceName].deactivated = staleResult.modifiedCount || 0;
      totalDeactivated += staleResult.modifiedCount || 0;
    }
  }

  // ── Phase 4: Native Date Deadline Expiration ──
  const now = new Date();
  const expiredResult = await Job.updateMany(
    {
      isActive: true,
      deadlineDate: { $ne: null, $lt: now }
    },
    { $set: { isActive: false } }
  );
  const expiredCount = expiredResult.modifiedCount || 0;
  if (expiredCount > 0) {
    console.log(`[JobFetcher] Automatically deactivated ${expiredCount} past-deadline opportunities.`);
  }

  // ── Phase 6: Trigger Background Link Verification Batch ──
  verifyJobLinksBatch(15).then(linkStats => {
    if (linkStats.checked > 0) {
      console.log(`[JobFetcher] Background link audit: checked=${linkStats.checked}, healthy=${linkStats.healthy}, broken=${linkStats.broken}, suspicious=${linkStats.suspicious}`);
    }
  }).catch(e => console.error('[JobFetcher] Link audit error:', e.message));

  const elapsed = Date.now() - startTime;
  console.log(`⏱️  [JobFetcher] Fetch cycle complete in ${elapsed}ms`);

  const aggregateStats = {
    totalInserted,
    totalUpdated,
    totalReactivated,
    totalDeactivated,
    expiredCount,
    elapsed
  };

  // Static templates for disabled / unconfigured sources
  const disabledStatsTemplate = {
    status: 'Disabled', fetched: 0, accepted: 0, rejected: 0,
    inserted: 0, updated: 0, reactivated: 0, deactivated: 0,
    error: 'Legacy source disabled', lastSuccessfulSync: null
  };

  const unavailableStatsTemplate = {
    status: 'Unavailable', fetched: 0, accepted: 0, rejected: 0,
    inserted: 0, updated: 0, reactivated: 0, deactivated: 0,
    error: 'Not currently configured', lastSuccessfulSync: null
  };

  sourceStats['greenhouse'] = { ...disabledStatsTemplate };
  sourceStats['lever'] = { ...disabledStatsTemplate };
  sourceStats['govtRss'] = { ...disabledStatsTemplate };
  sourceStats['manual'] = { ...disabledStatsTemplate };
  sourceStats['web'] = { ...disabledStatsTemplate };
  sourceStats['arbeitnow'] = { ...disabledStatsTemplate };
  sourceStats['himalayas'] = { ...disabledStatsTemplate };
  sourceStats['Jobicy'] = { ...unavailableStatsTemplate };
  sourceStats['The Muse'] = { ...unavailableStatsTemplate };

  _lastSourceStats = sourceStats;
  _lastRefreshTime = new Date();
  return { stats: aggregateStats, sourceStats };
}

function jobSourceMap(name) {
  const map = {
    'hackathon': 'hackathon',
    'Unstop': 'Unstop',
    'Unstop Jobs/Internships': 'Unstop',
    'Unstop Hackathons': 'Unstop',
    'internshala': 'internshala',
    'linkedin': 'linkedin',
    'indeed': 'indeed',
    'naukri': 'naukri',
    'wellfound': 'wellfound',
    'aicte': 'aicte',
    'remotive': 'remotive',
    'arbeitnow': 'arbeitnow',
    'himalayas': 'himalayas',
    'govtRss': 'govtRss',
    'greenhouse': 'greenhouse',
    'lever': 'lever'
  };
  return map[name] || name;
}

module.exports = {
  fetchLatestJobs,
  isRefreshing,
  setRefreshing,
  getLastRefreshTime,
  setLastRefreshTime,
  getLastRefreshError,
  setLastRefreshError,
  getLastSourceStats,
  AUTO_REFRESH_MS
};
