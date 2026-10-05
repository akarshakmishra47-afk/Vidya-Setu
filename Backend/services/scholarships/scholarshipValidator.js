function validateScholarship(raw, source) {
  if (!raw.title) return null;
  
  const title = String(raw.title).trim();
  if (title.length < 5) return null;
  
  const normalizedTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '');
  const deduplicationKey = `${source}::${normalizedTitle}`;

  // Default structure expected by the DB and Frontend
  const validated = {
    title: title,
    provider: 'Unknown Provider',
    category: 'Private/NGO',
    amount: 'Variable / Check Official Site',
    deadline: 'Check Official Site',
    deadlineDate: new Date(new Date().setMonth(new Date().getMonth() + 1)), // Default to 1 month from now
    description: '',
    officialUrl: 'https://scholarships.gov.in',
    howToApply: [],
    tags: [],
    source: source,
    sourceId: raw.id || raw._id || deduplicationKey,
    deduplicationKey: deduplicationKey,
    status: 'active',
    lastVerifiedAt: new Date(),
    isActive: true,
    
    // Frontend required filtering fields
    isBTechEligible: true, // Defaulting to true for generic news, then refining
    isPGEligible: true,
    isDefenceEligible: false,
    isCapfEligible: false,
    pgCourses: ['All PG Programs'],
    engineeringBranches: ['All Engineering Branches'],
    btechYears: ['All Years'],
    coverageScope: 'All India',
    state: 'All States / UTs',
    gender: 'All',

    eligibility: {
      maxIncome: 99999999,
      allowedCategories: ['General', 'OBC', 'SC', 'ST', 'EWS', 'All'],
      isDefenceRequired: false,
      isCapfRequired: false,
      gender: 'All'
    },
    documentsRequired: ['Aadhaar', 'Income Certificate']
  };

  validated.description = raw.description || title;
  validated.officialUrl = raw.link || raw.url || 'https://scholarships.gov.in';
  
  const textToSearch = `${title} ${validated.description}`.toLowerCase();
  
  if (source === 'rssFeed') {
    validated.provider = 'News Aggregator';
    // Try to extract provider from title like "LIC Scholarship - Apply Now"
    const splitTitle = title.split(/[-|:]/);
    if (splitTitle.length > 1) {
      validated.provider = splitTitle[0].trim();
    }
  }

  // Classification Logic based on Text
  if (textToSearch.includes('government') || textToSearch.includes('ministry') || textToSearch.includes('pm ')) {
    validated.category = 'Government';
  } else if (textToSearch.includes('defence') || textToSearch.includes('armed forces') || textToSearch.includes('army')) {
    validated.category = 'Defence';
    validated.eligibility.isDefenceRequired = true;
    validated.isDefenceEligible = true;
  } else if (textToSearch.includes('capf') || textToSearch.includes('police')) {
    validated.category = 'CAPF';
    validated.eligibility.isCapfRequired = true;
    validated.isCapfEligible = true;
  } else if (textToSearch.includes('corporate') || textToSearch.includes('foundation') || textToSearch.includes('bank')) {
    validated.category = 'Corporate';
  }

  if (textToSearch.includes('b.tech') || textToSearch.includes('engineering') || textToSearch.includes('ug ')) {
    validated.tags.push('B.Tech');
    validated.isBTechEligible = true;
  } else if (textToSearch.includes('school') || textToSearch.includes('class ')) {
    validated.isBTechEligible = false;
    validated.isPGEligible = false;
  }

  if (textToSearch.includes('pg') || textToSearch.includes('postgrad') || textToSearch.includes('m.tech') || textToSearch.includes('master')) {
    validated.tags.push('PG');
    validated.isPGEligible = true;
  }

  if (textToSearch.includes('girl') || textToSearch.includes('women')) {
    validated.gender = 'Female';
    validated.eligibility.gender = 'Female';
    validated.tags.push('Girls');
  }

  if (textToSearch.includes('sc/st') || textToSearch.includes('dalit')) {
    validated.eligibility.allowedCategories = ['SC', 'ST'];
  }

  // Ensure URLs are valid
  try {
    new URL(validated.officialUrl);
  } catch (e) {
    validated.officialUrl = 'https://scholarships.gov.in';
  }

  return validated;
}

module.exports = { validateScholarship };
