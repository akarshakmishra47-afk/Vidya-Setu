const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Scholarship = require('../models/Scholarship');
const ScholarshipApplication = require('../models/ScholarshipApplication');
const User = require('../models/User');
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
        const existing = await Scholarship.findOne({ deduplicationKey: s.deduplicationKey });
        if (!existing) {
          await Scholarship.create(s);
          inserted++;
        } else {
          await Scholarship.findByIdAndUpdate(existing._id, { status: 'active', lastVerifiedAt: Date.now() });
        }
      } catch (e) {
        if (e.code !== 11000) console.error('[ScholarshipRoutes] Insert error:', e);
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

// GET all available scholarships — public
router.get('/', async (req, res) => {
  try {
    const scholarships = await Scholarship.find({ status: 'active', isActive: true }).sort({ createdAt: -1 });
    res.json(scholarships);
  } catch (err) {
    console.error('Scholarship fetch error:', err.message);
    res.status(500).json({ success: false, message: "Failed to fetch scholarships" });
  }
});

// GET scholarships pipeline status — public
router.get('/status', async (req, res) => {
  try {
    const total = await Scholarship.countDocuments();
    const active = await Scholarship.countDocuments({ status: 'active' });
    const stale = await Scholarship.countDocuments({ status: 'stale' });
    const sources = await Scholarship.distinct('source');
    
    res.json({
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

// GET all user-reported issues — public
router.get('/issues', async (req, res) => {
  try {
    const ScholarshipIssue = require('../models/ScholarshipIssue');
    const issues = await ScholarshipIssue.find().sort({ createdAt: -1 });
    res.json(issues);
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch issues" });
  }
});

// POST new user-reported issue — require auth
router.post('/issues', authenticateToken, async (req, res) => {
  try {
    const ScholarshipIssue = require('../models/ScholarshipIssue');
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

// POST trigger manual fetch — Bug 1: admin only
router.post('/fetch-latest', authenticateToken, requireAdmin, async (req, res) => {
  if (refreshInProgress) {
    return res.status(429).json({ success: false, message: 'Refresh already in progress' });
  }
  triggerScholarshipFetch();
  res.json({ success: true, message: 'Refresh triggered successfully' });
});

// GET applications for authenticated user — Bug 11: require auth, verify ownership
router.get('/my-applications/:identifier', authenticateToken, async (req, res) => {
  try {
    // Bug 11: Must match authenticated user
    const user = await User.findById(req.user.userId);
    if (!user) return res.json([]);

    // Verify the identifier matches the authenticated user
    const identifier = req.params.identifier;
    const isOwnId = identifier === req.user.userId.toString();
    const isOwnRoll = identifier === user.rollNo;

    if (!isOwnId && !isOwnRoll && !req.user.isAdmin) {
      return res.status(403).json({ success: false, message: 'Forbidden: Can only view your own applications' });
    }

    const targetUser = (isOwnId || isOwnRoll) ? user : 
      (identifier.length === 24 ? await User.findById(identifier) : await User.findOne({ rollNo: identifier }));
    
    if (!targetUser) return res.json([]);

    const applications = await ScholarshipApplication.find({ studentId: targetUser._id })
      .populate('scholarshipId');
    res.json(applications);
  } catch (err) {
    console.error('My applications error:', err.message);
    res.status(500).json({ success: false, message: "Failed to fetch applications" });
  }
});

// POST apply to a scholarship — Bug 11: use authenticated identity
router.post('/apply', authenticateToken, async (req, res) => {
  try {
    const { scholarshipId, documents } = req.body;

    if (!scholarshipId || !mongoose.Types.ObjectId.isValid(scholarshipId)) {
      return res.status(400).json({ success: false, message: "Valid scholarship ID required" });
    }

    // Bug 11: Use authenticated user ID, not from request body
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

// ADMIN: Get all applications — Bug 1: admin only
router.get('/admin/all', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const apps = await ScholarshipApplication.find()
      .sort({ submittedAt: -1 })
      .populate('studentId', 'name rollNo branch')
      .populate('scholarshipId', 'title category amount');
    res.json(apps);
  } catch (err) {
    console.error('Admin fetch applications error:', err.message);
    res.status(500).json({ success: false, message: "Failed to fetch all applications" });
  }
});

// ADMIN: Update application status — Bug 1: admin only
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
    res.json(application);
  } catch (err) {
    console.error('Admin update application error:', err.message);
    res.status(500).json({ success: false, message: "Failed to update application" });
  }
});

// AKTU: Save OTR — Bug 9: hash securityPin, Bug 10: use authenticated userId
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
      
      // Bug 9: Hash the security PIN if provided
      const updateData = { fullName, dob, mobileNumber, category, otrStatus };
      if (securityPin) {
        updateData.securityPin = await bcrypt.hash(securityPin, 10);
      }
      student = await AktuStudentOtr.findOneAndUpdate({ aadhaarNumber }, updateData, { new: true });
    } else {
      const studentId = 'AKTU' + Date.now().toString().slice(-6);
      
      // Bug 9: Hash the security PIN before storing
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

    // Bug 10: Use authenticated user ID, not from request body
    await User.findByIdAndUpdate(req.user.userId, {
      aadhaarNumber,
      dob,
      mobileNumber,
      casteCategory: category || 'General'
    });

    // Bug 9: Never return securityPin in response
    const safeStudent = student.toObject();
    delete safeStudent.securityPin;

    res.status(201).json({ success: true, student: safeStudent });
  } catch (err) {
    console.error('AKTU OTR error:', err.message);
    res.status(500).json({ success: false, message: "Failed to save OTR data" });
  }
});

// AKTU: Save Application Form — Bug 11: verify ownership
router.post('/aktu-application', authenticateToken, async (req, res) => {
  try {
    const { studentReference, applicationStatus, ...applicationData } = req.body;

    if (!studentReference || typeof studentReference !== 'string') {
      return res.status(400).json({ success: false, message: "Student reference required" });
    }

    // Bug 11: Verify the studentReference belongs to authenticated user
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

// AKTU: Get Application — Bug 11: verify ownership or admin
router.get('/aktu-application/:studentRef', authenticateToken, async (req, res) => {
  try {
    const app = await AktuScholarshipApplication.findOne({ studentReference: req.params.studentRef });
    if (!app) return res.json({ success: false });

    // Bug 11: Verify ownership
    if (!req.user.isAdmin) {
      const otr = await AktuStudentOtr.findOne({ studentId: req.params.studentRef });
      if (otr) {
        const user = await User.findById(req.user.userId);
        if (!user || user.aadhaarNumber !== otr.aadhaarNumber) {
          return res.status(403).json({ success: false, message: "Forbidden: Not your application" });
        }
      }
    }

    res.json({ success: true, app });
  } catch (err) {
    console.error('AKTU application fetch error:', err.message);
    res.status(500).json({ success: false, message: "Failed to fetch AKTU application" });
  }
});

module.exports = router;
