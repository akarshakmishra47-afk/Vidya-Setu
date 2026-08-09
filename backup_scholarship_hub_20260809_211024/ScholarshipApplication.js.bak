const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  scholarshipId: { type: mongoose.Schema.Types.ObjectId, ref: 'Scholarship', required: true },

  status: { type: String, enum: ['Applied', 'Approved', 'Rejected'], default: 'Applied' },

  // Documents mapped by document name (e.g., 'Income Certificate' -> 'base64_string')
  documents: { type: Object, default: {} },

  categoryApplied: { type: String }, // To quickly query 'Government' conflicts without deep population

  submittedAt: { type: Date, default: Date.now }
});

// Compound index to prevent duplicate applications for the same scholarship by same student
applicationSchema.index({ studentId: 1, scholarshipId: 1 }, { unique: true });

module.exports = mongoose.model('ScholarshipApplication', applicationSchema);
