const express = require('express');
const router = express.Router();
const User = require('../models/User');
const ProfileEditRequest = require('../models/ProfileEditRequest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { uploadImage, cloudinary } = require('../cloudinaryConfig');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const mongoose = require('mongoose');

const forgotPasswordAttempts = new Map();
const FORGOT_PW_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const FORGOT_PW_MAX_ATTEMPTS = 5;

/**
 * Checks if an IP has exceeded the forgot-password rate limit.
 * @param {string} ip - Client IP address.
 * @returns {boolean} True if allowed, false if rate limited.
 */
function checkForgotPasswordRateLimit(ip) {
  const now = Date.now();
  const entry = forgotPasswordAttempts.get(ip);
  if (!entry || now - entry.windowStart > FORGOT_PW_WINDOW_MS) {
    forgotPasswordAttempts.set(ip, { windowStart: now, count: 1 });
    return true;
  }
  if (entry.count >= FORGOT_PW_MAX_ATTEMPTS) {
    return false;
  }
  entry.count++;
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of forgotPasswordAttempts.entries()) {
    if (now - entry.windowStart > FORGOT_PW_WINDOW_MS) {
      forgotPasswordAttempts.delete(ip);
    }
  }
}, 30 * 60 * 1000);

const SAFE_USER_SELECT = '-password -securityAnswer -resumeBase64 -resumeText';

/**
 * Retrieves aggregate platform statistics for admin dashboard.
 * @route GET /api/users/admin/stats
 * @access Private/Admin
 */
router.get('/admin/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const totalEnrolled = await require('../models/AktuStudentOtr').countDocuments();
    const totalRegistered = await User.countDocuments();
    const profileEditRequests = await User.countDocuments({ profileEditRequested: true });

    const pendingScholarships = await require('../models/ScholarshipApplication').countDocuments({ status: 'Applied' });

    const totalPendingRequests = profileEditRequests + pendingScholarships;

    res.status(200).json({
      totalEnrolled,
      totalRegistered,
      totalPendingRequests,
      loginUpdateRequests: 0,
      profileUpdateRequests: profileEditRequests,
      otherRequests: pendingScholarships
    });
  } catch (error) {
    console.error('Admin stats error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch admin stats' });
  }
});

/**
 * Registers a new student user.
 * @route POST /api/users/register
 * @access Public
 */
router.post('/register', async (req, res) => {
  try {
    const { name, branch, year, email, password, securityQuestion, securityAnswer,
      mobileNumber, casteCategory, familyIncome, isFeeWaiver, domicileState,
      hasIncomeCertificate, course } = req.body;
      
    const rollNo = req.body.rollNo || email;

    if (!password || !securityAnswer) {
      return res.status(400).json({ success: false, message: "Password and Security Answer are required." });
    }
    if (!name || !branch || !year || !email || !securityQuestion) {
      return res.status(400).json({ success: false, message: "All required fields must be provided." });
    }
    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const hashedAnswer = await bcrypt.hash(securityAnswer, 10);

    const newUser = new User({
      name,
      rollNo,
      branch,
      year,
      email,
      password: hashedPassword,
      securityQuestion,
      securityAnswer: hashedAnswer,
      mobileNumber: mobileNumber || '',
      casteCategory: casteCategory || 'General',
      familyIncome: familyIncome || 0,
      isFeeWaiver: isFeeWaiver || false,
      domicileState: domicileState || '',
      hasIncomeCertificate: hasIncomeCertificate || false,
      course: course || 'B.Tech',
      approvalStatus: 'approved'
    });

    await newUser.save();

    const userResponse = newUser.toObject();
    delete userResponse.password;
    delete userResponse.securityAnswer;
    delete userResponse.resumeText;

    res.status(201).json({ message: "Registered successfully", user: userResponse });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: "Roll number already registered." });
    }
    console.error('Registration error:', error.message);
    res.status(400).json({ success: false, message: "Registration failed. Please check your input." });
  }
});

/**
 * Generates JWT access and refresh tokens for a user.
 * @param {Object} user - User document.
 * @returns {Object} { accessToken, refreshToken, isAdmin }
 */
const generateTokens = (user) => {
  const accessSecret = process.env.JWT_ACCESS_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;
  if (!accessSecret || !refreshSecret) {
    throw new Error('JWT secrets are not configured');
  }

  const isAdmin = user.role === 'super_admin';
  const payload = { userId: user._id, rollNo: user.rollNo, isAdmin };
  const accessToken = jwt.sign(payload, accessSecret, { expiresIn: '5m' });
  const refreshToken = jwt.sign(
    { userId: user._id, tokenVersion: user.tokenVersion },
    refreshSecret,
    { expiresIn: '30m' }
  );
  return { accessToken, refreshToken, isAdmin };
};

