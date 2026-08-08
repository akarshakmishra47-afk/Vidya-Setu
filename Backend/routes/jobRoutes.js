const express = require('express');
const Job = require('../models/Job');
const { fetchLatestJobs, getRefreshStatus, AUTO_REFRESH_MS, isRefreshingCurrently } = require('../fetchJobs');

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
    if (isRefreshingCurrently()) {
      console.log('⚠️  Refresh already in progress, skipping...');
      return { status: 'skipped', reason: 'Refresh already in progress' };
    }

    // Delete old API-fetched jobs (remotive, arbeitnow), keep manual jobs
    const deleted = await Job.deleteMany({ source: { $in: ['remotive', 'arbeitnow', 'web'] } });
    console.log(`🗑️  Deleted ${deleted.deletedCount} old API jobs`);

    // Fetch new jobs from APIs
    const jobs = await fetchLatestJobs();
    console.log(`📥 Fetched ${jobs.length} new jobs from APIs`);

    // Insert new jobs
    if (jobs.length > 0) {
      await Job.insertMany(jobs);
      console.log(`✅ Inserted ${jobs.length} jobs into database`);
    }

    const totalCount = await Job.countDocuments();
    console.log(`📊 Total jobs in database: ${totalCount}`);

    return { status: 'success', jobsAdded: jobs.length, totalInDB: totalCount };
  } catch (error) {
    console.error('❌ Refresh error:', error);
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
    
    // Secondary type filter
    if (req.query.secondaryType) filter.secondaryType = req.query.secondaryType;
    
    // AKTU filter
    if (req.query.isAktu !== undefined) filter.isAktu = req.query.isAktu === 'true';

    // Source filter
    if (req.query.source) filter.source = req.query.source;

    // Search filter (title, company, tags, location)
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      filter.$or = [
        { title: searchRegex },
        { company: searchRegex },
        { location: searchRegex },
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
    if (isRefreshingCurrently()) {
      return res.status(429).json({ 
        error: 'Refresh already in progress',
        message: 'Please wait for the current refresh to complete before triggering another.'
      });
    }

    console.log('🔄 Manual refresh triggered');
    const result = await performJobRefresh();
    
    const stats = {
      total: await Job.countDocuments(),
      internships: await Job.countDocuments({ primaryType: 'Internship' }),
      jobs: await Job.countDocuments({ primaryType: 'Job' })
    };

    res.json({
      success: true,
      message: 'Manual refresh completed',
      result,
      stats
    });
  } catch (error) {
    console.error('POST /api/jobs/refresh error:', error);
    res.status(500).json({ 
      error: 'Refresh failed',
      details: error.message
    });
  }
});

// ── POST /api/jobs/fetch-latest — legacy endpoint (compatibility) ────────────
router.post('/fetch-latest', async (req, res) => {
  try {
    if (isRefreshingCurrently()) {
      return res.status(429).json({ 
        error: 'Refresh already in progress'
      });
    }

    console.log('🔄 fetch-latest endpoint triggered');
    const result = await performJobRefresh();
    
    const totalInDB = await Job.countDocuments();
    res.json({
      success: true,
      message: 'Jobs synced successfully',
      totalInDB,
      result
    });
  } catch (error) {
    console.error('POST /api/jobs/fetch-latest error:', error);
    res.status(500).json({ 
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
