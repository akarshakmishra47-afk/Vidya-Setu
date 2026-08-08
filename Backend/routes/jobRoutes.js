const express = require('express');
const Job = require('../models/Job');
const {
  fetchLatestJobs,
  AUTO_REFRESH_MS,
  isRefreshing,
  setRefreshing,
  getLastRefreshTime,
  setLastRefreshTime,
  getLastRefreshError,
  setLastRefreshError
} = require('../fetchJobsRealIndiaOnly');

const router = express.Router();

// ── REFRESH STATE ────────────────────────────────────────────────────────────
let refreshInterval = null;
let isAutoRefreshRunning = false;

// ── UTILITY: Start automatic refresh cycle ───────────────────────────────────
function startAutoRefresh() {
  if (isAutoRefreshRunning) {
    console.log('⚠️  Auto-refresh already running');
    return;
  }

  isAutoRefreshRunning = true;
  console.log(`⏰ Auto-refresh enabled. Interval: ${AUTO_REFRESH_MS / 1000 / 60} minutes`);

  // Fetch immediately on startup
  (async () => {
    try {
      await performJobRefresh();
    } catch (error) {
      console.error('Initial refresh error:', error.message);
    }
  })();

  // Schedule automatic refresh
  refreshInterval = setInterval(async () => {
    try {
      console.log('⏱️  Auto-refresh triggered');
      await performJobRefresh();
    } catch (error) {
      console.error('Auto-refresh error:', error.message);
    }
  }, AUTO_REFRESH_MS);
}

// ── UTILITY: Perform job refresh (delete API jobs, fetch new, keep manual) ───
async function performJobRefresh() {
  try {
    // Prevent simultaneous refreshes
    if (isRefreshing()) {
      console.log('⚠️  Refresh already in progress, skipping...');
      return { status: 'skipped', reason: 'Refresh already in progress' };
    }

    setRefreshing(true);
    console.log('\n🚀 Starting Real India-Only Job Refresh...');
    
    // Fetch REAL India-only jobs from external APIs
    const freshJobs = await fetchLatestJobs();
    
    if (!freshJobs || freshJobs.length === 0) {
      console.log('⚠️  No fresh jobs fetched');
      setRefreshing(false);
      return { status: 'error', message: 'No jobs fetched from APIs' };
    }
    
    console.log(`📥 Fetched ${freshJobs.length} real India jobs from APIs`);
    
    // Get existing API jobs for deduplication
    const existingJobs = await Job.find({
      source: { $in: ['remotive', 'arbeitnow'] }
    });
    
    const existingKeys = new Set(
      existingJobs.map(j => j.deduplicationKey || j.sourceId || `${j.title}|${j.company}|${j.applyUrl}`)
    );
    
    // Filter out duplicates
    const newJobs = freshJobs.filter(job => {
      const key = job.deduplicationKey || job.sourceId || `${job.title}|${job.company}|${job.applyUrl}`;
      return !existingKeys.has(key);
    });
    
    console.log(`✨ New unique jobs: ${newJobs.length}`);
    
    // Insert new jobs
    if (newJobs.length > 0) {
      try {
        await Job.insertMany(newJobs, { ordered: false });
        console.log(`✅ Inserted ${newJobs.length} new jobs`);
      } catch (error) {
        console.warn(`⚠️  Some jobs had issues inserting: ${error.message}`);
      }
    }
    
    // Get stats
    const totalCount = await Job.countDocuments();
    const internships = await Job.countDocuments({ primaryType: 'Internship' });
    const jobs = await Job.countDocuments({ primaryType: 'Job' });
    
    console.log(`\n📊 Database Status:`);
    console.log(`   Total: ${totalCount}`);
    console.log(`   Internships: ${internships}`);
    console.log(`   Jobs: ${jobs}\n`);
    
    setLastRefreshTime(new Date());
    setLastRefreshError(null);
    setRefreshing(false);
    
    return {
      status: 'success',
      jobsAdded: newJobs.length,
      totalInDB: totalCount,
      internships,
      jobs,
      message: `✅ Added ${newJobs.length} new real India opportunities`
    };
    
  } catch (error) {
    console.error('❌ Refresh error:', error.message);
    setLastRefreshError(error.message);
    setRefreshing(false);
    throw error;
  }
}

// ── ROUTE: Stop auto-refresh (internal use) ──────────────────────────────────
function stopAutoRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
    isAutoRefreshRunning = false;
    console.log('⏹️  Auto-refresh stopped');
  }
}

// ── Export for server.js integration ─────────────────────────────────────────
function initializeJobRefresh() {
  startAutoRefresh();
}

// ── GET /api/jobs — get all jobs with optional filters and search ────────────
router.get('/', async (req, res) => {
  try {
    const filter = {};
    
    // Type filter: 'internship' or 'job'
    if (req.query.type) {
      filter.primaryType = req.query.type.charAt(0).toUpperCase() + req.query.type.slice(1).toLowerCase();
    }
    
    // Branch filter: CSE, IT, ECE, Mechanical, Civil, etc.
    if (req.query.branch) {
      filter.branch = req.query.branch;
    }
    
    // Company type filter: product, service, unknown
    if (req.query.companyType) {
      filter.companyType = req.query.companyType;
    }
    
    // Job category filter: internship, fresher-job, engineering-job
    if (req.query.jobCategory) {
      filter.jobCategory = req.query.jobCategory;
    }
    
    // Secondary type filter
    if (req.query.secondaryType) filter.secondaryType = req.query.secondaryType;
    
    // AKTU filter
    if (req.query.isAktu !== undefined) filter.isAktu = req.query.isAktu === 'true';

    // Source filter
    if (req.query.source) filter.source = req.query.source;
    
    // India location filter
    if (req.query.indiaOnly === 'true') filter.isIndiaLocation = true;

    // Search filter (title, company, tags, location)
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      filter.$or = [
        { title: searchRegex },
        { company: searchRegex },
        { location: searchRegex },
        { desc: searchRegex },
        { tags: searchRegex }
      ];
    }

    // Limit parameter
    const limit = Math.min(parseInt(req.query.limit) || 100, 500); // Max 500

    const jobs = await Job.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit);
    
    res.json({
      success: true,
      count: jobs.length,
      jobs
    });
  } catch (error) {
    console.error('GET /api/jobs error:', error);
    res.status(500).json({ error: 'Failed to fetch jobs data', details: error.message });
  }
});

