/**
 * jobRoutes.js
 * Express router for Jobs, Internships & Hackathons API endpoints.
 *
 * Endpoints:
 *   GET  /api/jobs              - List jobs with filters/search/pagination
 *   GET  /api/jobs/status       - Refresh status + live counters
 *   GET  /api/jobs/stats        - Live category counters for UI
 *   POST /api/jobs/fetch-latest - Trigger manual refresh
 *   POST /api/jobs/refresh      - Alias for fetch-latest
 *   POST /api/jobs              - Create manual job (admin)
 *   GET  /api/jobs/:id          - Get single job
 *   DELETE /api/jobs/:id        - Delete job (admin)
 */

const express = require('express');
const Job     = require('../models/Job');
const {
  fetchLatestJobs,
  isRefreshing,
  setRefreshing,
  getLastRefreshTime,
  setLastRefreshTime,
  getLastRefreshError,
  setLastRefreshError,
  AUTO_REFRESH_MS
} = require('../services/jobs/jobFetcher');
const { filterAgainstDB } = require('../services/jobs/utils/deduplicator');

const router = express.Router();

// ── AUTO-REFRESH STATE ────────────────────────────────────────────────────────
let refreshInterval       = null;
let isAutoRefreshRunning  = false;

// ── SOURCE NAMES (for stale cleanup — only clean sources that responded) ──────
const API_SOURCES = ['remotive', 'arbeitnow', 'himalayas', 'govtRss', 'hackathon'];

// ── UTILITY: Perform job refresh ─────────────────────────────────────────────
async function performJobRefresh() {
  if (isRefreshing()) {
    return { status: 'skipped', reason: 'Refresh already in progress' };
  }

  setRefreshing(true);
  console.log('\n🔄 [JobRoutes] Refresh started...');

  try {
    // 1. Fetch from all sources
    const { jobs: freshJobs, stats: aggStats, sourceStats } = await fetchLatestJobs();

    if (!freshJobs || freshJobs.length === 0) {
      console.log('⚠️  [JobRoutes] No jobs returned from any source');
      setLastRefreshError('No jobs returned from any source');
      setRefreshing(false);
      return {
        status: 'warning',
        message: 'No new jobs found from any source',
        jobsAdded: 0,
        duplicates: 0,
        rejected: 0,
        staleRemoved: 0,
        sources: sourceStats,
        aggregate: aggStats
      };
    }

    // 2. Load existing deduplication keys from DB (for sources that responded)
    const respondedSources = API_SOURCES.filter(s => {
      const ss = sourceStats[s];
      return ss && !ss.error && ss.fetched > 0;
    });

    const existingKeys = await Job.distinct('deduplicationKey', {
      source: { $in: respondedSources }
    });

    // 3. Filter out DB duplicates
    const { toInsert, duplicateCount } = filterAgainstDB(freshJobs, existingKeys);
    console.log(`[JobRoutes] DB duplicates filtered: ${duplicateCount} | To insert: ${toInsert.length}`);

    // 4. Insert new jobs
    let inserted = 0;
    if (toInsert.length > 0) {
      try {
        const result = await Job.insertMany(toInsert, { ordered: false });
        inserted = result.length;
        console.log(`✅ [JobRoutes] Inserted ${inserted} new jobs`);
      } catch (err) {
        // ordered: false means partial inserts succeed despite duplicates
        if (err.result && err.result.nInserted !== undefined) {
          inserted = err.result.nInserted;
          console.log(`✅ [JobRoutes] Inserted ${inserted} jobs (some duplicates skipped by DB index)`);
        } else {
          console.warn(`⚠️  [JobRoutes] Insert warning: ${err.message}`);
        }
      }
    }

    // 5. For sources that responded with 0 records and no error,
    //    optionally clean stale records older than 7 days.
    //    IMPORTANT: Only clean if source responded successfully (no error).
    let staleRemoved = 0;
    for (const s of respondedSources) {
      const ss = sourceStats[s];
      if (ss && !ss.error && ss.accepted === 0) {
        // Source responded but found 0 India jobs — remove records older than 7 days
        const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const res = await Job.deleteMany({
          source: s,
          createdAt: { $lt: cutoff }
        });
        staleRemoved += res.deletedCount;
        if (res.deletedCount > 0) {
          console.log(`🗑️  [JobRoutes] Removed ${res.deletedCount} stale ${s} jobs`);
        }
      }
    }

    // 6. Live counts from DB
    const dbStats = await getLiveCounts();

    setLastRefreshTime(new Date());
    setLastRefreshError(null);
    setRefreshing(false);

    return {
      status: 'success',
      message: `Added ${inserted} new real India opportunities`,
      jobsAdded: inserted,
      duplicates: duplicateCount + aggStats.inMemoryDuplicates,
      rejected: aggStats.validationRejected,
      staleRemoved,
      sources: sourceStats,
      aggregate: aggStats,
      dbStats
    };

  } catch (err) {
    console.error(`❌ [JobRoutes] Refresh error: ${err.message}`);
    setLastRefreshError(err.message);
    setRefreshing(false);
    throw err;
  }
}