/**
 * Authenticates a user and issues tokens.
 * @route POST /api/users/login
 * @access Public
 */
router.post('/login', async (req, res) => {
  try {
    const email = req.body.email || req.body.rollNo;
    const password = req.body.password;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and Password are required." });
    }
    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ success: false, message: "Invalid input format." });
    }

    const user = await User.findOne({ $or: [{ email: email }, { rollNo: email }] });
    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid Credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password || "");
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid Credentials" });
    }

    const { accessToken, refreshToken, isAdmin } = generateTokens(user);

    const isProduction = process.env.NODE_ENV === 'production';
    const cookieOptions = (maxAge) => ({
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      maxAge
    });

    res.cookie('accessToken', accessToken, cookieOptions(5 * 60 * 1000));
    res.cookie('refreshToken', refreshToken, cookieOptions(30 * 60 * 1000));

    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.securityAnswer;
    delete userResponse.resumeText;
    userResponse.isAdmin = isAdmin;

    res.status(200).json({ user: userResponse, accessToken });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ success: false, message: "Login failed. Please try again." });
  }
});

/**
 * Refreshes an access token using a valid refresh token cookie.
 * @route GET /api/users/refresh
 * @access Public
 */
router.get('/refresh', async (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) return res.status(401).json({ success: false, message: "No refresh token" });

    const refreshSecret = process.env.JWT_REFRESH_SECRET;
    if (!refreshSecret) {
      console.error('FATAL: JWT_REFRESH_SECRET is not set');
      return res.status(500).json({ success: false, message: "Server configuration error" });
    }

    const payload = jwt.verify(token, refreshSecret);
    const user = await User.findById(payload.userId);

    if (!user || user.tokenVersion !== payload.tokenVersion) {
      return res.status(401).json({ success: false, message: "Invalid refresh token" });
    }

    const { accessToken, refreshToken, isAdmin } = generateTokens(user);

    const isProduction = process.env.NODE_ENV === 'production';
    const cookieOptions = (maxAge) => ({
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      maxAge
    });

    res.cookie('accessToken', accessToken, cookieOptions(5 * 60 * 1000));
    res.cookie('refreshToken', refreshToken, cookieOptions(30 * 60 * 1000));

    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.securityAnswer;
    delete userResponse.resumeText;
    userResponse.isAdmin = isAdmin;

    res.status(200).json({ user: userResponse, accessToken });
  } catch (error) {
    res.status(401).json({ success: false, message: "Token expired or invalid" });
  }
});

/**
 * Logs out a user and invalidates their refresh token.
 * @route POST /api/users/logout
 * @access Public
 */
router.post('/logout', async (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (token) {
      const refreshSecret = process.env.JWT_REFRESH_SECRET;
      if (refreshSecret) {
        const payload = jwt.verify(token, refreshSecret, { ignoreExpiration: true });
        await User.findByIdAndUpdate(payload.userId, { $inc: { tokenVersion: 1 } });
      }
    }
  } catch (e) {
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const clearOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax'
  };

  res.clearCookie('accessToken', clearOptions);
  res.clearCookie('refreshToken', clearOptions);
  res.status(200).json({ message: "Logged out" });
});

/**
 * Retrieves the security question for password reset.
 * @route GET /api/users/forgot-password/question/:email
 * @access Public
 */
