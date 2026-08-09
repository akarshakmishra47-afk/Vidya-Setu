const mongoose = require('mongoose');

const perkSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  provider: { type: String, required: true },
  category: { type: String, required: true },
  discount: { type: String, required: true },
  eligibility: { type: String, default: 'Student' },
  instructions: { type: [String], default: [] },
  officialUrl: { type: String, required: true },
  icon: { type: String },
  color: { type: String },
  
  // Pipeline tracking
  source: { type: String, default: 'manual' },
  sourceId: { type: String },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  deduplicationKey: { type: String, unique: true }
}, { timestamps: true });

module.exports = mongoose.model('Perk', perkSchema);
