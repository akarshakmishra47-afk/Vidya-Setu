const fs = require('fs');
const mongoose = require('mongoose');
const Job = require('./models/Job');
const { evaluateDomain } = require('./services/jobs/utils/domainEvaluator');
const { isIndiaLocation } = require('./services/jobs/utils/indiaFilter');

require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/vidyasetu', {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  const rawData = fs.readFileSync('C:/Users/LENOVO/.gemini/antigravity-ide/brain/2da74132-5fa6-471d-8432-afcf570f6159/.user_uploaded/media_1786817451458.json', 'utf-8');
  const dataset = JSON.parse(rawData);
  const jobDetails = dataset.job_details || [];
  
  let datasetRecords = jobDetails.length;
  let accepted = 0;
  let rejected = 0;
  
  let rejectedReason = {
    missingTitle: 0,
    invalidUrl: 0,
    domainRejected: 0,
    indiaRejected: 0
  };

  const activeDeduplicationKeys = new Set();
  
  let newlyAccepted = 0;
  let previouslyAcceptedAndRetained = 0;
  let reactivated = 0;
  let deactivated = 0;

  const previouslyActiveCount = await Job.countDocuments({ source: 'Naukri', isActive: true });

  for (let record of jobDetails) {
    let title = record.job_title;
    let url = record.naukri_url;
    
    if (!title || title === 'N/A') {
      rejected++;
      rejectedReason.missingTitle++;
      continue;
    }

    if (!url || !url.startsWith('https://www.naukri.com/job-listings-')) {
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
      continue;
    }

    const deduplicationKey = "Naukri|" + url;
    // For duplicate within dataset, we just accept it once
    if (activeDeduplicationKeys.has(deduplicationKey)) {
      continue;
    }
    
    accepted++;
    activeDeduplicationKeys.add(deduplicationKey);

    const existingJob = await Job.findOne({ deduplicationKey });

    const updateData = {
      $set: {
        title: title,
        source: "Naukri",
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
        previouslyAcceptedAndRetained++;
      }
      await Job.updateOne({ deduplicationKey }, updateData);
    } else {
      newlyAccepted++;
      await Job.updateOne({ deduplicationKey }, updateData, { upsert: true });
    }
  }

  // Safe deactivation
  const activeNaukriJobs = await Job.find({ source: 'Naukri', isActive: true });
  for (let job of activeNaukriJobs) {
    if (!activeDeduplicationKeys.has(job.deduplicationKey)) {
      await Job.updateOne({ _id: job._id }, { $set: { isActive: false } });
      deactivated++;
    }
  }

  console.log(`========== NAUKRI FILTER REFINEMENT ==========`);
  console.log(`Total dataset: ${datasetRecords}`);
  console.log(`Accepted: ${accepted}`);
  console.log(`Rejected: ${rejected}`);
  console.log(``);
  console.log(`Rejected - N/A title: ${rejectedReason.missingTitle}`);
  console.log(`Rejected - URL: ${rejectedReason.invalidUrl}`);
  console.log(`Rejected - India: ${rejectedReason.indiaRejected}`);
  console.log(`Rejected - Domain: ${rejectedReason.domainRejected}`);
  console.log(``);
  console.log(`Newly accepted: ${newlyAccepted}`);
  console.log(`Previously accepted and retained: ${previouslyAcceptedAndRetained}`);
  console.log(`Reactivated: ${reactivated}`);
  console.log(`Deactivated: ${deactivated}`);
  console.log(`==============================================\n`);

  console.log(`--- SAMPLES OF NEWLY ACCEPTED RECORDS ---`);
  // Get 20 newly created or reactivated ones if possible. To be simple, we just print the latest 20.
  const samples = await Job.find({ source: 'Naukri', isActive: true }).sort({ createdAt: -1 }).limit(20);
  for (let s of samples) {
    console.log(`Title: ${s.title}`);
    console.log(`Domain: ${s.domain}`);
    console.log(`Source: ${s.source}`);
    console.log(`Specific sourceUrl: ${s.sourceUrl}`);
    console.log(`India eligibility: ${s.isIndiaLocation}`);
    console.log(`isActive: ${s.isActive}`);
    console.log(`---`);
  }

  mongoose.connection.close();
}

run().catch(console.error);
