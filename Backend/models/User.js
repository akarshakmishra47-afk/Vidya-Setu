const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  rollNo: { type: String, required: true, unique: true },
  branch: { type: String, required: true },
  year: { type: String, required: true },
  email: { type: String, required: true },
  password: { type: String, required: true },
  scholarshipStage: { type: Number, default: 1 },
  dbt: { type: Boolean, default: false },
  ochk: { type: Object, default: { aadhaar:false, marksheet:false } },
  appliedJobs: { type: Array, default: [] },
  claimedPerks: [{ type: String }],
  tokens: { type: Number, default: 450 },
  // Additional scholarship profile settings
  casteCategory: { type: String, enum: ['SC', 'ST', 'OBC', 'General', 'EWS'], default: 'General' },
  familyIncome: { type: Number, default: 0 },
  isFeeWaiver: { type: Boolean, default: false },
  securityQuestion: { type: String, required: true },
  securityAnswer: { type: String, required: true },
  profilePhoto: { type: String, default: '' },
  mobileNumber: { type: String },
  // Profile edit lock — allow only one edit after registration
  profileEditedOnce: { type: Boolean, default: false },
  profileEditRequested: { type: Boolean, default: false },
  // TFW eligibility fields
  domicileState: { type: String, default: '' },
  hasIncomeCertificate: { type: Boolean, default: false },
  course: { type: String, default: 'B.Tech' },
  // Administrative fields
  role: { type: String, enum: ['student', 'super_admin'], default: 'student' },
  
  // Resume Intelligence and Links
  links: {
    type: [{ 
      type: { type: String }, 
      url: String, 
      label: String 
    }],
    default: []
  },
  resume: {
    url: { type: String },
    filename: { type: String },
    uploadDate: { type: Date }
  },
  resumeText: { type: String, default: '' },
  resumeAnalysis: { type: mongoose.Schema.Types.Mixed, default: null },
  tokenVersion: { type: Number, default: 0 }
});

module.exports = mongoose.model('User', userSchema);