// ── UTILITY: Get live counts from DB ─────────────────────────────────────────
async function getLiveCounts() {
  const [
    total, internships, jobs, hackathons,
    paidInternships, freeInternships, unknownInternships,
    govtJobs, privateJobs, itJobs, engineeringJobs, fresherJobs,
    productJobs, serviceJobs,
    remotiveCount, arbeitnowCount, himalayasCount, govtRssCount
  ] = await Promise.all([
    Job.countDocuments(),
    Job.countDocuments({ primaryType: 'Internship' }),
    Job.countDocuments({ primaryType: 'Job' }),
    Job.countDocuments({ primaryType: 'Hackathon' }),
    Job.countDocuments({ primaryType: 'Internship', secondaryType: 'Paid' }),
    Job.countDocuments({ primaryType: 'Internship', secondaryType: 'Free' }),
    Job.countDocuments({ primaryType: 'Internship', secondaryType: 'Unknown' }),
    Job.countDocuments({ category: 'Government' }),
    Job.countDocuments({ category: 'Private' }),
    Job.countDocuments({ category: 'IT' }),
    Job.countDocuments({ category: 'Engineering' }),
    Job.countDocuments({ category: 'Fresher' }),
    Job.countDocuments({ companyType: 'product' }),
    Job.countDocuments({ companyType: 'service' }),
    Job.countDocuments({ source: 'remotive' }),
    Job.countDocuments({ source: 'arbeitnow' }),
    Job.countDocuments({ source: 'himalayas' }),
    Job.countDocuments({ source: 'govtRss' })
  ]);

  return {
    total, internships, jobs, hackathons,
    paidInternships, freeInternships, unknownInternships,
    govtJobs, privateJobs, itJobs, engineeringJobs, fresherJobs,
    productJobs, serviceJobs,
    sources: { remotive: remotiveCount, arbeitnow: arbeitnowCount, himalayas: himalayasCount, govtRss: govtRssCount }
  };
}

// ── START / STOP AUTO-REFRESH ─────────────────────────────────────────────────
function startAutoRefresh() {
  if (isAutoRefreshRunning) return;
  isAutoRefreshRunning = true;
  console.log(`⏰ [AutoRefresh] Enabled — interval: ${AUTO_REFRESH_MS / 60000} minutes`);

  // Immediate first fetch
  performJobRefresh().catch(err => console.error('[AutoRefresh] Initial fetch error:', err.message));

  refreshInterval = setInterval(() => {
    console.log('⏱️  [AutoRefresh] Interval triggered');
    performJobRefresh().catch(err => console.error('[AutoRefresh] Error:', err.message));
  }, AUTO_REFRESH_MS);
}

function stopAutoRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
    isAutoRefreshRunning = false;
    console.log('⏹️  [AutoRefresh] Stopped');
  }
}

