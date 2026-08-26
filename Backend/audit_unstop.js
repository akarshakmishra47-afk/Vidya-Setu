const mongoose = require('mongoose');
const Job = require('./models/Job');
const http = require('http');

require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/vidyasetu', {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  console.log(`========== UNSTOP VISIBILITY DIAGNOSTIC ==========`);
  
  // 1. MONGODB COUNTS
  const jobCount = await Job.countDocuments({ source: "Unstop", primaryType: "Job", isActive: true });
  const internCount = await Job.countDocuments({ source: "Unstop", primaryType: "Internship", isActive: true });
  const hackathonCount = await Job.countDocuments({ source: "Unstop", primaryType: "Hackathon", isActive: true });
  const totalCount = await Job.countDocuments({ source: "Unstop", isActive: true });

  console.log(`\nMongoDB:`);
  console.log(`Jobs: ${jobCount}`);
  console.log(`Internships: ${internCount}`);
  console.log(`Hackathons: ${hackathonCount}`);
  console.log(`Total active Unstop: ${totalCount}`);

  // 2. PRINT REAL RECORDS
  const printRecords = async (primaryType, label) => {
    console.log(`\n--- 3 Examples of Unstop ${label} ---`);
    const records = await Job.find({ source: "Unstop", primaryType, isActive: true }).limit(3);
    records.forEach(r => {
      console.log(`title: ${r.title}`);
      console.log(`source: ${r.source}`);
      console.log(`primaryType: ${r.primaryType}`);
      console.log(`type: ${r.type}`);
      console.log(`category: ${r.category}`);
      console.log(`isActive: ${r.isActive}`);
      console.log(`isIndiaLocation: ${r.isIndiaLocation}`);
      console.log(`sourceUrl: ${r.sourceUrl}`);
      console.log(`-`);
    });
  };

  await printRecords("Job", "Job");
  await printRecords("Internship", "Internship");
  await printRecords("Hackathon", "Hackathon");

  // 3. CHECK API
  const checkApi = () => new Promise((resolve) => {
    http.get('http://localhost:5000/api/jobs?limit=2000', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const jobs = parsed.jobs || [];
          const unstopJobs = jobs.filter(j => j.source === 'Unstop' && j.primaryType === 'Job');
          const unstopInterns = jobs.filter(j => j.source === 'Unstop' && j.primaryType === 'Internship');
          const unstopHacks = jobs.filter(j => j.source === 'Unstop' && j.primaryType === 'Hackathon');
          
          console.log(`\nAPI:`);
          console.log(`Jobs: ${unstopJobs.length}`);
          console.log(`Internships: ${unstopInterns.length}`);
          console.log(`Hackathons: ${unstopHacks.length}`);
        } catch (e) {
          console.log('Error parsing API response', e.message);
        }
        resolve();
      });
    }).on('error', (e) => {
      console.log(`Error calling API: ${e.message}`);
      resolve();
    });
  });

  await checkApi();

  mongoose.connection.close();
}

run().catch(console.error);
