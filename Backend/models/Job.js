const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  // Core fields
  title: { type: String, required: true },
  company: { type: String, required: true },
  location: { type: String, required: true },
  salary: { type: String, default: "Not specified" },
  badge: { type: String, default: "New" },
  tags: [{ type: String }],
  desc: { type: String, default: "" },
  
  // Job Classification
  primaryType: { type: String, enum: ['Internship', 'Job'], required: true },
  secondaryType: { type: String, enum: ['Paid', 'Free', 'Full-Time', 'Part-Time'], required: true },
  jobCategory: { type: String, enum: ['internship', 'fresher-job', 'engineering-job', 'other'], default: 'other' },
  
  // Branch Classification (All B.Tech branches supported)
  branch: { 
    type: String, 
    enum: [
      'CSE', 'IT', 'ECE', 'EE', 'EEE', 'Mechanical', 'Civil', 'Chemical',
      'Aerospace', 'Automobile', 'Instrumentation', 'Production', 'Industrial',
      'Biotechnology', 'Biomedical', 'Mechatronics', 'Robotics', 'AI/ML',
      'Data Science', 'General Engineering', 'Other'
    ],
    default: 'General Engineering'
  },
  
  // Company Classification
  companyType: { type: String, enum: ['product', 'service', 'unknown'], default: 'unknown' },
  
  // Application & Metadata
  applyUrl: { type: String, default: "" },
  source: { type: String, enum: ['manual', 'web', 'remotive', 'arbeitnow'], default: 'manual' },
  sourceId: { type: String, default: "" },  // External job ID from API
  sourceUrl: { type: String, default: "" },  // Original source URL
  deadline: { type: String, default: "Not specified" },
  experience: { type: String, default: "Fresher" },
  companyLogo: { type: String, default: "" },
  isAktu: { type: Boolean, default: false },
  
  // India Location Validation
  isIndiaLocation: { type: Boolean, default: false },
  indiaRegion: { type: String, default: "" },  // e.g., "North", "South", "West", "East", "Northeast", "Remote"
  
  // Deduplication key
  deduplicationKey: { type: String, unique: false, index: true, default: "" },
  
  // Metadata
  relevanceScore: { type: Number, default: 0 },
  fetchedAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Job', jobSchema);