function initializeJobRefresh() {
  startAutoRefresh();
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// ── GET /api/jobs — List with filters, search, pagination ─────────────────────
router.get('/', async (req, res) => {
  try {
    const filter = { isIndiaLocation: { $ne: false } };

    // Primary type filter
    if (req.query.type) {
      const t = req.query.type;
      filter.primaryType = t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
    }

    // Category filter (Government, Private, IT, Engineering, Internship, Hackathon, Fresher)
    if (req.query.category) {
      filter.category = req.query.category;
    }

    // Branch filter
    if (req.query.branch) filter.branch = req.query.branch;

    // Company type filter
    if (req.query.companyType) filter.companyType = req.query.companyType;

    // Experience level filter
    if (req.query.experienceLevel) filter.experienceLevel = req.query.experienceLevel;

    // Secondary type filter (Paid/Free/Unknown for internships)
    if (req.query.secondaryType) filter.secondaryType = req.query.secondaryType;

    // Source filter
    if (req.query.source) filter.source = req.query.source;

    // India only (redundant with default but explicit)
    if (req.query.indiaOnly === 'true') filter.isIndiaLocation = true;

    // Government category
    if (req.query.govtCategory) filter.govtCategory = req.query.govtCategory;

    // Location filter (city-based)
    if (req.query.location && req.query.location !== 'All India') {
      if (req.query.location === 'Remote') {
        filter.location = { $regex: /remote/i };
      } else {
        filter.location = { $regex: new RegExp(req.query.location, 'i') };
      }
    }

    // Search: title, company, desc, tags, branch, location
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search.substring(0, 100), 'i');
      filter.$or = [
        { title:    searchRegex },
        { company:  searchRegex },
        { location: searchRegex },
        { desc:     searchRegex },
        { tags:     searchRegex },
        { branch:   searchRegex }
      ];
    }

    // Pagination
    const limit  = Math.min(parseInt(req.query.limit)  || 100, 500);
    const offset = parseInt(req.query.offset) || 0;

    // Sort by postedAt DESC, then createdAt DESC
    const jobs = await Job.find(filter)
      .sort({ postedAt: -1, createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean();

    const total = await Job.countDocuments(filter);

    res.json({ success: true, count: jobs.length, total, jobs });
  } catch (err) {
    console.error('[GET /api/jobs] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch jobs', details: err.message });
  }
});

// ── GET /api/jobs/stats — Live category counters ──────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const counts = await getLiveCounts();
    res.json({ success: true, ...counts });
  } catch (err) {
    console.error('[GET /api/jobs/stats] Error:', err.message);
    res.status(500).json({ error: 'Failed to get stats', details: err.message });
  }
});

// ── GET /api/jobs/status — Refresh status + DB stats ─────────────────────────
router.get('/status', async (req, res) => {
  try {
    const counts = await getLiveCounts();
    res.json({
      success: true,
      stats: counts,
      refresh: {
        isRunning:      isRefreshing(),
        lastRefreshTime: getLastRefreshTime(),
        lastError:       getLastRefreshError()
      },
      autoRefresh: {
        enabled:        isAutoRefreshRunning,
        intervalMinutes: AUTO_REFRESH_MS / 60000
      }
    });
  } catch (err) {
    console.error('[GET /api/jobs/status] Error:', err.message);
    res.status(500).json({ error: 'Failed to get status', details: err.message });
  }
});

// ── POST /api/jobs/fetch-latest — Trigger manual refresh ─────────────────────
router.post('/fetch-latest', async (req, res) => {
  try {
    if (isRefreshing()) {
      return res.status(429).json({
        success: false,
        error: 'Refresh already in progress. Please wait.'
      });
    }

    console.log('[POST /api/jobs/fetch-latest] Manual refresh triggered');
    const result = await performJobRefresh();

    res.json({
      success: result.status !== 'error',
      ...result
    });
  } catch (err) {
    console.error('[POST /api/jobs/fetch-latest] Error:', err.message);
    res.status(500).json({ success: false, error: 'Refresh failed', details: err.message });
  }
});

// ── POST /api/jobs/refresh — Alias ───────────────────────────────────────────
router.post('/refresh', async (req, res) => {
  try {
    if (isRefreshing()) {
      return res.status(429).json({ success: false, error: 'Refresh already in progress.' });
    }
    const result = await performJobRefresh();
    res.json({ success: result.status !== 'error', ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Refresh failed', details: err.message });
  }
});

// ── POST /api/jobs — Create manual job (admin) ────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const jobData = { ...req.body, source: 'manual' };
    if (!jobData.deduplicationKey) {
      jobData.deduplicationKey = `manual::${Date.now()}::${Math.random().toString(36).slice(2)}`;
    }
    const job = new Job(jobData);
    await job.save();
    res.status(201).json({ success: true, job });
  } catch (err) {
    res.status(400).json({ error: 'Failed to create job', details: err.message });
  }
});

// ── GET /api/jobs/:id — Single job ────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const job = await Job.findById(req.params.id).lean();
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json({ success: true, job });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch job', details: err.message });
  }
});

// ── DELETE /api/jobs/:id — Delete job (admin) ─────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Job.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Job not found' });
    res.json({ success: true, message: 'Job deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete job', details: err.message });
  }
});

// ── LEGACY: /api/jobs/stats/summary ──────────────────────────────────────────
router.get('/stats/summary', async (req, res) => {
  try {
    const counts = await getLiveCounts();
    res.json(counts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// ── EXPORTS ───────────────────────────────────────────────────────────────────
module.exports = router;
module.exports.initializeJobRefresh = initializeJobRefresh;
module.exports.stopAutoRefresh = stopAutoRefresh;
