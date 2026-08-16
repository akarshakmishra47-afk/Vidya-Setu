const mongoose = require('mongoose');
const fs = require('fs');
require('dotenv').config({ path: 'C:/Users/LENOVO/Desktop/Vidya Setu/Backend/.env' });

async function runDiagnostics() {
  await mongoose.connect(process.env.MONGO_URI);
  const Job = mongoose.model('Job', new mongoose.Schema({}, { strict: false }));

  console.log('--- 2. Verify Unstop ---');
  const unstopCount = await Job.countDocuments({ source: /unstop/i, isActive: true });
  console.log(`Active Unstop Jobs in DB: ${unstopCount}`);
  
  console.log('\n--- 4. Verify counts independently ---');
  const jobsCount = await Job.countDocuments({ category: 'Job', isActive: true });
  const internCount = await Job.countDocuments({ category: 'Internship', isActive: true });
  const hackCount = await Job.countDocuments({ category: 'Hackathon', isActive: true });
  
  console.log(`Jobs count (category=Job): ${jobsCount}`);
  console.log(`Internships count: ${internCount}`);
  console.log(`Hackathons count: ${hackCount}`);
  
  const engCount = await Job.countDocuments({ branch: 'Engineering', isActive: true });
  const itCount = await Job.countDocuments({ branch: 'IT / Software', isActive: true });
  console.log(`Engineering count: ${engCount}`);
  console.log(`IT / Software count: ${itCount}`);

  console.log('\n--- 5. Check why Engineering=0 while IT=69 ---');
  const engBranches = await Job.distinct('branch', { isActive: true });
  console.log('Available branches in DB:', engBranches);
  const nullBranches = await Job.countDocuments({ branch: { $exists: false }, isActive: true });
  console.log('Docs without branch:', nullBranches);

  console.log('\n--- 7. Print API endpoints ---');
  const jobsAPI = await fetch('http://localhost:5000/api/jobs');
  const jobsData = await jobsAPI.json();
  console.log(`GET /api/jobs -> count: ${jobsData.count}, total: ${jobsData.total}`);

  const statusAPI = await fetch('http://localhost:5000/api/jobs/source-status');
  const statusData = await statusAPI.json();
  console.log(`GET /api/jobs/source-status ->`, statusData);

  console.log('\n--- 6. Dashboard Active Jobs ---');
  const statsAPI = await fetch('http://localhost:5000/api/jobs/stats');
  const statsData = await statsAPI.json();
  console.log(`GET /api/jobs/stats ->`, statsData);
  
  console.log('\n--- 8. Print 10 real active Jobs/Internships and 10 real active Hackathons ---');
  const ji = await Job.find({ category: { $in: ['Job', 'Internship'] }, isActive: true }).limit(10).lean();
  console.log('Jobs/Internships:');
  ji.forEach(j => console.log(` - title: ${j.title} \n   source: ${j.source} \n   domain: ${j.branch || j.domain || 'N/A'} \n   type: ${j.category} \n   sourceUrl: ${j.applyUrl || j.sourceUrl} \n   isActive: ${j.isActive}`));

  const hacks = await Job.find({ category: 'Hackathon', isActive: true }).limit(10).lean();
  console.log('\nHackathons:');
  hacks.forEach(j => console.log(` - title: ${j.title} \n   source: ${j.source} \n   domain: ${j.branch || j.domain || 'N/A'} \n   type: ${j.category} \n   sourceUrl: ${j.applyUrl || j.sourceUrl} \n   isActive: ${j.isActive}`));

  console.log('\n--- 10. Auto-refresh interval ---');
  try {
    const jobFetchContent = fs.readFileSync('C:/Users/LENOVO/Desktop/Vidya Setu/Backend/routes/jobRoutes.js', 'utf8');
    const refreshLine = jobFetchContent.split('\n').filter(l => l.includes('setInterval'));
    console.log('Refresh line in jobRoutes:', refreshLine);
  } catch (e) { console.log(e.message); }

  console.log('\n--- 9. URL formatting ---');
  const u1 = await Job.findOne({ source: /unstop/i, isActive: true });
  console.log('Unstop URL:', u1?.applyUrl || u1?.sourceUrl);

  mongoose.disconnect();
}
runDiagnostics().catch(console.error);
