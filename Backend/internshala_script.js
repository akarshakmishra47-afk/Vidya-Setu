require('dotenv').config();
const mongoose = require('mongoose');
const { evaluateDomain } = require('./services/jobs/utils/domainEvaluator');

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
.then(async () => {
  const Job = require('./models/Job');
  
  // Find ALL internshala jobs (both active and inactive just to see what's going on, but we only update active ones)
  const internshalaJobs = await Job.find({ source: /internshala/i, isActive: true });
  
  for (const job of internshalaJobs) {
    const newDomain = evaluateDomain(job.title, job.description, job.tags || []);
    if (newDomain && newDomain !== job.domain) {
      if (newDomain === 'Cloud Computing' || newDomain === 'DevOps') {
        job.domain = newDomain;
        await job.save();
      } else if (!job.domain) {
        job.domain = newDomain;
        await job.save();
      }
    }
  }
  
  const finalCloudJobs = await Job.find({ source: /internshala/i, domain: 'Cloud Computing', isActive: true });
  const allUpdated = await Job.find({ source: /internshala/i, isActive: true });
  let finalCloudCount = finalCloudJobs.length;
  
  console.log('========== INTERNSHALA CLOUD DOMAIN REPORT ==========');
  console.log('Internshala active records: ' + allUpdated.length);
  console.log('Cloud Computing total: ' + finalCloudCount);
  console.log('\nExamples:');
  
  let ce = await Job.findOne({ source: /internshala/i, title: /Cloud Engineer/i, isActive: true });
  let cia = await Job.findOne({ source: /internshala/i, title: /Cloud Infrastructure Associate/i, isActive: true });
  let ade = await Job.findOne({ source: /internshala/i, title: /AWS DevOps Engineer/i, isActive: true });
  
  console.log('1. Cloud Engineer -> ' + (ce ? ce.domain : 'Not found'));
  console.log('2. Cloud Infrastructure Associate -> ' + (cia ? cia.domain : 'Not found'));
  console.log('3. AWS DevOps Engineer -> ' + (ade ? ade.domain : 'Not found'));
  console.log('=====================================================');
  
  process.exit(0);
}).catch(console.error);