router.get('/forgot-password/question/:email', async (req, res) => {
  try {
    if (!checkForgotPasswordRateLimit(req.ip)) {
      return res.status(429).json({ success: false, message: "Too many attempts. Please try again later." });
    }

    const email = req.params.email;
    if (!email || typeof email !== 'string' || email.length > 50) {
      return res.status(400).json({ success: false, message: "Invalid email." });
    }

    const user = await User.findOne({ $or: [{ email: email }, { rollNo: email }] });
    if (user) {
      user.securityQuestion = user.securityQuestion || "Security question not set";
    }
    if (!user || !user.securityQuestion) {
      return res.status(404).json({ success: false, message: "Unable to process request." });
    }

    res.json({ question: user.securityQuestion });
  } catch (error) {
    console.error('Forgot password question error:', error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * Resets a user's password using security question verification.
 * @route POST /api/users/forgot-password/reset
 * @access Public
 */
router.post('/forgot-password/reset', async (req, res) => {
  try {
    if (!checkForgotPasswordRateLimit(req.ip)) {
      return res.status(429).json({ success: false, message: "Too many attempts. Please try again later." });
    }

    const { email, rollNo, securityAnswer, newPassword } = req.body;
    const lookupEmail = email || rollNo;
    if (!lookupEmail || !securityAnswer || !newPassword) {
      return res.status(400).json({ success: false, message: "All fields are required." });
    }
    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters." });
    }

    const user = await User.findOne({ $or: [{ email: lookupEmail }, { rollNo: lookupEmail }] });
    if (!user) {
      return res.status(400).json({ success: false, message: "Unable to reset password." });
    }

    const isMatch = await bcrypt.compare(securityAnswer, user.securityAnswer || "");
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Verification failed." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    res.status(200).json({ success: true, message: "Password updated successfully!" });
  } catch (error) {
    console.error('Password reset error:', error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * Retrieves all registered users.
 * @route GET /api/users/all
 * @access Private/Admin
 */
router.get('/all', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await User.find({}).select('-password -securityAnswer -resumeBase64 -profilePhoto -resumeAnalysis -resumeText');
    res.status(200).json(users);
  } catch (error) {
    console.error('Fetch all users error:', error.message);
    res.status(500).json({ success: false, message: "Failed to fetch users" });
  }
});

/**
 * Retrieves a specific user by roll number.
 * @route GET /api/users/search/:rollNo
 * @access Private
 */
router.get('/search/:rollNo', authenticateToken, async (req, res) => {
  try {
    const user = await User.findOne({ rollNo: req.params.rollNo }).select(SAFE_USER_SELECT);
    if (!user) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }
    res.status(200).json(user);
  } catch (error) {
    console.error('Search user error:', error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * Retrieves a user's profile details.
 * @route GET /api/users/profile/:id
 * @access Private
 */
router.get('/profile/:id', authenticateToken, async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }

    if (!req.user.isAdmin && req.user.userId.toString() !== id) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const user = await User.findById(id).select(SAFE_USER_SELECT);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json(user);
  } catch (error) {
    console.error('Profile fetch error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * Verifies student identity via QR code scan.
 * @route GET /api/users/verify/:rollNo
 * @access Public
 */
router.get('/verify/:rollNo', async (req, res) => {
  try {
    const user = await User.findOne({ rollNo: req.params.rollNo }).select('name rollNo branch year course scholarshipStage');
    if (!user) return res.status(404).json({ success: false, message: 'Student not found' });

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
    console.error('Verify error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * Updates a user's profile details (allowed once).
 * @route PUT /api/users/update-profile
 * @access Private
 */
router.put('/update-profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ success: false, message: "Student not found" });

    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ success: false, message: "Password is required to save profile changes." });
    }
    const isMatch = await bcrypt.compare(password, user.password || "");
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Incorrect password. Profile not saved." });
    }

    if (user.profileEditedOnce) {
      return res.status(403).json({ success: false, message: "Profile can only be edited once. Your profile is now locked." });
    }

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
        return res.status(400).json({ success: false, message: "TFW Eligibility Failed", reasons: errors });
      }
    }

    const allowedFields = ['name', 'branch', 'year', 'mobileNumber', 'email', 'casteCategory', 'familyIncome', 'isFeeWaiver', 'domicileState', 'hasIncomeCertificate', 'course'];
    const updatePayload = { profileEditedOnce: true };
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) {
        updatePayload[key] = req.body[key];
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user.userId,
      { $set: updatePayload },
      { new: true }
    ).select(SAFE_USER_SELECT);
    res.status(200).json(updatedUser);
  } catch (error) {
    console.error('Update profile error:', error.message);
    res.status(500).json({ success: false, message: "Failed to update profile" });
  }
});

/**
 * Submits a request to edit a locked profile.
 * @route POST /api/users/request-profile-edit
 * @access Private
 */
router.post('/request-profile-edit', authenticateToken, async (req, res) => {
  try {
    const { requestedChanges, reason } = req.body;
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ success: false, message: "Student not found" });

    const newReq = new ProfileEditRequest({
      userId: user._id,
      requestedChanges: requestedChanges || {},
      reason: reason || ''
    });
    await newReq.save();

    await User.updateOne({ _id: user._id }, { $set: { profileEditRequested: true } });

    res.status(200).json({ success: true, message: "Profile edit request sent to admin." });
  } catch (error) {
    console.error('Request profile edit error:', error.message);
    res.status(500).json({ success: false, message: "Failed to submit request" });
  }
});

/**
 * Retrieves all pending profile edit requests.
 * @route GET /api/users/admin/profile-edit-requests
 * @access Private/Admin
 */
router.get('/admin/profile-edit-requests', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const requests = await ProfileEditRequest.find({}).populate('userId', 'name rollNo branch year email').sort({ requestedAt: -1 });
    res.status(200).json(requests);
  } catch (error) {
    console.error('Fetch profile edit requests error:', error.message);
    res.status(500).json({ success: false, message: "Failed to fetch requests" });
  }
});

