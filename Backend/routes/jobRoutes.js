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
  getLastSourceStats,
  AUTO_REFRESH_MS
} = require('../services/jobs/jobFetcher');

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
    const { stats: aggStats, sourceStats } = await fetchLatestJobs();
    const dbStats = await getLiveCounts();

    setLastRefreshTime(new Date());
    setLastRefreshError(null);
    setRefreshing(false);

    return {
      status: 'success',
      message: `Sync completed. Inserted ${aggStats.totalInserted}, Updated ${aggStats.totalUpdated}, Deactivated ${aggStats.totalDeactivated}`,
      jobsAdded: aggStats.totalInserted,
      aggregate: aggStats,
      sources: sourceStats,
      dbStats
    };

  } catch (err) {
    console.error(`❌ [JobRoutes] Refresh error: ${err.message}`);
    setLastRefreshError(err.message);
    setRefreshing(false);
    throw err;
  }
}

// ── UTILITY: Build Filter from Request ───────────────────────────────────────
function buildJobFilter(query) {
  let filter = { 
    isIndiaLocation: { $ne: false }, 
    isActive: { $ne: false },
    source: { $nin: ['greenhouse', 'lever', 'govtRss', 'manual', 'web', 'arbeitnow'] }
  };

  if (query.primaryType) {
    filter.primaryType = query.primaryType;
  } else if (query.type) {
    const t = query.type;
    filter.primaryType = t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
  }

  if (query.category) filter.category = query.category;
  
  if (query.domain && query.domain !== 'All Domains') {
    filter.domain = query.domain;
  } else if (query.domainGroup === 'it') {
    filter.domain = { $in: ['Software Development', 'Web Development', 'App Development', 'AI/ML', 'Data Science', 'Cyber Security', 'Cloud Computing', 'DevOps', 'Database'] };
  } else if (query.domainGroup === 'engineering') {
    filter.domain = { $in: ['Mechanical Engineering', 'Civil Engineering', 'Electrical Engineering', 'Electronics', 'Embedded Systems'] };
  }

  if (query.branch) filter.branch = query.branch;
  if (query.companyType) filter.companyType = query.companyType;
  if (query.experienceLevel) filter.experienceLevel = query.experienceLevel;
  
  // Paid / Free should only apply if primaryType is Internship
  if (query.secondaryType && filter.primaryType === 'Internship') {
    filter.secondaryType = query.secondaryType;
  }
  
  if (query.source && query.source.toLowerCase() !== 'all') {
    const disabledSources = ['greenhouse', 'lever', 'govtRss', 'manual', 'web', 'arbeitnow'];
    if (disabledSources.includes(query.source.toLowerCase())) {
      filter.source = '__DISABLED__';
    } else {
      filter.source = new RegExp(`^${query.source}$`, 'i');
    }
  }
  
  if (query.indiaOnly === 'true') filter.isIndiaLocation = true;
  if (query.govtCategory) filter.govtCategory = query.govtCategory;
  
  // Location and Work Mode combinations
  let locationConditions = [];
  
  if (query.location && query.location !== 'All India') {
    if (query.location.toLowerCase() === 'remote') {
      locationConditions.push({ location: { $regex: /remote/i } });
    } else {
      locationConditions.push({ location: { $regex: new RegExp(query.location, 'i') } });
    }
  }

  if (query.workMode && query.workMode !== 'All') {
    if (query.workMode === 'Remote') {
      locationConditions.push({ location: { $regex: /remote/i } });
    } else if (query.workMode === 'Hybrid') {
      locationConditions.push({ location: { $regex: /hybrid/i } });
    } else if (query.workMode === 'On-site') {
      locationConditions.push({ location: { $not: /remote|hybrid/i } });
    }
  }

  if (locationConditions.length > 0) {
    if (locationConditions.length === 1) {
      filter.location = locationConditions[0].location;
    } else {
      filter.$and = filter.$and || [];
      filter.$and.push(...locationConditions);
    }
  }

  if (query.excludeGovt === 'true') {
    filter.category = { $ne: 'Government' };
    filter.companyType = { $ne: 'government' };
  }

  if (query.search) {
    const searchRegex = new RegExp(query.search.substring(0, 100), 'i');
    filter.$or = [
      { title:    searchRegex },
      { company:  searchRegex },
      { location: searchRegex },
      { desc:     searchRegex },
      { tags:     searchRegex },
      { branch:   searchRegex },
      { domain:   searchRegex }
    ];
  }
  return filter;
}

