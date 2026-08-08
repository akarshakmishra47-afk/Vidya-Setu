const mongoose = require('mongoose');

const aktuScholarshipApplicationSchema = new mongoose.Schema({
  applicationNumber: { type: String, unique: true }, // Generated tracking number
  studentReference: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  applicationStatus: { type: String, enum: ['Draft', 'Locked_by_Student', 'Verified_by_Institute', 'Rejected_by_Institute', 'Forwarded_to_District', 'Rejected'], default: 'Draft' },
  instituteRemark: { type: String },
  
  // Institutional Details
  districtOfCollege: { type: String },
  collegeName: { type: String }, // Or AKTU Code
  
  // Academic Details
  courseName: { type: String },
  branch: { type: String },
  entryMode: { type: String, enum: ['Regular', 'Lateral Entry'] },
  currentYearOfStudy: { type: String },
  enrollmentNumber: { type: String },
  admissionCounselingDetails: {
    rollNumber: { type: String },
    rank: { type: String }
  },
  
  // Past Education
  highSchool: {
    board: { type: String },
    passingYear: { type: String },
    rollNumber: { type: String },
    marksObtained: { type: Number },
    totalMarks: { type: Number }
  },
  intermediate: {
    board: { type: String },
    passingYear: { type: String },
    rollNumber: { type: String },
    marksObtained: { type: Number },
    totalMarks: { type: Number }
  },
  
  // Financial & Document Details
  nonRefundableFeeAmount: { type: Number },
  incomeCertificate: {
    number: { type: String },
    applicationNumber: { type: String }
  },
  casteCertificate: {
    number: { type: String },
    applicationNumber: { type: String }
  },
  documents: {
    passportPhoto: { type: String },
    incomeCertificate: { type: String },
    tenthMarksheet: { type: String },
    twelfthMarksheet: { type: String },
    feeReceipt: { type: String }
  },
  // Timestamps
  draftSavedAt: { type: Date, default: Date.now },
  finalLockedAt: { type: Date }
});

module.exports = mongoose.model('AktuScholarshipApplication', aktuScholarshipApplicationSchema);
