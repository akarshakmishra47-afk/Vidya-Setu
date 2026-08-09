const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected");
  
  // We need to use the actual model from the codebase so it matches
  const Job = require('./models/Job');
  
  const jobs = await Job.find({}).lean();
  console.log(`Total jobs found: ${jobs.length}`);
  
  const grouped = {};
  for (const job of jobs) {
    const title = (job.title || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const company = (job.company || '').toLowerCase().replace(/\s+/g, ' ').trim();
    
    // Some urls might have slight variations, we can use title + company as primary key since govt jobs are very specific
    // but better to use applyUrl if available, or just title+company+location
    const applyUrl = (job.applyUrl || '').toLowerCase().replace(/[?#].*$/, '').trim();
    
    const fp = `${title}|${company}|${applyUrl}`;
    if (!grouped[fp]) grouped[fp] = [];
    grouped[fp].push(job);
  }
  
  let duplicatesToRemove = [];
  for (const [fp, group] of Object.entries(grouped)) {
    if (group.length > 1) {
      console.log(`Found duplicate group (${group.length}): ${fp}`);
      // Sort by postedAt or createdAt DESC to keep the newest/best one
      group.sort((a, b) => {
        const dateA = a.postedAt ? new Date(a.postedAt).getTime() : new Date(a.createdAt).getTime();
        const dateB = b.postedAt ? new Date(b.postedAt).getTime() : new Date(b.createdAt).getTime();
        return dateB - dateA;
      });
      
      // Keep the first one, remove the rest
      const keep = group[0];
      for (let i = 1; i < group.length; i++) {
        duplicatesToRemove.push(group[i]._id);
      }
    }
  }
  
  if (duplicatesToRemove.length > 0) {
    console.log(`Removing ${duplicatesToRemove.length} duplicate records...`);
    const res = await Job.deleteMany({ _id: { $in: duplicatesToRemove } });
    console.log(`Deleted ${res.deletedCount} records.`);
  } else {
    console.log("No cross-fingerprint duplicates found.");
  }
  
  process.exit();
}
run();
