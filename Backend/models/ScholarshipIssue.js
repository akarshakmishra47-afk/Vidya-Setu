const mongoose = require('mongoose');

const scholarshipIssueSchema = new mongoose.Schema({
  title: { type: String, required: true },
  desc: { type: String, required: true },
  icon: { type: String, default: "help_outline" },
  steps: {
    type: [[String]],
    default: [
      ["1", "Issue Logged", "Your problem has been securely reported to our administrators."],
      ["2", "Under Investigation", "The Vidya Setu team is researching a step-by-step fix."],
      ["3", "Check Back Soon", "A verified guide will be published here shortly."]
    ]
  },
  status: { type: String, enum: ['Under Investigation', 'Resolved', 'Logged'], default: 'Logged' },
}, { timestamps: true });

module.exports = mongoose.model('ScholarshipIssue', scholarshipIssueSchema);
