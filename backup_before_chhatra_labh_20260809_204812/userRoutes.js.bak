const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { uploadImage } = require('../cloudinaryConfig');

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
    res.status(201).json({ message: "Registered successfully", user: newUser });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET route /all to retrieve all students
router.get('/all', async (req, res) => {
  try {
    const users = await User.find({});
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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
    
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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
    const user = await User.findOne({ rollNo: req.params.rollNo });
    if (!user) {
      return res.status(404).json({ error: "Student not found" });
    }
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    const updatePayload = { ...req.body, profileEditedOnce: true };
    delete updatePayload.rollNo; // don't overwrite rollNo

    const updatedUser = await User.findOneAndUpdate(
      { rollNo: req.body.rollNo },
      { $set: updatePayload },
      { new: true }
    );
    res.status(200).json(updatedUser);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST route /request-profile-unlock
router.post('/request-profile-unlock', async (req, res) => {
  try {
    const { rollNo } = req.body;
    const user = await User.findOneAndUpdate(
      { rollNo },
      { $set: { profileEditRequested: true } },
      { new: true }
    );
    if (!user) return res.status(404).json({ error: "Student not found" });
    res.status(200).json({ success: true, message: "Profile edit request sent to admin." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST route /approve-profile-unlock
router.post('/approve-profile-unlock', async (req, res) => {
  try {
    const { rollNo } = req.body;
    // Approving the unlock: reset the lock and the request flag
    const user = await User.findOneAndUpdate(
      { rollNo },
      { $set: { profileEditedOnce: false, profileEditRequested: false } },
      { new: true }
    );
    if (!user) return res.status(404).json({ error: "Student not found" });
    res.status(200).json({ success: true, message: "Profile unlocked successfully." });
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

    if(updates.ochk) {
       updates.ochk = { ...user.ochk, ...updates.ochk };
    }
    
    const updatedUser = await User.findOneAndUpdate({ rollNo }, { $set: updates }, { new: true });
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
    );

    if (!user) return res.status(404).json({ error: "Student not found" });

    res.status(200).json({ success: true, profilePhoto: photoUrl, user });
  } catch (error) {
    console.error('❌ Profile photo upload error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

