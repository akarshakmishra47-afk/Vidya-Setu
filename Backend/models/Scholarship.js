const mongoose = require('mongoose');

const scholarshipSchema = new mongoose.Schema({
  title: { type: String, required: true },
  provider: { type: String, required: true },
  category: { type: String, enum: ['Government', 'Institute', 'Private/NGO', 'Defence', 'CAPF'], required: true },
  amount: { type: String, required: true },
  deadline: { type: String, required: true },
  description: { type: String, required: true },
  
  // Official portal redirect URL
  officialUrl: { type: String, default: 'https://scholarships.gov.in' },
  
  // Step-by-step application guide shown before redirect
  howToApply: { type: [String], default: [] },

  // Searchable tags
  tags: { type: [String], default: [] },

  // Pipeline fields
  deduplicationKey: { type: String, unique: true },
  source: { type: String, required: true },
  sourceId: { type: String },
  status: { type: String, enum: ['active', 'stale'], default: 'active' },
  lastVerifiedAt: { type: Date, default: Date.now },

  // Show/hide in listing (manual override if needed)
  isActive: { type: Boolean, default: true },
  
  // Eligibility criteria embedded rules
  eligibility: {
    maxIncome: { type: Number, default: 99999999 }, // Used for need-based validation
    allowedCategories: { type: [String], default: ['General', 'OBC', 'SC', 'ST', 'EWS'] },
    isDefenceRequired: { type: Boolean, default: false },
    isCapfRequired: { type: Boolean, default: false },
  },

  documentsRequired: { type: [String], default: ['Income Certificate', 'Aadhaar'] }
}, { timestamps: true });

module.exports = mongoose.model('Scholarship', scholarshipSchema);
