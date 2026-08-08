const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  title: { type: String, required: true },
  company: { type: String, required: true },
  location: { type: String, required: true },
  salary: { type: String, required: true },
  badge: { type: String, default: "New" },
  tags: [{ type: String }],
  desc: { type: String, required: true },
  primaryType: { type: String, enum: ['Internship', 'Job'], required: true },
  secondaryType: { type: String, enum: ['Paid', 'Free', 'Full-Time', 'Part-Time'], required: true },
  // New fields
  applyUrl: { type: String, default: "" },
  source: { type: String, enum: ['manual', 'web'], default: 'manual' },
  deadline: { type: String, default: "" },
  isAktu: { type: Boolean, default: false },
  companyLogo: { type: String, default: "" },
  experience: { type: String, default: "Fresher" },
}, { timestamps: true });

module.exports = mongoose.model('Job', jobSchema);
