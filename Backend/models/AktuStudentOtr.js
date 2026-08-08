const mongoose = require('mongoose');

const aktuStudentOtrSchema = new mongoose.Schema({
  studentId: { type: String, unique: true }, // System generated
  aadhaarNumber: { type: String, unique: true },
  fullName: { type: String }, // Fetched via mock DigiLocker (Read-only)
  dob: { type: String }, // Fetched via mock DigiLocker (Read-only)
  mobileNumber: { type: String }, // Aadhaar-linked number
  category: { type: String, enum: ['General', 'OBC', 'SC', 'ST', 'Minority'] },
  securityPin: { type: String }, // Hashed 6-digit PIN/Password
  otrStatus: { type: Boolean, default: false } // True if One-Time Registration is locked
});

module.exports = mongoose.model('AktuStudentOtr', aktuStudentOtrSchema);
