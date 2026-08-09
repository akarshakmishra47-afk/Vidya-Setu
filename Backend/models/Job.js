const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  // ── Core Fields ────────────────────────────────────────────────────────────
  title:    { type: String, required: true },
  company:  { type: String, required: true },
  location: { type: String, required: true },
  salary:   { type: String, default: 'Not specified' },
  badge:    { type: String, default: 'New' },
  tags:     [{ type: String }],
  desc:     { type: String, default: '' },

  // ── Primary Classification ─────────────────────────────────────────────────
  primaryType: {
    type: String,
    enum: ['Internship', 'Job', 'Hackathon'],
    required: true
  },

  // secondaryType:
  //   Jobs       → 'Full-Time' | 'Part-Time'
  //   Internships→ 'Paid' | 'Free' | 'Unknown'
  //   Hackathons → 'Online' | 'Offline' | 'Hybrid' | 'Unknown'
  secondaryType: {
    type: String,
    enum: ['Paid', 'Free', 'Unknown', 'Full-Time', 'Part-Time', 'Online', 'Offline', 'Hybrid'],
    default: 'Unknown'
  },

  // Category for filtering
  category: {
    type: String,
    enum: [
      'Government', 'Private', 'IT', 'Engineering',
      'Internship', 'Hackathon', 'Fresher', 'Product', 'Service', 'Other'
    ],
    default: 'Other'
  },

  // Government sub-classification (only when category=Government)
  govtCategory: {
    type: String,
    enum: ['Central', 'State', 'PSU', 'Defence', 'Railway', 'Banking', 'Other', 'Unknown'],
    default: 'Unknown'
  },

  // ── B.Tech Branch Classification ───────────────────────────────────────────
  branch: {
    type: String,
    enum: [
      'CSE', 'IT', 'AI/ML', 'Data Science',
      'ECE', 'EEE', 'EE',
      'Mechanical', 'Civil', 'Chemical',
      'Automobile', 'Aerospace', 'Biotechnology', 'Biomedical',
      'Production', 'Industrial', 'Mechatronics', 'Robotics',
      'Instrumentation', 'Environmental', 'Metallurgy', 'Materials',
      'General Engineering', 'Other'
    ],
    default: 'General Engineering'
  },

  // ── Experience Level ───────────────────────────────────────────────────────
  experienceLevel: {
    type: String,
    enum: ['Fresher', 'Entry-Level', 'Junior', 'Experienced', 'Unknown'],
    default: 'Unknown'
  },

  // ── Company Classification ─────────────────────────────────────────────────
  companyType: {
    type: String,
    enum: ['product', 'service', 'government', 'unknown'],
    default: 'unknown'
  },

  // ── Application & Source Metadata ─────────────────────────────────────────
  applyUrl:   { type: String, default: '' },
  source:     {
    type: String,
    enum: ['manual', 'web', 'remotive', 'arbeitnow', 'himalayas', 'govtRss', 'hackathon'],
    default: 'manual'
  },
  sourceId:   { type: String, default: '' },
  sourceUrl:  { type: String, default: '' },

  // ── Dates ─────────────────────────────────────────────────────────────────
  postedAt:   { type: Date, default: null },
  expiresAt:  { type: Date, default: null },
  deadline:   { type: String, default: 'Not specified' },

  // ── Other Metadata ────────────────────────────────────────────────────────
  experience:   { type: String, default: 'Fresher' },
  companyLogo:  { type: String, default: '' },
  isAktu:       { type: Boolean, default: false },

  // ── India Location Validation ─────────────────────────────────────────────
  isIndiaLocation: { type: Boolean, default: false },
  indiaRegion:     { type: String, default: '' },

  // ── Hackathon-specific Fields ─────────────────────────────────────────────
  hackathonOrganizer:   { type: String, default: '' },
  hackathonStartDate:   { type: Date,   default: null },
  hackathonEndDate:     { type: Date,   default: null },
  hackathonRegistrationDeadline: { type: Date, default: null },
  hackathonEligibility: { type: String, default: '' },
  hackathonMode:        { type: String, enum: ['Online', 'Offline', 'Hybrid', 'Unknown'], default: 'Unknown' },
  hackathonTechDomain:  { type: String, default: '' },

  // ── Deduplication ─────────────────────────────────────────────────────────
  deduplicationKey: { type: String, index: true, unique: true, sparse: true, default: '' },

  // ── Scoring & Housekeeping ────────────────────────────────────────────────
  relevanceScore: { type: Number, default: 0 },
  fetchedAt:      { type: Date,   default: Date.now },

}, { timestamps: true });

module.exports = mongoose.model('Job', jobSchema);
