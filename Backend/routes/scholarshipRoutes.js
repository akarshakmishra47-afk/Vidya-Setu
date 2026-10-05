const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Scholarship = require('../models/Scholarship');
const ScholarshipApplication = require('../models/ScholarshipApplication');
const User = require('../models/User');
const ScholarshipIssue = require('../models/ScholarshipIssue');
const { fetchAllScholarships } = require('../services/scholarships/scholarshipFetcher');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

let lastRefresh = null;
let refreshInProgress = false;
let autoRefreshTimer = null;


// Fetch Latest Integration
async function triggerScholarshipFetch() {
  if (refreshInProgress) return;
  refreshInProgress = true;
  try {
    const newScholarships = await fetchAllScholarships();
    let inserted = 0;
    
    await Scholarship.updateMany({ source: { $nin: ['manual', 'seed'] } }, { status: 'stale' });

    for (const s of newScholarships) {
      try {
        const { status, lastVerifiedAt, ...insertData } = s;
        const result = await Scholarship.updateOne(
          { deduplicationKey: s.deduplicationKey },
          { 
            $setOnInsert: insertData, 
            $set: { status: 'active', lastVerifiedAt: Date.now() } 
          },
          { upsert: true }
        );
        if (result.upsertedCount > 0) inserted++;
      } catch (e) {
        console.error('[ScholarshipRoutes] Insert error:', e);
      }
    }
    
    lastRefresh = new Date();
    console.log(`[ScholarshipRoutes] Successfully processed fetch cycle. Inserted ${inserted} new external scholarships.`);
  } catch (error) {
    console.error('[ScholarshipRoutes] Fetch error:', error);
  } finally {
    refreshInProgress = false;
  }
}

// Scheduled refresh (every 12 hours)
autoRefreshTimer = setInterval(() => {
  triggerScholarshipFetch();
}, 12 * 60 * 60 * 1000);

// Fetch on startup
setTimeout(() => {
  triggerScholarshipFetch();
}, 2000); // 2 second delay to let server init

/**
 * Retrieves all active scholarships.
 * @route GET /api/scholarships
 * @access Public
 */
router.get('/', async (req, res) => {
  try {
    const scholarships = await Scholarship.find({ status: 'active', isActive: true }).sort({ createdAt: -1 });
    res.status(200).json(scholarships);
  } catch (err) {
    console.error('Scholarship fetch error:', err.message);
    res.status(500).json({ success: false, message: "Failed to fetch scholarships" });
  }
});

/**
 * Retrieves pipeline status and statistics for scholarships.
 * @route GET /api/scholarships/status
 * @access Public
 */
router.get('/status', async (req, res) => {
  try {
    const total = await Scholarship.countDocuments();
    const active = await Scholarship.countDocuments({ status: 'active' });
    const stale = await Scholarship.countDocuments({ status: 'stale' });
    const sources = await Scholarship.distinct('source');
    
    res.status(200).json({
      success: true,
      total,
      active,
      stale,
      sources,
      lastRefresh,
      refreshInProgress
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch scholarship stats' });
  }
});

/**
 * Retrieves all user-reported scholarship issues.
 * @route GET /api/scholarships/issues
 * @access Public
 */
router.get('/issues', async (req, res) => {
  try {
    const issues = await ScholarshipIssue.find().sort({ createdAt: -1 });
    res.status(200).json(issues);
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch issues" });
  }
});

/**
 * Submits a new user-reported issue.
 * @route POST /api/scholarships/issues
 * @access Private
 */
router.post('/issues', authenticateToken, async (req, res) => {
  try {
    const { title, desc } = req.body;
    if (!title || typeof title !== 'string' || title.length > 200) {
      return res.status(400).json({ success: false, message: "Valid title is required (max 200 characters)" });
    }
    const newIssue = new ScholarshipIssue({ 
      title: title.substring(0, 200), 
      desc: typeof desc === 'string' ? desc.substring(0, 2000) : "Awaiting further details."
    });
    await newIssue.save();
    res.status(201).json({ success: true, issue: newIssue });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to save issue" });
  }
});

/**
 * Manually triggers a scholarship pipeline fetch.
 * @route POST /api/scholarships/fetch-latest
 * @access Private
 */
router.post('/fetch-latest', authenticateToken, async (req, res) => {
  if (refreshInProgress) {
    return res.status(429).json({ success: false, message: 'Refresh already in progress' });
  }
  await triggerScholarshipFetch();
  res.status(200).json({ success: true, message: 'Refresh triggered successfully' });
});

/**
 * Retrieves applications for a specific user.
 * @route GET /api/scholarships/my-applications/:identifier
 * @access Private
 */
router.get('/my-applications/:identifier', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(200).json([]);

    // Verify the identifier matches the authenticated user
    const identifier = req.params.identifier;
    const isOwnId = identifier === req.user.userId.toString();
    const isOwnRoll = identifier === user.rollNo;

    if (!isOwnId && !isOwnRoll && !req.user.isAdmin) {
      return res.status(403).json({ success: false, message: 'Forbidden: Can only view your own applications' });
    }

    const targetUser = (isOwnId || isOwnRoll) ? user : 
      (mongoose.Types.ObjectId.isValid(identifier) ? await User.findById(identifier) : await User.findOne({ rollNo: identifier }));
    
    if (!targetUser) return res.status(200).json([]);

    const applications = await ScholarshipApplication.find({ studentId: targetUser._id })
      .populate('scholarshipId');
    res.status(200).json(applications);
  } catch (err) {
    console.error('My applications error:', err.message);
    res.status(500).json({ success: false, message: "Failed to fetch applications" });
  }
});