/**
 * Approves a student's profile edit request.
 * @route POST /api/users/admin/approve-profile-edit
 * @access Private/Admin
 */
router.post('/admin/approve-profile-edit', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { requestId } = req.body;
    if (!requestId || !mongoose.Types.ObjectId.isValid(requestId)) {
      return res.status(400).json({ success: false, message: "Valid request ID required" });
    }

    const editReq = await ProfileEditRequest.findById(requestId);
    if (!editReq) return res.status(404).json({ success: false, message: "Request not found" });
    if (editReq.status !== 'Pending') return res.status(400).json({ success: false, message: "Request is not pending" });

    const user = await User.findById(editReq.userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const allowedFields = ['name', 'branch', 'year', 'mobileNumber', 'email', 'casteCategory', 'familyIncome', 'isFeeWaiver', 'domicileState', 'hasIncomeCertificate', 'course'];
    const updatePayload = {};
    for (const key of allowedFields) {
      if (editReq.requestedChanges[key] !== undefined) {
        updatePayload[key] = editReq.requestedChanges[key];
      }
    }

    updatePayload.profileEditedOnce = false;
    updatePayload.profileEditRequested = false;

    await User.updateOne({ _id: user._id }, { $set: updatePayload });

    editReq.status = 'Approved';
    editReq.reviewedAt = new Date();
    editReq.reviewedBy = 'Admin';
    await editReq.save();

    res.status(200).json({ success: true, message: "Profile edit approved successfully." });
  } catch (error) {
    console.error('Approve profile edit error:', error.message);
    res.status(500).json({ success: false, message: "Failed to approve request" });
  }
});

/**
 * Rejects a student's profile edit request.
 * @route POST /api/users/admin/reject-profile-edit
 * @access Private/Admin
 */
router.post('/admin/reject-profile-edit', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { requestId, rejectionReason } = req.body;
    if (!rejectionReason) return res.status(400).json({ success: false, message: "Rejection reason required" });
    if (!requestId || !mongoose.Types.ObjectId.isValid(requestId)) {
      return res.status(400).json({ success: false, message: "Valid request ID required" });
    }

    const editReq = await ProfileEditRequest.findById(requestId);
    if (!editReq) return res.status(404).json({ success: false, message: "Request not found" });
    if (editReq.status !== 'Pending') return res.status(400).json({ success: false, message: "Request is not pending" });

    editReq.status = 'Rejected';
    editReq.rejectionReason = rejectionReason;
    editReq.reviewedAt = new Date();
    editReq.reviewedBy = 'Admin';
    await editReq.save();

    await User.updateOne({ _id: editReq.userId }, { $set: { profileEditRequested: false } });

    res.status(200).json({ success: true, message: "Profile edit rejected." });
  } catch (error) {
    console.error('Reject profile edit error:', error.message);
    res.status(500).json({ success: false, message: "Failed to reject request" });
  }
});

/**
 * Updates a student's administrative status (scholarship, tokens, etc).
 * @route PUT /api/users/update-status
 * @access Private/Admin
 */
router.put('/update-status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rollNo, ...updates } = req.body;
    if (!rollNo) return res.status(400).json({ success: false, message: "Roll number required." });

    const user = await User.findOne({ rollNo });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const allowedStatusFields = ['scholarshipStage', 'dbt', 'ochk', 'tokens', 'claimedPerks'];
    const updatePayload = {};
    for (const key of allowedStatusFields) {
      if (updates[key] !== undefined) {
        updatePayload[key] = updates[key];
      }
    }

    if (updatePayload.ochk) {
      updatePayload.ochk = { ...user.ochk, ...updatePayload.ochk };
    }

    const updatedUser = await User.findOneAndUpdate({ rollNo }, { $set: updatePayload }, { new: true }).select(SAFE_USER_SELECT);
    res.status(200).json(updatedUser);
  } catch (error) {
    console.error('Update status error:', error.message);
    res.status(500).json({ success: false, message: "Failed to update status" });
  }
});

/**
 * Uploads and sets a user's profile photo.
 * @route PUT /api/users/upload-profile-photo
 * @access Private
 */
