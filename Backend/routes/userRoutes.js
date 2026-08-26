const express = require('express');
const router = express.Router();
const User = require('../models/User');
const ProfileEditRequest = require('../models/ProfileEditRequest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { uploadImage } = require('../cloudinaryConfig');

// GET /api/users/admin/stats
router.get('/admin/stats', async (req, res) => {
  try {
    const totalEnrolled = await require('../models/AktuStudentOtr').countDocuments();
    const totalRegistered = await User.countDocuments();
    const profileEditRequests = await User.countDocuments({ profileEditRequested: true });
    
    // Check if there's any other pending requests from ScholarshipApplication
    const pendingScholarships = await require('../models/ScholarshipApplication').countDocuments({ status: 'Applied' });
    
    // total requests = profileEditRequests + pendingScholarships
    const totalPendingRequests = profileEditRequests + pendingScholarships;
    
    res.status(200).json({
      totalEnrolled,
      totalRegistered,
      totalPendingRequests,
      loginUpdateRequests: 0, // Placeholder
      profileUpdateRequests: profileEditRequests,
      otherRequests: pendingScholarships
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST route /register to save a student with hashed credentials
router.post('/register', async (req, res) => {
  try {
    const { password, securityAnswer, role } = req.body;
    if (!password || !securityAnswer) {
      return res.status(400).json({ error: "Password and Security Answer are required." });
    }

    // Hash the password and security answer for safety
    const hashedPassword = await bcrypt.hash(password, 10);
    const hashedAnswer = await bcrypt.hash(securityAnswer, 10);

    const approvalStatus = 'approved';

    const newUser = new User({
      ...req.body,
      password: hashedPassword,
      securityAnswer: hashedAnswer,
      approvalStatus
    });

    await newUser.save();
    
    const userResponse = newUser.toObject();
    delete userResponse.password;
    delete userResponse.securityAnswer;
    
    res.status(201).json({ message: "Registered successfully", user: userResponse });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET route /all to retrieve all students
router.get('/all', async (req, res) => {
  try {
    const users = await User.find({}).select('-password -securityAnswer -resumeBase64 -profilePhoto -resumeAnalysis');
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper to generate tokens
const generateTokens = (user) => {
  const payload = { userId: user._id, rollNo: user.rollNo, isAdmin: user.email === 'vidyasetu@aktu.ac.in' };
  const accessToken = jwt.sign(payload, process.env.JWT_ACCESS_SECRET || 'secret_access', { expiresIn: '5m' });
  const refreshToken = jwt.sign({ userId: user._id, tokenVersion: user.tokenVersion }, process.env.JWT_REFRESH_SECRET || 'secret_refresh', { expiresIn: '30m' });
  return { accessToken, refreshToken };
};

// POST route /login to authenticate a student using bcrypt
router.post('/login', async (req, res) => {
  try {
    const { rollNo, password } = req.body;
    if (!rollNo || !password) {
      return res.status(400).json({ error: "Roll Number and Password are required." });
    }
    
    const user = await User.findOne({ rollNo });
    if (!user) {
      return res.status(401).json({ error: "Invalid Credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password || "");
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid Credentials" });
    }
    
    const { accessToken, refreshToken } = generateTokens(user);
    
    // Set refresh token in httpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 30 * 60 * 1000 // 30 minutes
    });

    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.securityAnswer;
    userResponse.isAdmin = user.email === 'vidyasetu@aktu.ac.in';
    
    res.status(200).json({ user: userResponse, accessToken });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET route /refresh to renew access token using refresh cookie
router.get('/refresh', async (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) return res.status(401).json({ error: "No refresh token" });

    const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET || 'secret_refresh');
    const user = await User.findById(payload.userId);
    
    if (!user || user.tokenVersion !== payload.tokenVersion) {
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    // Issue new tokens (Sliding expiration: keeps them logged in if active)
    const { accessToken, refreshToken } = generateTokens(user);
    
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 30 * 60 * 1000 // 30 minutes
    });

    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.securityAnswer;
    userResponse.isAdmin = user.email === 'vidyasetu@aktu.ac.in';

    res.status(200).json({ user: userResponse, accessToken });
  } catch (error) {
    res.status(401).json({ error: "Token expired or invalid" });
  }
});

// POST route /logout to invalidate refresh token
router.post('/logout', async (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (token) {
      const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET || 'secret_refresh', { ignoreExpiration: true });
      await User.findByIdAndUpdate(payload.userId, { $inc: { tokenVersion: 1 } });
    }
  } catch (e) {
    // ignore verification errors on logout
  }
  res.clearCookie('refreshToken');
  res.status(200).json({ message: "Logged out" });
});

// FORGOT PASSWORD: Get security question by roll number
router.get('/forgot-password/question/:rollNo', async (req, res) => {
  try {
    const user = await User.findOne({ rollNo: req.params.rollNo });
    if (!user) return res.status(404).json({ error: "Student not found" });
    if (!user.securityQuestion) return res.status(400).json({ error: "No security question set for this user." });
    
    res.json({ question: user.securityQuestion });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// FORGOT PASSWORD: Reset password after verifying security answer
router.post('/forgot-password/reset', async (req, res) => {
  try {
    const { rollNo, securityAnswer, newPassword } = req.body;
    if (!rollNo || !securityAnswer || !newPassword) {
      return res.status(400).json({ error: "All fields are required." });
    }

    const user = await User.findOne({ rollNo });
    if (!user) return res.status(404).json({ error: "Student not found" });

    const isMatch = await bcrypt.compare(securityAnswer, user.securityAnswer || "");
    if (!isMatch) return res.status(401).json({ error: "Incorrect Security Answer" });

    // Hash the new password before saving
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    
    await user.save();
    res.status(200).json({ success: true, message: "Password updated successfully!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET route /search/:rollNo to find a student by roll number
router.get('/search/:rollNo', async (req, res) => {
  try {
    const user = await User.findOne({ rollNo: req.params.rollNo }).select('-password -securityAnswer');
    if (!user) {
      return res.status(404).json({ error: "Student not found" });
    }
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET Student Profile by ID
router.get('/profile/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password -securityAnswer');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET verify digital ID via QR code
router.get('/verify/:rollNo', async (req, res) => {
  try {
    const user = await User.findOne({ rollNo: req.params.rollNo }).select('name rollNo branch year course scholarshipStage');
    if (!user) return res.status(404).json({ success: false, error: 'Student not found' });
    
    res.json({
      success: true,
      data: {
        studentId: user.rollNo,
        name: user.name,
        college: 'AKTU Affiliated College',
        branch: user.branch,
        year: user.year,
        course: user.course || 'B.Tech',
        status: user.scholarshipStage > 1 ? 'Verified' : 'Pending Verification',
        validity: 'Valid till 2028'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// PUT route /update-profile to edit profile (ONE-TIME only)
router.put('/update-profile', async (req, res) => {
  try {
    const user = await User.findOne({ rollNo: req.body.rollNo });
    if (!user) return res.status(404).json({ error: "Student not found" });

    // ── PASSWORD VERIFICATION ──
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ error: "Password is required to save profile changes." });
    }
    const isMatch = await bcrypt.compare(password, user.password || "");
    if (!isMatch) {
      return res.status(401).json({ error: "Incorrect password. Profile not saved." });
    }

    // ── ONE-TIME EDIT GUARD ──
    if (user.profileEditedOnce) {
      return res.status(403).json({ error: "Profile can only be edited once. Your profile is now locked." });
    }

    // ── TFW ELIGIBILITY VALIDATION (server-side) ──
    if (req.body.isFeeWaiver) {
      const income = parseInt(req.body.familyIncome) || 0;
      const domicile = req.body.domicileState || '';
      const hasIncomeCert = !!req.body.hasIncomeCertificate;
      const course = req.body.course || '';

      const errors = [];
      if (income >= 600000) {
        errors.push(`Annual family income (₹${income.toLocaleString()}) must be less than ₹6,00,000.`);
      }
      if (domicile !== 'Uttar Pradesh') {
        errors.push('TFW is available only for Uttar Pradesh domicile students.');
      }
      if (!hasIncomeCert) {
        errors.push('A valid Income Certificate is required for TFW.');
      }
      if (course === 'B.Arch') {
        errors.push('TFW is not available for B.Arch courses.');
      }
      if (errors.length > 0) {
        return res.status(400).json({ error: "TFW Eligibility Failed", reasons: errors });
      }
    }

    // ── APPLY UPDATE + LOCK ──
    const allowedFields = ['name', 'branch', 'year', 'mobileNumber', 'email', 'casteCategory', 'familyIncome', 'isFeeWaiver', 'domicileState', 'hasIncomeCertificate', 'course'];
    const updatePayload = { profileEditedOnce: true };
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) {
        updatePayload[key] = req.body[key];
      }
    }

    const updatedUser = await User.findOneAndUpdate(
      { rollNo: req.body.rollNo },
      { $set: updatePayload },
      { new: true }
    ).select('-password -securityAnswer');
    res.status(200).json(updatedUser);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST route /request-profile-edit
router.post('/request-profile-edit', async (req, res) => {
  try {
    const { rollNo, requestedChanges, reason } = req.body;
    const user = await User.findOne({ rollNo });
    if (!user) return res.status(404).json({ error: "Student not found" });
    
    const newReq = new ProfileEditRequest({
      userId: user._id,
      requestedChanges: requestedChanges || {},
      reason: reason || ''
    });
    await newReq.save();
    
    // Set flag so UI knows request is pending
    await User.updateOne({ rollNo }, { $set: { profileEditRequested: true } });
    
    res.status(200).json({ success: true, message: "Profile edit request sent to admin." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET route /admin/profile-edit-requests
router.get('/admin/profile-edit-requests', async (req, res) => {
  try {
    const requests = await ProfileEditRequest.find({}).populate('userId', 'name rollNo branch year email').sort({ requestedAt: -1 });
    res.status(200).json(requests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST route /admin/approve-profile-edit
router.post('/admin/approve-profile-edit', async (req, res) => {
  try {
    const { requestId } = req.body;
    const editReq = await ProfileEditRequest.findById(requestId);
    if (!editReq) return res.status(404).json({ error: "Request not found" });
    if (editReq.status !== 'Pending') return res.status(400).json({ error: "Request is not pending" });
    
    const user = await User.findById(editReq.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const allowedFields = ['name', 'branch', 'year', 'mobileNumber', 'email', 'casteCategory', 'familyIncome', 'isFeeWaiver', 'domicileState', 'hasIncomeCertificate', 'course'];
    const updatePayload = {};
    for (const key of allowedFields) {
      if (editReq.requestedChanges[key] !== undefined) {
        updatePayload[key] = editReq.requestedChanges[key];
      }
    }
    
    // We unlock the profile when approving so they can edit again, or just apply the fields
    // The instructions say "Apply ONLY approved requested fields... After approval, the student's profile editing ability may be restored"
    // We will set profileEditedOnce to false so they can edit again.
    updatePayload.profileEditedOnce = false;
    updatePayload.profileEditRequested = false;

    await User.updateOne({ _id: user._id }, { $set: updatePayload });
    
    editReq.status = 'Approved';
    editReq.reviewedAt = new Date();
    editReq.reviewedBy = 'Admin';
    await editReq.save();
    
    res.status(200).json({ success: true, message: "Profile edit approved successfully." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST route /admin/reject-profile-edit
router.post('/admin/reject-profile-edit', async (req, res) => {
  try {
    const { requestId, rejectionReason } = req.body;
    if (!rejectionReason) return res.status(400).json({ error: "Rejection reason required" });
    
    const editReq = await ProfileEditRequest.findById(requestId);
    if (!editReq) return res.status(404).json({ error: "Request not found" });
    if (editReq.status !== 'Pending') return res.status(400).json({ error: "Request is not pending" });
    
    editReq.status = 'Rejected';
    editReq.rejectionReason = rejectionReason;
    editReq.reviewedAt = new Date();
    editReq.reviewedBy = 'Admin';
    await editReq.save();
    
    // Remove the pending flag from the user so they can submit another one
    await User.updateOne({ _id: editReq.userId }, { $set: { profileEditRequested: false } });
    
    res.status(200).json({ success: true, message: "Profile edit rejected." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT route /update-status
router.put('/update-status', async (req, res) => {
  try {
    const { rollNo, ...updates } = req.body;
    if (!rollNo) return res.status(400).json({ error: "Roll number strictly required." });
    
    const user = await User.findOne({ rollNo });
    if(!user) return res.status(404).json({ error: "User not found" });

    const allowedStatusFields = ['scholarshipStage', 'dbt', 'ochk', 'tokens', 'claimedPerks'];
    const updatePayload = {};
    for (const key of allowedStatusFields) {
      if (updates[key] !== undefined) {
        updatePayload[key] = updates[key];
      }
    }

    if(updatePayload.ochk) {
       updatePayload.ochk = { ...user.ochk, ...updatePayload.ochk };
    }
    
    const updatedUser = await User.findOneAndUpdate({ rollNo }, { $set: updatePayload }, { new: true }).select('-password -securityAnswer');
    res.status(200).json(updatedUser);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT route /upload-profile-photo to upload profile photo to Cloudinary
router.put('/upload-profile-photo', async (req, res) => {
  try {
    const { rollNo, photoData } = req.body;
    if (!rollNo || !photoData) {
      return res.status(400).json({ error: "Roll number and photo data are required." });
    }

    // Upload to Cloudinary
    const photoUrl = await uploadImage(photoData);
    console.log('✅ Profile photo uploaded to Cloudinary:', photoUrl);

    // Save URL to user profile
    const user = await User.findOneAndUpdate(
      { rollNo },
      { $set: { profilePhoto: photoUrl } },
      { new: true }
    ).select('-password -securityAnswer');

    if (!user) return res.status(404).json({ error: "Student not found" });

    res.status(200).json({ success: true, profilePhoto: photoUrl, user });
  } catch (error) {
    console.error('❌ Profile photo upload error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// PUT route /profile/links to update links
router.put('/profile/links', async (req, res) => {
  try {
    const { rollNo, links } = req.body;
    if (!rollNo || !links) {
      return res.status(400).json({ error: 'Roll number and links are required.' });
    }
    const user = await User.findOneAndUpdate(
      { rollNo },
      { $set: { links } },
      { new: true }
    ).select('-password -securityAnswer');
    if (!user) return res.status(404).json({ error: 'Student not found' });
    res.status(200).json({ success: true, links: user.links, user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload resume
const multer = require('multer');
const pdfParse = require('pdf-parse');
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed!'), false);
    }
  }
});

router.put('/profile/resume/upload', upload.single('resume'), async (req, res) => {
  try {
    const { rollNo } = req.body;
    if (!rollNo) return res.status(400).json({ error: 'Roll number required.' });
    if (!req.file) return res.status(400).json({ error: 'No PDF file uploaded.' });
    
    let extractedText = '';
    try {
      const pdfData = await pdfParse(req.file.buffer);
      extractedText = pdfData.text;
    } catch (parseErr) {
      console.error('PDF Parse Error:', parseErr);
      return res.status(400).json({ error: 'Failed to extract text from PDF. Ensure the file is not corrupted or image-based.' });
    }
    
    const fakeUrl = 'https://vidyasetu-storage.example.com/resumes/' + Date.now() + '.pdf';

    const user = await User.findOneAndUpdate(
      { rollNo },
      { 
        $set: { 
          resume: { 
            url: fakeUrl, 
            filename: req.file.originalname, 
            uploadDate: new Date() 
          },
          resumeText: extractedText // store temporarily for analyze endpoint
        } 
      },
      { new: true, strict: false }
    ).select('-password -securityAnswer');
    
    if (!user) return res.status(404).json({ error: 'Student not found' });
    res.status(200).json({ success: true, resume: user.resume, user });
  } catch (error) {
    if (error.message === 'Only PDF files are allowed!') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

router.delete('/profile/resume', async (req, res) => {
  try {
    const { rollNo } = req.body;
    if (!rollNo) return res.status(400).json({ error: 'Roll number required.' });
    const user = await User.findOneAndUpdate(
      { rollNo },
      { $unset: { resume: '', resumeAnalysis: '', resumeText: '' } },
      { new: true, strict: false }
    ).select('-password -securityAnswer');
    if (!user) return res.status(404).json({ error: 'Student not found' });
    res.status(200).json({ success: true, message: 'Resume deleted', user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

