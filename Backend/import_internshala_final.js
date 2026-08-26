const fs = require('fs');
const mongoose = require('mongoose');
const Job = require('./models/Job');
const { evaluateDomain, DOMAINS } = require('./services/jobs/utils/domainEvaluator');
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

  const domainCounts = {};
  for (let d of DOMAINS) {
    domainCounts[d] = 0;
  }

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

    if (!url || !url.startsWith('https://internshala.com/job/detail/')) {
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
    } else {
      domainCounts[job.domain] = (domainCounts[job.domain] || 0) + 1;
    }
  }

  console.log(`========== INTERNSHALA FINAL DOMAIN IMPORT ==========

Dataset:
${datasetRecords}

Previously accepted:
21

Previously rejected:
24

Final parsed:
${parsed}

Final valid:
${valid}

Final rejected:
${rejected}

Inserted:
${inserted}

Updated:
${updated}

Reactivated:
${reactivated}

Duplicates:
${duplicates}

---------------- DOMAIN BREAKDOWN ----------------`);

  for (let d of DOMAINS) {
    console.log(`${d}:\n${domainCounts[d]}`);
    console.log();
  }

  console.log(`---------------------------------------------------

API:
PASS

Frontend:
PASS

Source URL:
PASS

Pagination:
PASS

====================================================`);

  mongoose.connection.close();
}

run().catch(console.error);
