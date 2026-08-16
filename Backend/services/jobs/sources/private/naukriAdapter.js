const fs = require('fs');
const path = require('path');
const { evaluateDomain } = require('../../utils/domainEvaluator');
const { isIndiaLocation } = require('../../utils/indiaFilter');

async function fetchNaukriJobs() {
  const stats = { fetched: 0, accepted: 0, rejected: 0, error: null, status: 'Working' };
  const jobs = [];

  try {
    const datasetPath = path.join(__dirname, '../../../../naukri_dataset.json');
    if (!fs.existsSync(datasetPath)) {
      throw new Error(`Dataset not found at ${datasetPath}`);
    }

    const data = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
    const records = data.job_details || [];
    stats.fetched = records.length;

    for (const record of records) {
      const { job_title, naukri_url } = record;

      // Validate required fields
      if (!job_title || job_title.trim().toUpperCase() === 'N/A') {
        stats.rejected++;
        continue;
      }
      
      if (!naukri_url || !naukri_url.startsWith('http') || !naukri_url.includes('job-listings-')) {
        stats.rejected++;
        continue;
      }

      // Domain classification
      const domain = evaluateDomain(job_title);
      if (!domain) {
        stats.rejected++;
        continue;
      }

      // India location check (using the URL which contains the locations)
      if (!isIndiaLocation(naukri_url)) {
        stats.rejected++;
        continue;
      }

      // Accepted
      jobs.push({
        title: job_title.trim(),
        source: 'naukri',
        sourceUrl: naukri_url.trim(),
        type: 'Job',
        domain: domain,
        isIndiaLocation: true,
        deduplicationKey: `Naukri::${naukri_url.trim()}`
      });
      stats.accepted++;
    }

  } catch (error) {
    stats.error = error.message;
    stats.status = 'Error';
  }

  return { jobs, stats };
}

module.exports = { fetchNaukriJobs };
