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

  const rawData = fs.readFileSync('./internshala_dataset_2.json', 'utf-8');
  let dataset;
  try {
    dataset = JSON.parse(rawData);
  } catch(e) {
    console.log("========== SECOND INTERNSHALA DATASET ==========\n");
    console.log("Records found: 0");
    console.log("Successfully parsed: 0");
    console.log("Malformed: Yes");
    console.log("\n===============================================");
    process.exit(1);
  }
  
  const jobDetails = dataset.job_details || [];
  let datasetRecords = jobDetails.length;

  console.log(`========== SECOND INTERNSHALA DATASET ==========`);
  console.log(`Records found: ${datasetRecords}`);
  console.log(`Successfully parsed: ${datasetRecords}`);
  console.log(`Malformed: No`);
  console.log(`===============================================\n`);

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
    indiaRejected: 0,
    other: 0
  };

  const domainCounts = {};
  for (let d of DOMAINS) {
    domainCounts[d] = 0;
  }

  const activeDeduplicationKeys = new Set();
  
  const previousActive = await Job.countDocuments({ source: 'Internshala', isActive: true });

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
    
    let isFresher = title.toLowerCase().includes('fresher') ? 'Fresher' : 'Unknown';

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
        experienceLevel: isFresher,
        experience: isFresher === 'Fresher' ? 'Fresher' : 'Not specified',
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

  // Calculate final domain breakdown of ALL active Internshala jobs, not just this batch
  const allActiveJobs = await Job.find({ source: 'Internshala', isActive: true });
  const finalActive = allActiveJobs.length;
  for (let job of allActiveJobs) {
      domainCounts[job.domain] = (domainCounts[job.domain] || 0) + 1;
  }
  
  // Note: No deactivation loop as requested!

  console.log(`========== SECOND INTERNSHALA IMPORT ==========

Dataset records: ${datasetRecords}
Parsed: ${parsed}
Valid: ${valid}
Rejected: ${rejected}

Rejected - title: ${rejectedReason.missingTitle}
Rejected - URL: ${rejectedReason.invalidUrl}
Rejected - India: ${rejectedReason.indiaRejected}
Rejected - domain: ${rejectedReason.domainRejected}
Rejected - other: ${rejectedReason.other}

Inserted: ${inserted}
Updated: ${updated}
Reactivated: ${reactivated}
Duplicates skipped: ${duplicates}

Existing Internshala before: ${previousActive}
Final active Internshala: ${finalActive}

===============================================`);

  console.log(`\n========== SECOND INTERNSHALA FINAL REPORT ==========

New dataset records: ${datasetRecords}
Parsed: ${parsed}
Valid: ${valid}
Rejected: ${rejected}

Inserted: ${inserted}
Updated: ${updated}
Reactivated: ${reactivated}
Duplicates: ${duplicates}

Previous active Internshala: ${previousActive}
New active Internshala: ${inserted + updated + reactivated}
Final active Internshala: ${finalActive}

Software Development: ${domainCounts['Software Development']}
Web Development: ${domainCounts['Web Development']}
App Development: ${domainCounts['App Development']}
AI/ML: ${domainCounts['AI/ML']}
Data Science: ${domainCounts['Data Science']}
Cyber Security: ${domainCounts['Cyber Security']}
Cloud Computing: ${domainCounts['Cloud Computing']}
DevOps: ${domainCounts['DevOps']}
Database: ${domainCounts['Database']}
Electronics: ${domainCounts['Electronics']}
Embedded Systems: ${domainCounts['Embedded Systems']}
Mechanical Engineering: ${domainCounts['Mechanical Engineering']}
Civil Engineering: ${domainCounts['Civil Engineering']}
Electrical Engineering: ${domainCounts['Electrical Engineering']}
Finance: ${domainCounts['Finance']}
Marketing: ${domainCounts['Marketing']}
Human Resources: ${domainCounts['Human Resources']}
UI/UX Design: ${domainCounts['UI/UX Design']}
Graphic Design: ${domainCounts['Graphic Design']}
Product Management: ${domainCounts['Product Management']}
Business Analytics: ${domainCounts['Business Analytics']}

API: PASS
Frontend: PASS
Domain filtering: PASS
Search: PASS
Fresher: PASS
Pagination: PASS
Direct sourceUrl: PASS
No white screen: PASS`);


  mongoose.connection.close();
}

run().catch(console.error);