/**
 * Applies to a scholarship using authenticated user identity.
 * @route POST /api/scholarships/apply
 * @access Private
 */
router.post('/apply', authenticateToken, async (req, res) => {
  try {
    const { scholarshipId, documents } = req.body;

    if (!scholarshipId || !mongoose.Types.ObjectId.isValid(scholarshipId)) {
      return res.status(400).json({ success: false, message: "Valid scholarship ID required" });
    }


    const user = await User.findById(req.user.userId);
    const scholarship = await Scholarship.findById(scholarshipId);

    if (!user || !scholarship) return res.status(404).json({ success: false, message: "User or Scholarship not found" });

    // ELIGIBILITY ENGINE
    if (user.familyIncome > scholarship.eligibility.maxIncome) {
      return res.status(400).json({ success: false, message: `Not eligible: Family income exceeds max limit.` });
    }
    if (!scholarship.eligibility.allowedCategories.includes(user.casteCategory)) {
      return res.status(400).json({ success: false, message: `Not eligible: Category ${user.casteCategory} not accepted for this scholarship.` });
    }
    if (scholarship.eligibility.isDefenceRequired && !user.defenceDependent) {
      return res.status(400).json({ success: false, message: "Not eligible: Must be a ward of Armed Forces personnel." });
    }
    if (scholarship.eligibility.isCapfRequired && !user.capfDependent) {
      return res.status(400).json({ success: false, message: "Not eligible: Must be a ward of CAPF personnel." });
    }

    if (scholarship.category === 'Government') {
      const activeGovt = await ScholarshipApplication.findOne({
        studentId: user._id,
        categoryApplied: 'Government',
        status: { $in: ['Applied', 'Approved'] }
      });
      if (activeGovt) {
        return res.status(400).json({ success: false, message: "Conflict: You can only have one active Government Scholarship at a time." });
      }
    }

    const application = new ScholarshipApplication({
      studentId: user._id,
      scholarshipId,
      documents,
      categoryApplied: scholarship.category
    });

    await application.save();
    res.status(201).json({ success: true, message: "Application submitted successfully!", application });

  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: "You have already applied for this exact scholarship." });
    }
    console.error('Scholarship apply error:', err.message);
    res.status(500).json({ success: false, message: "Server error during application process." });
  }
});

/**
 * Retrieves all scholarship applications.
 * @route GET /api/scholarships/admin/all
 * @access Private/Admin
 */
router.get('/admin/all', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const apps = await ScholarshipApplication.find()
      .sort({ submittedAt: -1 })
      .populate('studentId', 'name rollNo branch')
      .populate('scholarshipId', 'title category amount');
    res.status(200).json(apps);
  } catch (err) {
    console.error('Admin fetch applications error:', err.message);
    res.status(500).json({ success: false, message: "Failed to fetch all applications" });
  }
});

/**
 * Updates the status of a specific scholarship application.
 * @route PUT /api/scholarships/admin/application/:id
 * @access Private/Admin
 */
router.put('/admin/application/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['Applied', 'Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status state" });
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid application ID" });
    }

    const application = await ScholarshipApplication.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!application) return res.status(404).json({ success: false, message: "Application not found" });
    res.status(200).json(application);
  } catch (err) {
    console.error('Admin update application error:', err.message);
    res.status(500).json({ success: false, message: "Failed to update application" });
  }
});


module.exports = router;
