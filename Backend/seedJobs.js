/**
 * seedJobs.js
 * Seeds the MongoDB database with fresh job & internship data including all new fields.
 * Run with: node seedJobs.js
 */
const mongoose = require('mongoose');
const Job = require('./models/Job');
const { FALLBACK_INTERNSHIPS_PAID, FALLBACK_INTERNSHIPS_FREE, FALLBACK_AKTU_JOBS } = require('./fetchJobs');
require('dotenv').config();

const ALL_JOBS = [...FALLBACK_INTERNSHIPS_PAID, ...FALLBACK_INTERNSHIPS_FREE, ...FALLBACK_AKTU_JOBS];

async function seedJobs() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB Connected...');

    await Job.deleteMany({});
    console.log('🗑️  Cleared existing jobs...');

    await Job.insertMany(ALL_JOBS);
    console.log(`🚀 Seeded ${ALL_JOBS.length} listings:`);
    console.log(`   💰 Paid Internships: ${FALLBACK_INTERNSHIPS_PAID.length}`);
    console.log(`   🆓 Free Internships: ${FALLBACK_INTERNSHIPS_FREE.length}`);
    console.log(`   ⚙️  AKTU Jobs:        ${FALLBACK_AKTU_JOBS.length}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding Error:', error);
    process.exit(1);
  }
}

seedJobs();
