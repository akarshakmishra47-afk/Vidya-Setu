/**
 * jobFetcher.js
 * Main orchestrator for the Vidya-Setu Jobs & Internships module.
 */

const { fetchRemotiveJobs }   = require('./sources/private/remotiveAdapter');
const { fetchArbeitnowJobs }  = require('./sources/private/arbeitnowAdapter');
const { fetchGovtJobsRss }    = require('./sources/government/govtJobsRss');
const { fetchHackathons }     = require('./sources/hackathons/hackathonAdapter');
const { fetchGreenhouseJobs } = require('./sources/private/greenhouseAdapter');
const { fetchLeverJobs }      = require('./sources/private/leverAdapter');
// New Adapters
const { fetchInternshalaJobs } = require('./sources/private/internshalaAdapter');
const { fetchLinkedInJobs }    = require('./sources/private/linkedinAdapter');
const { fetchUnstopJobs, fetchUnstopHackathons } = require('./sources/private/unstopAdapter');
const { fetchIndeedJobs }      = require('./sources/private/indeedAdapter');
const { fetchNaukriJobs }      = require('./sources/private/naukriAdapter');
const { fetchWellfoundJobs }   = require('./sources/private/wellfoundAdapter');
const { fetchAicteJobs }       = require('./sources/private/aicteAdapter');

const { validateJob }         = require('./utils/jobValidator');
const Job = require('../../models/Job');

const AUTO_REFRESH_MS = 24 * 60 * 60 * 1000; // Exactly 24 hours

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

async function fetchLatestJobs() {
  console.log('\n🚀 [JobFetcher] Starting full fetch cycle from all sources...\n');
  const startTime = Date.now();

  const [
    remotiveResult, hackathonResult,
    internshalaResult, linkedinResult, unstopResult, unstopHackathonsResult,
    indeedResult, naukriResult, wellfoundResult, aicteResult
  ] = await Promise.all([
    fetchRemotiveJobs().catch(e => ({ jobs: [], stats: { error: e.message, status: 'Unavailable' } })),
    fetchHackathons().catch(e    => ({ jobs: [], stats: { error: e.message, status: 'Unavailable' } })),
    fetchInternshalaJobs().catch(e=> ({ jobs: [], stats: { error: e.message, status: 'Unavailable' } })),
    fetchLinkedInJobs().catch(e   => ({ jobs: [], stats: { error: e.message, status: 'Unavailable' } })),
    fetchUnstopJobs().catch(e     => ({ jobs: [], stats: { error: e.message, status: 'Unavailable' } })),
    fetchUnstopHackathons().catch(e => ({ jobs: [], stats: { error: e.message, status: 'Unavailable' } })),
    fetchIndeedJobs().catch(e     => ({ jobs: [], stats: { error: e.message, status: 'Unavailable' } })),
    fetchNaukriJobs().catch(e     => ({ jobs: [], stats: { error: e.message, status: 'Unavailable' } })),
    fetchWellfoundJobs().catch(e  => ({ jobs: [], stats: { error: e.message, status: 'Unavailable' } })),
    fetchAicteJobs().catch(e      => ({ jobs: [], stats: { error: e.message, status: 'Unavailable' } }))
  ]);

  const results = {
    remotive: remotiveResult,
    hackathon: hackathonResult, internshala: internshalaResult, linkedin: linkedinResult, 
    'Unstop Jobs/Internships': unstopResult, 'Unstop Hackathons': unstopHackathonsResult,
    indeed: indeedResult, naukri: naukriResult, 
    wellfound: wellfoundResult, aicte: aicteResult
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
      accepted: stats.accepted || 0,
      rejected: stats.rejected || 0,
      inserted: 0,
      updated: 0,
      reactivated: 0,
      deactivated: 0,
      error: stats.error || null,
      lastSuccessfulSync: !stats.error ? new Date() : null
    };

    if (sourceStats[sourceName].status === 'Working') {
      const activeKeys = new Set();
      const currentFetchTime = new Date();

      for (const job of jobs) {
        // Validate URL requirement: must have sourceUrl (or applyUrl fallback handled inside adapter, but prefer sourceUrl)
        if (!job.sourceUrl && !job.applyUrl) {
          sourceStats[sourceName].rejected++;
          continue;
        }
        
        // Reject jobs that are already expired before they even enter the DB
        if (job.deadline && job.deadline !== 'Not specified' && new Date(job.deadline) < currentFetchTime) {
          sourceStats[sourceName].rejected++;
          continue;
        }

        const dedupKey = job.deduplicationKey || `${job.source}::${job.sourceUrl || job.applyUrl}`;
        activeKeys.add(dedupKey);

        const jobData = {
          ...job,
          isActive: true,
          fetchedAt: new Date()
        };

        const existing = await Job.findOne({ deduplicationKey: dedupKey });
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

      // Source-Safe Deactivation: deactivate any jobs from THIS source that are currently active in DB but missing from this fetch
      const activeKeysArray = Array.from(activeKeys);
      
      let deactivationFilter = { source: jobSourceMap(sourceName), isActive: true, deduplicationKey: { $nin: activeKeysArray } };

      if (sourceName === 'Unstop Jobs/Internships') {
        deactivationFilter.primaryType = { $in: ['Job', 'Internship'] };
      } else if (sourceName === 'Unstop Hackathons') {
        deactivationFilter.primaryType = 'Hackathon';
      }

      // Hard-delete stale jobs instead of marking them inactive
      const staleResult = await Job.deleteMany(deactivationFilter);
      sourceStats[sourceName].deactivated = staleResult.deletedCount;
      totalDeactivated += staleResult.deletedCount;
    }
  }

  // Handle Expiry
  const now = new Date();
  const allActiveWithDeadline = await Job.find({ deadline: { $ne: 'Not specified' } });
  let expiredCount = 0;
  for (const j of allActiveWithDeadline) {
    if (new Date(j.deadline) < now) {
      await Job.deleteOne({ _id: j._id });
      expiredCount++;
    }
  }
  if (expiredCount > 0) {
    console.log(`[JobFetcher] Auto-expired ${expiredCount} past-deadline jobs/internships.`);
  }

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
  // maps our results key to the DB source enum
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