// ── UTILITY: Get live counts from DB ─────────────────────────────────────────
async function getLiveCounts(query = {}) {
  const baseQuery = { ...query };
  delete baseQuery.primaryType;
  delete baseQuery.type;
  delete baseQuery.category;
  delete baseQuery.experienceLevel;
  delete baseQuery.secondaryType; // strip paid/free for tab base context
  delete baseQuery.domainGroup;
  delete baseQuery.excludeGovt;
  
  const baseFilter = buildJobFilter(baseQuery);
  
  const [
    total, internships, jobs, hackathons,
    paidInternships, freeInternships, unknownInternships,
    govtJobs, privateJobs, itJobs, engineeringJobs, fresherJobs,
    productJobs, serviceJobs,
    remotiveCount, arbeitnowCount, himalayasCount, govtRssCount, greenhouseCount, leverCount
  ] = await Promise.all([
    Job.countDocuments({ ...baseFilter }),
    Job.countDocuments({ ...baseFilter, primaryType: 'Internship' }),
    Job.countDocuments({ ...baseFilter, primaryType: 'Job' }),
    Job.countDocuments({ ...baseFilter, primaryType: 'Hackathon' }),
    Job.countDocuments({ ...baseFilter, primaryType: 'Internship', secondaryType: 'Paid' }),
    Job.countDocuments({ ...baseFilter, primaryType: 'Internship', secondaryType: 'Free' }),
    Job.countDocuments({ ...baseFilter, primaryType: 'Internship', secondaryType: 'Unknown' }),
    Job.countDocuments({ ...baseFilter, $or: [{ category: 'Government' }, { companyType: 'government' }] }),
    Job.countDocuments({ ...baseFilter, primaryType: 'Job', category: { $ne: 'Government' }, companyType: { $ne: 'government' } }),
    Job.countDocuments({ ...baseFilter, domain: { $in: ['Software Development', 'Web Development', 'App Development', 'AI/ML', 'Data Science', 'Cyber Security', 'Cloud Computing', 'DevOps', 'Database'] } }),
    Job.countDocuments({ ...baseFilter, domain: { $in: ['Mechanical Engineering', 'Civil Engineering', 'Electrical Engineering', 'Electronics', 'Embedded Systems'] } }),
    Job.countDocuments({ ...baseFilter, experienceLevel: { $in: ['Fresher', 'Entry-Level'] } }),
    Job.countDocuments({ ...baseFilter, companyType: 'product' }),
    Job.countDocuments({ ...baseFilter, companyType: 'service' }),
    Job.countDocuments({ ...buildJobFilter({}), source: 'remotive' }), // Keep source counts global
    Job.countDocuments({ ...buildJobFilter({}), source: 'arbeitnow' }),
    Job.countDocuments({ ...buildJobFilter({}), source: 'himalayas' }),
    Job.countDocuments({ ...buildJobFilter({}), source: 'govtRss' }),
    Job.countDocuments({ ...buildJobFilter({}), source: 'greenhouse' }),
    Job.countDocuments({ ...buildJobFilter({}), source: 'lever' })
  ]);

  return {
    total, internships, jobs, hackathons,
    paidInternships, freeInternships, unknownInternships,
    govtJobs, privateJobs, itJobs, engineeringJobs, fresherJobs,
    productJobs, serviceJobs,
    sources: { remotive: remotiveCount, arbeitnow: arbeitnowCount, himalayas: himalayasCount, govtRss: govtRssCount, greenhouse: greenhouseCount, lever: leverCount }
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
    const filter = buildJobFilter(req.query);

    // Pagination
    const rawLimit = parseInt(req.query.limit);
    const limit = Math.min(Math.max(isNaN(rawLimit) ? 20 : rawLimit, 1), 300);
    const rawPage = parseInt(req.query.page);
    let page = isNaN(rawPage) ? 1 : Math.max(rawPage, 1);
    
    // Fallback to offset if page is not provided but offset is
    if (isNaN(rawPage) && !isNaN(parseInt(req.query.offset))) {
      page = Math.floor(parseInt(req.query.offset) / limit) + 1;
    }
    const skip = (page - 1) * limit;

    // Execute queries
    const [rawJobs, total] = await Promise.all([
      Job.find(filter)
        .sort({ postedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Job.countDocuments(filter)
    ]);

    // Normalization layer
    const domainMap = {
      'Mechanical': 'Mechanical Engineering',
      'Civil': 'Civil Engineering',
      'Electrical': 'Electrical Engineering',
      'EE': 'Electrical Engineering',
      'EEE': 'Electrical Engineering',
      'ECE': 'Electronics',
      'Embedded': 'Embedded Systems',
      'CSE': 'Software Development',
      'IT': 'Software Development'
    };

    const jobs = rawJobs.map(job => {
      if (!job.domain && job.branch && domainMap[job.branch]) {
        job.domain = domainMap[job.branch];
      }
      return job;
    });

    const totalPages = Math.ceil(total / limit);

    res.json({ 
      success: true, 
      jobs, 
      count: jobs.length, 
      total, 
      page, 
      limit, 
      totalPages 
    });
  } catch (err) {
    console.error('[GET /api/jobs] Error:', err);
    res.status(500).json({ success: false, error: 'Unable to load jobs' });
  }
});

// ── GET /api/jobs/stats — Live category counters ──────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const counts = await getLiveCounts(req.query);
    res.json({ success: true, ...counts });
  } catch (err) {
    console.error('[GET /api/jobs/stats] Error:', err.message);
    res.status(500).json({ error: 'Failed to get stats', details: err.message });
  }
});

// ── GET /api/jobs/source-status — Live source statuses ──────────────────────────────
router.get('/source-status', (req, res) => {
  try {
    const stats = getLastSourceStats();
    res.json({ success: true, sources: stats });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get source status', details: err.message });
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
