const mongoose = require('mongoose');

const scholarshipApplicationSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  scholarshipId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Scholarship',
    required: true
  },
  categoryApplied: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['Applied', 'Approved', 'Rejected'],
    default: 'Applied'
  },
  documents: [{
    type: String
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('ScholarshipApplication', scholarshipApplicationSchema);
