const express = require('express');
const mongoose = require('mongoose');
const Scholarship = require('../models/Scholarship');
const ScholarshipApplication = require('../models/ScholarshipApplication');
const User = require('../models/User');
const AktuStudentOtr = require('../models/AktuStudentOtr');
const AktuScholarshipApplication = require('../models/AktuScholarshipApplication');
const { fetchAllScholarships } = require('../services/scholarships/scholarshipFetcher');

const router = express.Router();

let lastRefresh = null;
let refreshInProgress = false;
let autoRefreshTimer = null;

// Initialize & Migrate DB on startup
async function initializeScholarships() {
  try {
    if (mongoose.connection.readyState !== 1) return; // Wait for connection
    
    // Migrate existing manually seeded scholarships to have deduplicationKey and source
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
    
    // Deactivate old external scholarships (so we don't keep dead ones active)
    await Scholarship.updateMany({ source: { $nin: ['manual', 'seed'] } }, { status: 'stale' });

    // Insert or activate new external scholarships
    for (const s of newScholarships) {
      try {
        const existing = await Scholarship.findOne({ deduplicationKey: s.deduplicationKey });
        if (!existing) {
          await Scholarship.create(s);
          inserted++;
        } else {
          // Re-activate if it was stale, and update timestamp
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

// GET all available scholarships
router.get('/', async (req, res) => {
  try {
    const scholarships = await Scholarship.find({ status: 'active', isActive: true }).sort({ createdAt: -1 });
    res.json(scholarships);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch scholarships" });
  }
});

// GET scholarships pipeline status
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
    res.status(500).json({ success: false, error: 'Failed to fetch scholarship stats' });
  }
});

// GET all user-reported issues
router.get('/issues', async (req, res) => {
  try {
    const ScholarshipIssue = require('../models/ScholarshipIssue');
    const issues = await ScholarshipIssue.find().sort({ createdAt: -1 });
    res.json(issues);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch issues" });
  }
});

// POST new user-reported issue
router.post('/issues', async (req, res) => {
  try {
    const ScholarshipIssue = require('../models/ScholarshipIssue');
    const { title, desc } = req.body;
    if (!title) return res.status(400).json({ error: "Title is required" });
    const newIssue = new ScholarshipIssue({ 
      title, 
      desc: desc || "Awaiting further details."
    });
    await newIssue.save();
    res.status(201).json({ success: true, issue: newIssue });
  } catch (err) {
    res.status(500).json({ error: "Failed to save issue" });
  }
});

// POST trigger manual fetch
router.post('/fetch-latest', async (req, res) => {
  if (refreshInProgress) {
    return res.status(429).json({ error: 'Refresh already in progress' });
  }
  // Run asynchronously without blocking
  triggerScholarshipFetch();
  res.json({ message: 'Refresh triggered successfully' });
});

// -------------------------------------------------------------
// BELOW ARE PRE-EXISTING ROUTES FOR APPLICATIONS AND AKTU PORTAL
// -------------------------------------------------------------

// GET applications for a specific user (by rollNo or ID)
router.get('/my-applications/:identifier', async (req, res) => {
  try {
    const user = req.params.identifier.length === 24 ? await User.findById(req.params.identifier) : await User.findOne({ rollNo: req.params.identifier });
    if (!user) return res.json([]);
    const applications = await ScholarshipApplication.find({ studentId: user._id })
      .populate('scholarshipId');
    res.json(applications);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch applications" });
  }
});

// POST apply to a scholarship
router.post('/apply', async (req, res) => {
  try {
    const { studentId, rollNo, scholarshipId, documents } = req.body;

    const user = studentId ? await User.findById(studentId) : await User.findOne({ rollNo });
    const scholarship = await Scholarship.findById(scholarshipId);

    if (!user || !scholarship) return res.status(404).json({ error: "User or Scholarship not found" });

    // ELIGIBILITY ENGINE: 
    if (user.familyIncome > scholarship.eligibility.maxIncome) {
      return res.status(400).json({ error: `Not eligible: Family income exceeds max limit.` });
    }
    if (!scholarship.eligibility.allowedCategories.includes(user.casteCategory)) {
      return res.status(400).json({ error: `Not eligible: Category ${user.casteCategory} not accepted for this scholarship.` });
    }
    if (scholarship.eligibility.isDefenceRequired && !user.defenceDependent) {
      return res.status(400).json({ error: "Not eligible: Must be a ward of Armed Forces personnel." });
    }
    if (scholarship.eligibility.isCapfRequired && !user.capfDependent) {
      return res.status(400).json({ error: "Not eligible: Must be a ward of CAPF personnel." });
    }

    if (scholarship.category === 'Government') {
      const activeGovt = await ScholarshipApplication.findOne({
        studentId,
        categoryApplied: 'Government',
        status: { $in: ['Applied', 'Approved'] }
      });
      if (activeGovt) {
        return res.status(400).json({ error: "Conflict: You can only have one active Government Scholarship at a time." });
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
      return res.status(400).json({ error: "You have already applied for this exact scholarship." });
    }
    res.status(500).json({ error: "Server error during application process." });
  }
});

// ADMIN: Get all applications
router.get('/admin/all', async (req, res) => {
  try {
    const apps = await ScholarshipApplication.find()
      .sort({ submittedAt: -1 })
      .populate('studentId', 'name rollNo branch')
      .populate('scholarshipId', 'title category amount');
    res.json(apps);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch all applications" });
  }
});

// ADMIN: Update application status
router.put('/admin/application/:id', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['Applied', 'Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ error: "Invalid status state" });
    }

    const application = await ScholarshipApplication.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    res.json(application);
  } catch (err) {
    res.status(500).json({ error: "Failed to update application" });
  }
});

// AKTU: Save OTR (Student Collection)
router.post('/aktu-otr', async (req, res) => {
  try {
    const { aadhaarNumber, fullName, dob, mobileNumber, category, securityPin, otrStatus, userId } = req.body;
    let student = await AktuStudentOtr.findOne({ aadhaarNumber });
    
    if (student) {
      if (student.otrStatus) return res.status(400).json({ error: "OTR is permanently locked." });
      student = await AktuStudentOtr.findOneAndUpdate({ aadhaarNumber }, req.body, { new: true });
    } else {
      const studentId = 'AKTU' + Date.now().toString().slice(-6); // System generated identifier
      student = new AktuStudentOtr({ studentId, aadhaarNumber, fullName, dob, mobileNumber, category, securityPin, otrStatus });
      await student.save();
    }

    if (userId) {
      await User.findByIdAndUpdate(userId, {
        aadhaarNumber,
        dob,
        mobileNumber,
        casteCategory: category || 'General'
      });
    }

    res.status(201).json({ success: true, student });
  } catch (err) {
    res.status(500).json({ error: "Failed to save OTR data" });
  }
});

// AKTU: Save Application Form (Application Collection)
router.post('/aktu-application', async (req, res) => {
  try {
    const { studentReference, applicationStatus, ...applicationData } = req.body;
    let app = await AktuScholarshipApplication.findOne({ studentReference });

    if (app && app.applicationStatus !== 'Draft' && app.applicationStatus !== 'Rejected_by_Institute') {
      return res.status(400).json({ error: "Application is locked and cannot be edited." });
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
    res.status(500).json({ error: "Failed to save application data" });
  }
});

// AKTU: Get Application Form (Application Collection)
router.get('/aktu-application/:studentRef', async (req, res) => {
  try {
    const app = await AktuScholarshipApplication.findOne({ studentReference: req.params.studentRef });
    if (!app) return res.json({ success: false });
    res.json({ success: true, app });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch AKTU application" });
  }
});

module.exports = router;
