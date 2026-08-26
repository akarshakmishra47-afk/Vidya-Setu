require('dotenv').config();
const mongoose = require('mongoose');
const Job = require('./models/Job');
mongoose.connect(process.env.MONGO_URI).then(async () => {
  const jobs = await Job.find({ isActive: true, primaryType: { $in: ['Job', 'Internship'] } }).limit(10).lean();
  console.log('\n--- 10 Active Jobs ---');
  jobs.forEach(j => {
    console.log(`Title: ${j.title}\nCompany: ${j.company}\nType: ${j.primaryType}\nDomain: ${j.domain}\nLocation: ${j.location}\nSource: ${j.source}\nSpecific URL: ${j.sourceUrl || j.applyUrl}\nDeadline: ${j.deadline}\nisActive: ${j.isActive}\n--`);
  });
  
  // Also get DB stats
  const totalJobs = await Job.countDocuments({ primaryType: 'Job' });
  const totalInternships = await Job.countDocuments({ primaryType: 'Internship' });
  const totalHackathons = await Job.countDocuments({ primaryType: 'Hackathon' });
  const activeJobs = await Job.countDocuments({ isActive: true });
  const inactiveJobs = await Job.countDocuments({ isActive: false });
  console.log(`\n========== DATABASE ==========`);
  console.log(`Jobs: ${totalJobs}`);
  console.log(`Internships: ${totalInternships}`);
  console.log(`Hackathons: ${totalHackathons}`);
  console.log(`Active: ${activeJobs}`);
  console.log(`Inactive: ${inactiveJobs}`);
  
  process.exit(0);
});
