const mongoose = require('mongoose');
require('dotenv').config();
const { fetchLatestJobs } = require('./services/jobs/jobFetcher');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  
  // 1. Run actual refresh
  console.log("Running fetchLatestJobs()...");
  const result = await fetchLatestJobs();
  
  // Wait a bit for db syncs if any, though it's awaited
  const Job = mongoose.model('Job');
  
  // Fetch stats from result for Unstop
  const unstopJobsStats = result.sourceStats['Unstop Jobs/Internships'];
  const unstopHackStats = result.sourceStats['Unstop Hackathons'];
  
  // Since jobs and internships are fetched together in `unstopAdapter.js`, 
  // I need to count them manually from the fetched array to break it down,
  // or just count them from the DB.
  const activeUnstopJobs = await Job.countDocuments({ source: "Unstop", primaryType: "Job", isActive: true });
  const activeUnstopInternships = await Job.countDocuments({ source: "Unstop", primaryType: "Internship", isActive: true });
  const activeUnstopHackathons = await Job.countDocuments({ source: "Unstop", primaryType: "Hackathon", isActive: true });
  
  const totalActive = activeUnstopJobs + activeUnstopInternships + activeUnstopHackathons;

  console.log("\n========== UNSTOP FINAL REPORT ==========\n");
  console.log(`Jobs & Internships combined fetched: ${unstopJobsStats ? unstopJobsStats.fetched : 0}`);
  console.log(`Jobs & Internships combined accepted: ${unstopJobsStats ? unstopJobsStats.accepted : 0}`);
  
  console.log(`\nJobs active: ${activeUnstopJobs}`);
  console.log(`Internships active: ${activeUnstopInternships}`);
  
  console.log(`\nHackathons fetched: ${unstopHackStats ? unstopHackStats.fetched : 0}`);
  console.log(`Hackathons accepted: ${unstopHackStats ? unstopHackStats.accepted : 0}`);
  console.log(`Hackathons active: ${activeUnstopHackathons}`);
  console.log("\n========================================\n");

  console.log("========== UNSTOP DATABASE ==========\n");
  console.log(`Job:\n${activeUnstopJobs}\n`);
  console.log(`Internship:\n${activeUnstopInternships}\n`);
  console.log(`Hackathon:\n${activeUnstopHackathons}\n`);
  console.log(`Total active Unstop:\n${totalActive}\n`);

  console.log("--- 5 REAL UNSTOP HACKATHONS ---");
  const hacks = await Job.find({ source: "Unstop", primaryType: "Hackathon", isActive: true }).limit(5);
  for (const h of hacks) {
    console.log(`Title: ${h.title}`);
    console.log(`Source: ${h.source}`);
    console.log(`PrimaryType: ${h.primaryType}`);
    console.log(`Specific sourceUrl: ${h.sourceUrl}`);
    console.log(`Deadline: ${h.deadline}`);
    console.log(`isActive: ${h.isActive}`);
    console.log("--------------------------------");
  }

  process.exit(0);
}

run().catch(console.error);
