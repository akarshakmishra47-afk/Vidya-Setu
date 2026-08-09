const express = require('express');
const Scholarship = require('../models/Scholarship');
const ScholarshipApplication = require('../models/ScholarshipApplication');
const User = require('../models/User');

const AktuStudentOtr = require('../models/AktuStudentOtr');
const AktuScholarshipApplication = require('../models/AktuScholarshipApplication');

const router = express.Router();

// GET all available scholarships
router.get('/', async (req, res) => {
  try {
    const scholarships = await Scholarship.find().sort({ createdAt: -1 });
    res.json(scholarships);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch scholarships" });
  }
});

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
    // Check Income Limit
    if (user.familyIncome > scholarship.eligibility.maxIncome) {
      return res.status(400).json({ error: `Not eligible: Family income exceeds max limit of ?${scholarship.eligibility.maxIncome}` });
    }
    // Check Caste
    if (!scholarship.eligibility.allowedCategories.includes(user.casteCategory)) {
      return res.status(400).json({ error: `Not eligible: Category ${user.casteCategory} not accepted for this scholarship.` });
    }
    // Check Special Requirements
    if (scholarship.eligibility.isDefenceRequired && !user.defenceDependent) {
      return res.status(400).json({ error: "Not eligible: Must be a ward of Armed Forces personnel." });
    }
    if (scholarship.eligibility.isCapfRequired && !user.capfDependent) {
      return res.status(400).json({ error: "Not eligible: Must be a ward of CAPF personnel." });
    }

    // CONFLICT VALIDATION: 1 Government Scholarship Rule
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

    // CREATE APPLICATION
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

    // ── SYNC TO USER PROFILE ──
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
