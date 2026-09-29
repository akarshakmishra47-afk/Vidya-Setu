/**
 * unstopAdapter.js
 * Source adapter for Unstop Public Opportunity APIs (Jobs, Internships, Hackathons).
 * Normalizes live listings with clean URLs, proper Date objects, and accurate
 * domain classification.
 */

const axios = require('axios');
const { evaluateDomain, evaluateHackathon } = require('../../utils/domainEvaluator');
const { cleanUrl, generateDeduplicationKey, generateFingerprint } = require('../../utils/deduplicator');
const { parseDate } = require('../../utils/dateParser');
const { classifyExperience } = require('../../utils/jobValidator');

const TIMEOUT_MS = 15000;

async function fetchUnstopJobs() {
  const stats = { fetched: 0, accepted: 0, rejected: 0, error: null, status: 'Working' };
  const jobs = [];

  try {
    const [jobsRes, internshipsRes] = await Promise.all([
      axios.get('https://unstop.com/api/public/opportunity/search-result?opportunity=jobs&sort=latest&page=1&per_page=50', { timeout: TIMEOUT_MS }),
      axios.get('https://unstop.com/api/public/opportunity/search-result?opportunity=internships&sort=latest&page=1&per_page=50', { timeout: TIMEOUT_MS })
    ]);

    const combined = [
      ...(jobsRes.data?.data?.data || []).map(j => ({ ...j, opportunity_type: 'Job' })),
      ...(internshipsRes.data?.data?.data || []).map(j => ({ ...j, opportunity_type: 'Internship' }))
    ];

    stats.fetched = combined.length;
    const now = new Date();

    for (const item of combined) {
      const title = (item.title || '').trim();
      const rawUrl = item.seo_url;
      const externalId = item.id ? item.id.toString() : '';

      if (!title || !rawUrl || !externalId) {
        stats.rejected++;
        continue;
      }

      const domain = evaluateDomain(title, item.details || '', []);
      if (!domain) {
        stats.rejected++;
        continue;
      }

      const rawDeadline = item.end_date || (item.regnRequirements && item.regnRequirements.end_regn_dt) || null;
      const deadlineDate = parseDate(rawDeadline);

      // Skip if explicitly expired
      if (deadlineDate && deadlineDate < now) {
        stats.rejected++;
        continue;
      }

      const cleanedUrl = cleanUrl(rawUrl);
      const company = item.organisation ? item.organisation.name : 'Unstop Recruiter';
      const location = (item.locations && item.locations.length > 0)
        ? item.locations.map(l => l.city).filter(Boolean).join(', ')
        : 'India / Online';

      const expInfo = classifyExperience(title, '', item.details || '');

      jobs.push({
        title,
        company,
        primaryType: item.opportunity_type,
        secondaryType: item.opportunity_type === 'Internship' ? 'Paid' : 'Full-Time',
        source: 'Unstop',
        sourceId: externalId,
        sourceUrl: cleanedUrl,
        applyUrl: cleanedUrl,
        domain,
        experienceLevel: expInfo.level,
        experience: expInfo.label,
        location: location || 'India',
        deadline: deadlineDate ? deadlineDate.toISOString().split('T')[0] : null,
        deadlineDate,
        companyLogo: item.logoUrl2 || '',
        deduplicationKey: `Unstop::${externalId}`,
        normalizedFingerprint: generateFingerprint(title, company, location, item.opportunity_type),
        isIndiaLocation: true
      });
      stats.accepted++;
    }

  } catch (err) {
    stats.error = err.message || 'Unavailable';
    stats.status = 'Error';
  }

  return { jobs, stats };
}

async function fetchUnstopHackathons() {
  const stats = { fetched: 0, accepted: 0, rejected: 0, error: null, status: 'Working' };
  const jobs = [];

  try {
    const res = await axios.get('https://unstop.com/api/public/opportunity/search-result?opportunity=hackathons&sort=latest&page=1&per_page=50', { timeout: TIMEOUT_MS });
    const items = res.data?.data?.data || [];
    stats.fetched = items.length;
    const now = new Date();

    for (const item of items) {
      const title = (item.title || '').trim();
      const rawUrl = item.seo_url;
      const externalId = item.id ? item.id.toString() : '';

      if (!title || !rawUrl || !externalId) {
        stats.rejected++;
        continue;
      }

      // Use flexible hackathon evaluator instead of narrow job keywords
      const hackEval = evaluateHackathon(title, item.details || '', []);
      if (!hackEval.valid) {
        stats.rejected++;
        continue;
      }

      const rawDeadline = item.end_date || (item.regnRequirements && item.regnRequirements.end_regn_dt) || null;
      const deadlineDate = parseDate(rawDeadline);
      const startDate = parseDate(item.start_date || (item.regnRequirements && item.regnRequirements.start_regn_dt));

      // Skip if registration has closed
      if (deadlineDate && deadlineDate < now) {
        stats.rejected++;
        continue;
      }

      const cleanedUrl = cleanUrl(rawUrl);
      const organizer = item.organisation ? item.organisation.name : 'Unstop';
      const location = (item.locations && item.locations.length > 0)
        ? item.locations.map(l => l.city).filter(Boolean).join(', ')
        : 'Online / Pan-India';

      jobs.push({
        title,
        company: organizer,
        primaryType: 'Hackathon',
        secondaryType: 'Online',
        category: 'Hackathon',
        source: 'Unstop',
        sourceId: externalId,
        sourceUrl: cleanedUrl,
        applyUrl: cleanedUrl,
        domain: hackEval.domain,
        experienceLevel: 'Fresher',
        experience: 'Open to Students',
        location,
        deadline: deadlineDate ? deadlineDate.toISOString().split('T')[0] : null,
        deadlineDate,
        hackathonOrganizer: organizer,
        hackathonStartDate: startDate,
        hackathonEndDate: deadlineDate,
        hackathonRegistrationDeadline: deadlineDate,
        hackathonEligibility: 'Students & Developers',
        hackathonMode: 'Online',
        hackathonTechDomain: hackEval.domain,
        companyLogo: item.logoUrl2 || '',
        deduplicationKey: `Unstop::hackathon_${externalId}`,
        normalizedFingerprint: generateFingerprint(title, organizer, location, 'Hackathon'),
        isIndiaLocation: true
      });
      stats.accepted++;
    }
  } catch (err) {
    stats.error = err.message || 'Unavailable';
    stats.status = 'Error';
  }

  return { jobs, stats };
}

module.exports = { fetchUnstopJobs, fetchUnstopHackathons };