// ── GET /api/jobs/status — refresh status and stats ──────────────────────────
router.get('/status', async (req, res) => {
  try {
    const stats = {
      total: await Job.countDocuments(),
      internships: await Job.countDocuments({ primaryType: 'Internship' }),
      jobs: await Job.countDocuments({ primaryType: 'Job' }),
      remotive: await Job.countDocuments({ source: 'remotive' }),
      arbeitnow: await Job.countDocuments({ source: 'arbeitnow' }),
      manual: await Job.countDocuments({ source: 'manual' }),
      web: await Job.countDocuments({ source: 'web' })
    };

    const refreshStatus = getRefreshStatus();

    res.json({
      success: true,
      stats,
      refresh: {
        ...refreshStatus,
        isRunning: isRefreshingCurrently()
      },
      autoRefresh: {
        enabled: isAutoRefreshRunning,
        intervalMinutes: AUTO_REFRESH_MS / 1000 / 60
      }
    });
  } catch (error) {
    console.error('GET /api/jobs/status error:', error);
    res.status(500).json({ error: 'Failed to get status', details: error.message });
  }
});

// ── POST /api/jobs/refresh — manually trigger refresh ────────────────────────
router.post('/refresh', async (req, res) => {
  try {
    if (isRefreshing()) {
      return res.status(429).json({ 
        success: false,
        error: 'Refresh already in progress',
        message: 'Please wait for the current refresh to complete before triggering another.'
      });
    }

    console.log('🔄 Manual refresh triggered via /refresh');
    const result = await performJobRefresh();
    
    const stats = {
      total: await Job.countDocuments(),
      internships: await Job.countDocuments({ primaryType: 'Internship' }),
      jobs: await Job.countDocuments({ primaryType: 'Job' })
    };

    res.json({
      success: result.status === 'success',
      message: result.message || 'Refresh completed',
      result,
      stats
    });
  } catch (error) {
    console.error('POST /api/jobs/refresh error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Refresh failed',
      details: error.message
    });
  }
});

// ── POST /api/jobs/fetch-latest — legacy endpoint (compatibility) ────────────
router.post('/fetch-latest', async (req, res) => {
  try {
    if (isRefreshing()) {
      return res.status(429).json({ 
        success: false,
        error: 'Refresh already in progress'
      });
    }

    console.log('🔄 fetch-latest endpoint triggered');
    const result = await performJobRefresh();
    
    const totalInDB = await Job.countDocuments();
    res.json({
      success: result.status === 'success',
      message: 'Jobs synced successfully',
      totalInDB,
      result
    });
  } catch (error) {
    console.error('POST /api/jobs/fetch-latest error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch latest jobs',
      details: error.message
    });
  }
});

// ── POST / — create a new manual job (admin entry) ───────────────────────────
router.post('/', async (req, res) => {
  try {
    // Ensure manual jobs have source = 'manual'
    const jobData = { ...req.body, source: 'manual' };
    const job = new Job(jobData);
    await job.save();
    
    res.status(201).json({
      success: true,
      message: 'Job created successfully',
      job
    });
  } catch (error) {
    console.error('POST / error:', error);
    res.status(400).json({ 
      error: 'Failed to create job',
      details: error.message
    });
  }
});

// ── GET /:id — get single job ─────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    
    res.json({
      success: true,
      job
    });
  } catch (error) {
    console.error('GET /:id error:', error);
    res.status(500).json({ error: 'Failed to fetch job' });
  }
});

// ── DELETE /:id — delete a job (admin use) ────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Job.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Job not found' });
    
    res.json({ 
      success: true, 
      message: 'Job deleted successfully' 
    });
  } catch (error) {
    console.error('DELETE /:id error:', error);
    res.status(500).json({ error: 'Failed to delete job' });
  }
});

// ── LEGACY: GET /stats/summary ────────────────────────────────────────────────
router.get('/stats/summary', async (req, res) => {
  try {
    const stats = {
      total: await Job.countDocuments(),
      paid: await Job.countDocuments({ primaryType: 'Internship', secondaryType: 'Paid' }),
      free: await Job.countDocuments({ primaryType: 'Internship', secondaryType: 'Free' }),
      aktuJobs: await Job.countDocuments({ primaryType: 'Job', isAktu: true }),
      webFetched: await Job.countDocuments({ source: 'web' }),
      manual: await Job.countDocuments({ source: 'manual' })
    };

    res.json(stats);
  } catch (error) {
    console.error('GET /stats/summary error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

module.exports = router;
module.exports.initializeJobRefresh = initializeJobRefresh;
module.exports.stopAutoRefresh = stopAutoRefresh;
