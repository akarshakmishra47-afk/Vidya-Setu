const fs = require('fs');
const mongoose = require('mongoose');
const Job = require('./models/Job');
const { evaluateDomain } = require('./services/jobs/utils/domainEvaluator');
const { isIndiaLocation } = require('./services/jobs/utils/indiaFilter');

require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  const rawData = fs.readFileSync('./internshala_dataset.json', 'utf-8');
  const dataset = JSON.parse(rawData);
  const jobDetails = dataset.job_details || [];
  
  let datasetRecords = jobDetails.length;
  console.log(`Total records found in attached file: ${datasetRecords}`);

  let parsed = 0;
  let valid = 0;
  let rejected = 0;
  let inserted = 0;
  let updated = 0;
  let reactivated = 0;
  let duplicates = 0;

  let rejectedReason = {
    missingTitle: 0,
    invalidUrl: 0,
    domainRejected: 0,
    indiaRejected: 0
  };

  const activeDeduplicationKeys = new Set();
  
  for (let record of jobDetails) {
    parsed++;
    let title = record.job_title;
    let url = record.internshala_url;
    
    if (!title || title === 'N/A') {
      rejected++;
      rejectedReason.missingTitle++;
      continue;
    }

    if (!url) {
      rejected++;
      rejectedReason.invalidUrl++;
      continue;
    }

    const domain = evaluateDomain(title, title);
    if (!domain || domain === 'Other' || domain === 'Unknown' || domain === 'General' || domain === 'Miscellaneous') {
      rejected++;
      rejectedReason.domainRejected++;
      continue;
    }

    const locationStr = (title + " " + url).replace(/-/g, ' ');
    const isIndia = isIndiaLocation(locationStr);
    
    if (isIndia === false) {
      rejected++;
      rejectedReason.indiaRejected++;
      if (title.includes('Cloud Engineer')) console.log('Rejected Cloud Engineer due to indiaRejected');
      continue;
    }

    const deduplicationKey = "internshala::" + url;
    
    if (activeDeduplicationKeys.has(deduplicationKey)) {
      duplicates++;
      continue;
    }
    
    valid++;
    activeDeduplicationKeys.add(deduplicationKey);

    const existingJob = await Job.findOne({ deduplicationKey });

    const updateData = {
      $set: {
        title: title,
        source: "Internshala",
        sourceUrl: url,
        type: "Job",
        primaryType: "Job",
        company: "N/A",
        location: "N/A",
        domain: domain,
        isIndiaLocation: true,
        isActive: true,
        lastVerifiedAt: new Date()
      },
      $unset: { external_link: 1, externalLink: 1, externalUrl: 1 }
    };

    if (existingJob) {
      if (!existingJob.isActive) {
        reactivated++;
      } else {
        updated++;
      }
      await Job.updateOne({ deduplicationKey }, updateData);
    } else {
      inserted++;
      await Job.updateOne({ deduplicationKey }, updateData, { upsert: true });
    }
  }

  // Safe deactivation
  const activeJobs = await Job.find({ source: 'Internshala', isActive: true });
  for (let job of activeJobs) {
    if (!activeDeduplicationKeys.has(job.deduplicationKey)) {
      await Job.updateOne({ _id: job._id }, { $set: { isActive: false } });
    }
  }

  const finalActive = await Job.countDocuments({ source: 'Internshala', isActive: true });

  console.log(`\nDataset records: ${datasetRecords}`);
  console.log(`Parsed: ${parsed}`);
  console.log(`Valid: ${valid}`);
  console.log(`Rejected: ${rejected} (Domain: ${rejectedReason.domainRejected}, India: ${rejectedReason.indiaRejected})`);
  console.log(`Inserted: ${inserted}`);
  console.log(`Updated: ${updated}`);
  console.log(`Reactivated: ${reactivated}`);
  console.log(`Duplicates: ${duplicates}`);
  console.log(`Final active Internshala: ${finalActive}`);
  
  console.log('\nSpecific verification:');
  const ce = await Job.findOne({ source: 'Internshala', title: /Cloud Engineer/i, isActive: true });
  const cia = await Job.findOne({ source: 'Internshala', title: /Cloud Infrastructure Associate/i, isActive: true });
  const de = await Job.findOne({ source: 'Internshala', title: /DevOps Engineer/i, isActive: true });
  const ai = await Job.findOne({ source: 'Internshala', title: /AI|Machine Learning/i, isActive: true });
  const dte = await Job.findOne({ source: 'Internshala', title: /Data Engineer/i, isActive: true });
  
  console.log(`Cloud Engineer -> ${ce ? ce.domain : 'Not found'}`);
  console.log(`Cloud Infrastructure Associate -> ${cia ? cia.domain : 'Not found'}`);
  console.log(`DevOps Engineer -> ${de ? de.domain : 'Not found'}`);
  console.log(`AI/ML roles -> ${ai ? ai.domain : 'Not found'}`);
  console.log(`Data Engineer -> ${dte ? dte.domain : 'Not found'}`);

  mongoose.connection.close();
}

run().catch(console.error);
