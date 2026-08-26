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
  
  let rejected = {
    missingTitle: [],
    invalidUrl: [],
    domainRejected: [],
    indiaRejected: [],
    duplicate: [],
    other: []
  };

  const activeDeduplicationKeys = new Set();
  
  for (let record of jobDetails) {
    let title = record.job_title;
    let url = record.naukri_url;
    
    if (!title || title === 'N/A') {
      rejected.missingTitle.push({ title, url, reason: 'Missing/N/A title', domain: 'N/A', isIndia: 'N/A' });
      continue;
    }

    if (!url || !url.startsWith('https://www.naukri.com/job-listings-')) {
      rejected.invalidUrl.push({ title, url, reason: 'Invalid/missing URL', domain: 'N/A', isIndia: 'N/A' });
      continue;
    }

    const domain = evaluateDomain(title, title);
    if (!domain || domain === 'Other' || domain === 'Unknown' || domain === 'General' || domain === 'Miscellaneous') {
      const locationStr = (title + " " + url).replace(/-/g, ' ');
      const isIndia = isIndiaLocation(locationStr);
      rejected.domainRejected.push({ title, url, reason: 'Domain rejected', domain, isIndia });
      continue;
    }

    const locationStr = (title + " " + url).replace(/-/g, ' ');
    const isIndia = isIndiaLocation(locationStr);
    
    if (isIndia === false) {
      rejected.indiaRejected.push({ title, url, reason: 'India eligibility rejected', domain, isIndia });
      continue;
    }

    const deduplicationKey = "Naukri|" + url;
    if (activeDeduplicationKeys.has(deduplicationKey)) {
      rejected.duplicate.push({ title, url, reason: 'Duplicate', domain, isIndia });
      continue;
    }
    
    activeDeduplicationKeys.add(deduplicationKey);
  }

  console.log(`========== NAUKRI REJECTION AUDIT ==========`);
  console.log(`Missing/N/A title: ${rejected.missingTitle.length}`);
  console.log(`Invalid/missing URL: ${rejected.invalidUrl.length}`);
  console.log(`Domain rejected: ${rejected.domainRejected.length}`);
  console.log(`India eligibility rejected: ${rejected.indiaRejected.length}`);
  console.log(`Duplicate: ${rejected.duplicate.length}`);
  console.log(`Other rejection: ${rejected.other.length}`);
  console.log(`\n========== SAMPLES ==========`);

  const categories = [
    { name: 'Missing/N/A title', data: rejected.missingTitle },
    { name: 'Invalid/missing URL', data: rejected.invalidUrl },
    { name: 'Domain Rejected', data: rejected.domainRejected },
    { name: 'India Eligibility Rejected', data: rejected.indiaRejected }
  ];

  for (let cat of categories) {
    if (cat.data.length > 0) {
      console.log(`\n--- 10 Examples for ${cat.name} ---`);
      for (let i = 0; i < Math.min(10, cat.data.length); i++) {
        const ex = cat.data[i];
        console.log(`Title: ${ex.title}`);
        console.log(`URL: ${ex.url}`);
        console.log(`Reason: ${ex.reason}`);
        console.log(`Domain Detected: ${ex.domain}`);
        console.log(`India Eligibility: ${ex.isIndia}`);
        console.log(`-`);
      }
    }
  }

  // Verification queries
  const activeCount = await Job.countDocuments({ source: 'Naukri', isActive: true });
  const externalLinkCount = await Job.countDocuments({ source: 'Naukri', external_link: { $exists: true } });
  
  // Specific sourceUrl verification
  const invalidSourceUrlCount = await Job.countDocuments({ source: 'Naukri', sourceUrl: { $not: /^https:\/\/www\.naukri\.com\/job-listings-/ } });

  console.log(`\n========== VERIFICATION ==========`);
  console.log(`1. Active Naukri records: ${activeCount}`);
  console.log(`2. Invalid sourceUrls (should be 0): ${invalidSourceUrlCount}`);
  console.log(`3. external_link records: ${externalLinkCount}`);

  mongoose.connection.close();
}

run().catch(console.error);
