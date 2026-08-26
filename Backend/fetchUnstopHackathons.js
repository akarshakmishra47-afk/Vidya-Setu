require('dotenv').config();
const mongoose = require('mongoose');
const https = require('https');
const Job = require('./models/Job');

const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/vidyasetu';

async function fetchUnstopHackathons() {
  await mongoose.connect(mongoURI);
  console.log('Connected to MongoDB');

  return new Promise((resolve, reject) => {
    https.get('https://unstop.com/api/public/opportunity/search-result?opportunity=hackathons&page=1&per_page=50', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', async () => {
        try {
          const json = JSON.parse(data);
          const hackathons = json.data.data;
          
          let insertedCount = 0;
          let updatedCount = 0;
          let deactivatedCount = 0;
          let reactivatedCount = 0;

          for (const item of hackathons) {
            const title = item.title;
            const sourceUrl = item.seo_url;
            let rawDeadline = item.end_date || (item.regnRequirements && item.regnRequirements.end_regn_dt) || null;
            const externalId = item.id ? item.id.toString() : '';
            const deduplicationKey = 'Unstop' + externalId;
            
            if (!title || !sourceUrl || !externalId) continue;
            
            const isExpired = rawDeadline ? new Date(rawDeadline) < new Date() : false;
            const isActive = !isExpired;

            // formatted deadline
            const formattedDeadline = rawDeadline 
              ? new Date(rawDeadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
              : 'Not specified';

            const jobData = {
              title,
              company: item.organisation ? item.organisation.name : 'Unstop',
              location: 'Online/Multiple',
              primaryType: 'Hackathon',
              category: 'Hackathon',
              source: 'Unstop',
              sourceUrl,
              applyUrl: sourceUrl,
              deadline: formattedDeadline,
              isActive,
              companyLogo: item.logoUrl2 || '',
              deduplicationKey,
              isIndiaLocation: true
            };

            const existing = await Job.findOne({ deduplicationKey });
            if (existing) {
              if (existing.isActive !== isActive || existing.title !== title || existing.deadline !== formattedDeadline) {
                await Job.updateOne({ _id: existing._id }, { $set: jobData });
                updatedCount++;
                if (!existing.isActive && isActive) reactivatedCount++;
                if (existing.isActive && !isActive) deactivatedCount++;
              }
            } else {
              await Job.create(jobData);
              insertedCount++;
            }
          }

          console.log(`Unstop Sync Complete!
Inserted: ${insertedCount}
Updated: ${updatedCount}
Reactivated: ${reactivatedCount}
Deactivated: ${deactivatedCount}`);

          mongoose.connection.close();
          resolve();
        } catch(e) {
          console.error(e);
          mongoose.connection.close();
          reject(e);
        }
      });
    }).on('error', err => {
      console.error(err);
      mongoose.connection.close();
      reject(err);
    });
  });
}

fetchUnstopHackathons();
