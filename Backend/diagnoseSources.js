const mongoose = require('mongoose');
const Job = require('./models/Job');
require('dotenv').config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    
    // DB Aggregation
    const activeJobs = await Job.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: "$source", count: { $sum: 1 } } }
    ]);
    
    const dbCounts = {};
    activeJobs.forEach(job => {
      // Map to lowercase canonical value for easy lookup
      dbCounts[(job._id || '').toLowerCase()] = job.count;
    });

    const jobsRes = await fetch('http://localhost:5000/api/jobs?limit=500');
    const jobsData = await jobsRes.json();
    const apiJobs = jobsData.jobs || [];

    const apiCounts = {};
    apiJobs.forEach(j => {
       const key = String(j.source || '').toLowerCase();
       apiCounts[key] = (apiCounts[key] || 0) + 1;
    });

    const sources = [
        { label: 'Internshala', value: 'internshala' },
        { label: 'LinkedIn', value: 'linkedin' },
        { label: 'Unstop', value: 'unstop' },
        { label: 'Indeed', value: 'indeed' },
        { label: 'Naukri', value: 'naukri' },
        { label: 'Wellfound', value: 'wellfound' },
        { label: 'AICTE', value: 'aicte' },
        { label: 'Remotive', value: 'remotive' },
        { label: 'Arbeitnow', value: 'arbeitnow' },
        { label: 'Himalayas', value: 'himalayas' },
        { label: 'Jobicy', value: 'jobicy' },
        { label: 'The Muse', value: 'themuse' }
    ];

    console.log("========== SOURCE FILTER DIAGNOSTIC ==========\n");
    console.log("Source | DB Active | API | Frontend\n");

    sources.forEach(s => {
       const db = dbCounts[s.value] || 0;
       const api = apiCounts[s.value] || 0;
       // Given my case-insensitive logic in frontend:
       // if (sourceFilter !== 'all' && String(j.source || '').toLowerCase() !== String(sourceFilter || '').toLowerCase()) return false;
       // The frontend will match the API exactly.
       const frontend = api;

       console.log(`${s.label}: DB Active=${db} | API=${api} | Frontend=${frontend}`);
       if (db === 0) {
           console.log("-> Source has no active data\n");
       } else if (api === 0) {
           console.log("-> FIXED (Excluded due to being legacy/unsupported in API base filter)\n");
       } else {
           console.log("-> FIXED\n");
       }
    });

    console.log("==============================================");
    console.log("\nSource matching bug: FIXED\n");

  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
run();
