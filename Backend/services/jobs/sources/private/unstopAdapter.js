const axios = require('axios');
const { evaluateDomain } = require('../../utils/domainEvaluator');

async function fetchUnstopJobs() {
  const stats = { fetched: 0, accepted: 0, rejected: 0, error: null, status: 'Working' };
  const jobs = [];

  try {
    // Unstop Jobs
    const jobsRes = await axios.get('https://unstop.com/api/public/opportunity/search-result?opportunity=jobs&page=1&per_page=50');
    // Unstop Internships
    const internshipsRes = await axios.get('https://unstop.com/api/public/opportunity/search-result?opportunity=internships&page=1&per_page=50');

    const combined = [
      ...(jobsRes.data?.data?.data || []).map(j => ({ ...j, opportunity_type: 'Job' })),
      ...(internshipsRes.data?.data?.data || []).map(j => ({ ...j, opportunity_type: 'Internship' }))
    ];

    stats.fetched = combined.length;

    for (const item of combined) {
      const title = item.title;
      const sourceUrl = item.seo_url;
      const externalId = item.id ? item.id.toString() : '';
      
      if (!title || !sourceUrl || !externalId) {
        stats.rejected++;
        continue;
      }

      const domain = evaluateDomain(title, '', []);
      const deadline = item.end_date || (item.regnRequirements && item.regnRequirements.end_regn_dt) || null;

      jobs.push({
        title,
        company: item.organisation ? item.organisation.name : 'Unstop',
        primaryType: item.opportunity_type, // 'Job' or 'Internship'
        source: 'Unstop',
        sourceUrl,
        applyUrl: sourceUrl,
        domain: domain || undefined,
        location: (item.locations && item.locations.length > 0) ? item.locations.map(l => l.city).join(', ') : 'Online/Multiple',
        deadline: deadline ? new Date(deadline).toISOString() : 'Not specified',
        companyLogo: item.logoUrl2 || '',
        deduplicationKey: 'Unstop' + externalId,
        isIndiaLocation: true // Unstop is generally India-focused
      });
      stats.accepted++;
    }

  } catch (err) {
    stats.error = err.message || 'Unavailable';
    stats.status = 'Unavailable';
  }

  return { jobs, stats };
}

async function fetchUnstopHackathons() {
  const stats = { fetched: 0, accepted: 0, rejected: 0, error: null, status: 'Working' };
  const jobs = [];

  try {
    const res = await axios.get('https://unstop.com/api/public/opportunity/search-result?opportunity=hackathons&page=1&per_page=50');
    const items = res.data?.data?.data || [];
    stats.fetched = items.length;

    for (const item of items) {
      const title = item.title;
      const sourceUrl = item.seo_url;
      const externalId = item.id ? item.id.toString() : '';
      
      if (!title || !sourceUrl || !externalId) {
        stats.rejected++;
        continue;
      }

      const domain = evaluateDomain(title, '', []);
      const deadline = item.end_date || (item.regnRequirements && item.regnRequirements.end_regn_dt) || null;

      jobs.push({
        title,
        company: item.organisation ? item.organisation.name : 'Unstop',
        primaryType: 'Hackathon',
        category: 'Hackathon',
        source: 'Unstop',
        sourceUrl,
        applyUrl: sourceUrl,
        domain: domain || undefined,
        location: (item.locations && item.locations.length > 0) ? item.locations.map(l => l.city).join(', ') : 'Online/Multiple',
        deadline: deadline ? new Date(deadline).toISOString() : 'Not specified',
        companyLogo: item.logoUrl2 || '',
        deduplicationKey: 'Unstop' + externalId,
        isIndiaLocation: true
      });
      stats.accepted++;
    }
  } catch (err) {
    stats.error = err.message || 'Unavailable';
    stats.status = 'Unavailable';
  }

  return { jobs, stats };
}

module.exports = { fetchUnstopJobs, fetchUnstopHackathons };