router.put('/upload-profile-photo', authenticateToken, async (req, res) => {
  try {
    const { photoData } = req.body;
    if (!photoData) {
      return res.status(400).json({ success: false, message: "Photo data is required." });
    }

    const photoUrl = await uploadImage(photoData);

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $set: { profilePhoto: photoUrl } },
      { new: true }
    ).select(SAFE_USER_SELECT);

    if (!user) return res.status(404).json({ success: false, message: "Student not found" });

    res.status(200).json({ success: true, profilePhoto: photoUrl, user });
  } catch (error) {
    console.error('Profile photo upload error:', error.message);
    res.status(500).json({ success: false, message: "Failed to upload profile photo" });
  }
});

/**
 * Updates a user's portfolio/social links.
 * @route PUT /api/users/profile/links
 * @access Private
 */
router.put('/profile/links', authenticateToken, async (req, res) => {
  try {
    const { links } = req.body;
    if (!links || !Array.isArray(links)) {
      return res.status(400).json({ success: false, message: 'Links array is required.' });
    }
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $set: { links } },
      { new: true }
    ).select(SAFE_USER_SELECT);
    if (!user) return res.status(404).json({ success: false, message: 'Student not found' });
    res.status(200).json({ success: true, links: user.links, user });
  } catch (error) {
    console.error('Update links error:', error.message);
    res.status(500).json({ success: false, message: "Failed to update links" });
  }
});

const multer = require('multer');
const pdfParse = require('pdf-parse');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed!'), false);
    }
  }
});

const fs = require('fs');

/**
 * Middleware to handle PDF resume uploads via Multer.
 */
const handleUpload = (req, res, next) => {
  upload.single('resume')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      console.error(`MulterError: ${err.message}`);
      return res.status(400).json({ success: false, error: `Upload error: ${err.message}` });
    } else if (err) {
      console.error(`Upload Error: ${err.message}`);
      return res.status(400).json({ success: false, error: err.message });
    }
    next();
  });
};

/**
 * Uploads a resume PDF, parses text, and stores securely.
 * @route PUT /api/users/profile/resume/upload
 * @access Private
 */
router.put('/profile/resume/upload', authenticateToken, handleUpload, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No PDF file uploaded.' });

    const originalName = req.file.originalname || '';
    if (!originalName.toLowerCase().endsWith('.pdf')) {
      return res.status(400).json({ success: false, error: 'Only PDF files are allowed.' });
    }

    let extractedText = '';
    try {
      const pdfData = await pdfParse(req.file.buffer);
      extractedText = pdfData.text;
    } catch (parseErr) {
      console.error('PDF Parse Error:', parseErr.message);
      return res.status(400).json({ success: false, error: 'Failed to extract text from PDF. Ensure the file is not corrupted or image-based.' });
    }

    let resumeUrl = '';
    try {
      const b64 = req.file.buffer.toString('base64');
      const dataUri = `data:application/pdf;base64,${b64}`;
      const uploadResult = await cloudinary.uploader.upload(dataUri, {
        resource_type: 'raw',
        folder: 'vidyasetu_resumes',
        public_id: `resume_${req.user.userId}_${Date.now()}`
      });
      resumeUrl = uploadResult.secure_url;
    } catch (uploadErr) {
      console.error('Cloudinary resume upload error:', uploadErr.message);
      resumeUrl = '';
    }

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      {
        $set: {
          resume: {
            url: resumeUrl,
            filename: req.file.originalname,
            uploadDate: new Date()
          },
          resumeText: extractedText
        }
      },
      { new: true, strict: false }
    ).select(SAFE_USER_SELECT);

    if (!user) return res.status(404).json({ success: false, error: 'Student not found' });
    res.status(200).json({ success: true, resume: user.resume, user });
  } catch (error) {
    if (error.message === 'Only PDF files are allowed!') {
      return res.status(400).json({ success: false, error: error.message });
    }
    console.error('Resume upload error:', error.message);
    res.status(500).json({ success: false, error: "Failed to upload resume" });
  }
});

/**
 * Deletes a user's uploaded resume.
 * @route DELETE /api/users/profile/resume
 * @access Private
 */
router.delete('/profile/resume', authenticateToken, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $unset: { resume: '', resumeAnalysis: '', resumeText: '' } },
      { new: true, strict: false }
    ).select(SAFE_USER_SELECT);
    if (!user) return res.status(404).json({ success: false, message: 'Student not found' });
    res.status(200).json({ success: true, message: 'Resume deleted', user });
  } catch (error) {
    console.error('Resume delete error:', error.message);
    res.status(500).json({ success: false, message: "Failed to delete resume" });
  }
});

module.exports = router;
