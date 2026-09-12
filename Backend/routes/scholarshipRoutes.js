const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Scholarship = require('../models/Scholarship');
const ScholarshipApplication = require('../models/ScholarshipApplication');
const User = require('../models/User');
const ScholarshipIssue = require('../models/ScholarshipIssue');
const AktuStudentOtr = require('../models/AktuStudentOtr');
const AktuScholarshipApplication = require('../models/AktuScholarshipApplication');
const { fetchAllScholarships } = require('../services/scholarships/scholarshipFetcher');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

let lastRefresh = null;
let refreshInProgress = false;
let autoRefreshTimer = null;

// Initialize & Migrate DB on startup
async function initializeScholarships() {
  try {
    if (mongoose.connection.readyState !== 1) return;
    
    const oldScholarships = await Scholarship.find({ source: { $exists: false } });
    if (oldScholarships.length > 0) {
      console.log(`[ScholarshipRoutes] Found ${oldScholarships.length} un-migrated scholarships. Migrating...`);
      for (const old of oldScholarships) {
        const deduplicationKey = `manual::${String(old.title).toLowerCase().replace(/[^a-z0-9]/g, '')}`;
        await Scholarship.findByIdAndUpdate(old._id, {
          source: 'manual',
          sourceId: old._id.toString(),
          deduplicationKey,
          status: 'active'
        });
      }
      console.log('[ScholarshipRoutes] Migration complete.');
    }
  } catch (error) {
    console.error('[ScholarshipRoutes] Migration error:', error);
  }
}
setTimeout(initializeScholarships, 3000);

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
        const result = await Scholarship.updateOne(
          { deduplicationKey: s.deduplicationKey },
          { 
            $setOnInsert: s, 
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
 * @access Private/Admin
 */
router.post('/fetch-latest', authenticateToken, requireAdmin, async (req, res) => {
  if (refreshInProgress) {
    return res.status(429).json({ success: false, message: 'Refresh already in progress' });
  }
  triggerScholarshipFetch();
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

/**
 * Saves AKTU OTR (One Time Registration) data securely.
 * @route POST /api/scholarships/aktu-otr
 * @access Private
 */
router.post('/aktu-otr', authenticateToken, async (req, res) => {
  try {
    const { aadhaarNumber, fullName, dob, mobileNumber, category, securityPin, otrStatus } = req.body;

    if (!aadhaarNumber || typeof aadhaarNumber !== 'string' || aadhaarNumber.length !== 12) {
      return res.status(400).json({ success: false, message: "Valid 12-digit Aadhaar number required" });
    }
    if (securityPin && (typeof securityPin !== 'string' || securityPin.length < 4 || securityPin.length > 20)) {
      return res.status(400).json({ success: false, message: "Security PIN must be 4-20 characters" });
    }

    let student = await AktuStudentOtr.findOne({ aadhaarNumber });
    
    if (student) {
      if (student.otrStatus) return res.status(400).json({ success: false, message: "OTR is permanently locked." });
      

      const updateData = { fullName, dob, mobileNumber, category, otrStatus };
      if (securityPin) {
        updateData.securityPin = await bcrypt.hash(securityPin, 10);
      }
      student = await AktuStudentOtr.findOneAndUpdate({ aadhaarNumber }, updateData, { new: true });
    } else {
      const studentId = 'AKTU' + Date.now().toString().slice(-6);
      

      const hashedPin = securityPin ? await bcrypt.hash(securityPin, 10) : undefined;
      
      student = new AktuStudentOtr({
        studentId,
        aadhaarNumber,
        fullName,
        dob,
        mobileNumber,
        category,
        securityPin: hashedPin,
        otrStatus
      });
      await student.save();
    }


    await User.findByIdAndUpdate(req.user.userId, {
      aadhaarNumber,
      dob,
      mobileNumber,
      casteCategory: category || 'General'
    });


    const safeStudent = student.toObject();
    delete safeStudent.securityPin;

    res.status(201).json({ success: true, student: safeStudent });
  } catch (err) {
    console.error('AKTU OTR error:', err.message);
    res.status(500).json({ success: false, message: "Failed to save OTR data" });
  }
});

/**
 * Saves AKTU Scholarship Application Form data.
 * @route POST /api/scholarships/aktu-application
 * @access Private
 */
router.post('/aktu-application', authenticateToken, async (req, res) => {
  try {
    const { studentReference, applicationStatus, ...applicationData } = req.body;

    if (!studentReference || typeof studentReference !== 'string') {
      return res.status(400).json({ success: false, message: "Student reference required" });
    }


    const otr = await AktuStudentOtr.findOne({ studentId: studentReference });
    if (!otr) return res.status(404).json({ success: false, message: "Student OTR not found" });

    // Verify ownership: check if this user's aadhaar matches the OTR
    const user = await User.findById(req.user.userId);
    if (!user || user.aadhaarNumber !== otr.aadhaarNumber) {
      if (!req.user.isAdmin) {
        return res.status(403).json({ success: false, message: "Forbidden: Not your OTR record" });
      }
    }

    let app = await AktuScholarshipApplication.findOne({ studentReference });

    if (app && app.applicationStatus !== 'Draft' && app.applicationStatus !== 'Rejected_by_Institute') {
      return res.status(400).json({ success: false, message: "Application is locked and cannot be edited." });
    }

    if (app) {
      app = await AktuScholarshipApplication.findOneAndUpdate(
        { studentReference }, 
        { ...applicationData, applicationStatus, draftSavedAt: Date.now(), finalLockedAt: applicationStatus !== 'Draft' ? Date.now() : null }, 
        { new: true }
      );
    } else {
      const applicationNumber = 'UP' + new Date().getFullYear() + Date.now().toString().slice(-6);
      app = new AktuScholarshipApplication({
        applicationNumber,
        studentReference,
        applicationStatus,
        ...applicationData
      });
      await app.save();
    }
    res.status(201).json({ success: true, application: app });
  } catch (err) {
    console.error('AKTU application error:', err.message);
    res.status(500).json({ success: false, message: "Failed to save application data" });
  }
});

/**
 * Retrieves AKTU Scholarship Application by student reference.
 * @route GET /api/scholarships/aktu-application/:studentRef
 * @access Private
 */
router.get('/aktu-application/:studentRef', authenticateToken, async (req, res) => {
  try {
    const app = await AktuScholarshipApplication.findOne({ studentReference: req.params.studentRef });
    if (!app) return res.status(200).json({ success: false });


    if (!req.user.isAdmin) {
      const otr = await AktuStudentOtr.findOne({ studentId: req.params.studentRef });
      if (otr) {
        const user = await User.findById(req.user.userId);
        if (!user || user.aadhaarNumber !== otr.aadhaarNumber) {
          return res.status(403).json({ success: false, message: "Forbidden: Not your application" });
        }
      }
    }

    res.status(200).json({ success: true, app });
  } catch (err) {
    console.error('AKTU application fetch error:', err.message);
    res.status(500).json({ success: false, message: "Failed to fetch AKTU application" });
  }
});

module.exports = router;
