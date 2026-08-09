function validateScholarship(raw, source) {
  if (!raw.title) return null;
  
  const title = String(raw.title).trim();
  if (title.length < 5) return null; // Too short to be real
  
  // Deduplication Key based on source and title (normalized)
  const normalizedTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '');
  const deduplicationKey = `${source}::${normalizedTitle}`;

  // Default structure
  const validated = {
    title: title,
    provider: 'Unknown Provider',
    category: 'Private/NGO',
    amount: 'Variable / Check Official Site',
    deadline: 'Check Official Site',
    description: '',
    officialUrl: 'https://scholarships.gov.in',
    howToApply: [],
    tags: [],
    source: source,
    sourceId: raw.id || raw._id || deduplicationKey,
    status: 'active',
    lastVerifiedAt: new Date(),
    eligibility: {
      maxIncome: 99999999,
      allowedCategories: ['General', 'OBC', 'SC', 'ST', 'EWS'],
      isDefenceRequired: false,
      isCapfRequired: false
    },
    documentsRequired: ['Aadhaar', 'Income Certificate']
  };

  if (source === 'huggingface') {
    // Expected structure from the HF json
    if (!raw.url && !raw.link) return null; // Must have a verifiable link
    
    validated.provider = raw.provider || raw.organization || 'Government/Private';
    validated.description = raw.description || raw.details || title;
    validated.amount = raw.amount || raw.benefits || 'Check Official Site';
    validated.deadline = raw.deadline || raw.endDate || 'Check Official Site';
    validated.officialUrl = raw.url || raw.link;
    
    // Attempt classification based on text
    const textToSearch = `${title} ${validated.description}`.toLowerCase();
    
    if (textToSearch.includes('government') || textToSearch.includes('ministry') || textToSearch.includes('pm ')) {
      validated.category = 'Government';
    } else if (textToSearch.includes('defence') || textToSearch.includes('armed forces')) {
      validated.category = 'Defence';
      validated.eligibility.isDefenceRequired = true;
    } else if (textToSearch.includes('capf')) {
      validated.category = 'CAPF';
      validated.eligibility.isCapfRequired = true;
    }
    
    if (textToSearch.includes('b.tech') || textToSearch.includes('engineering')) {
      validated.tags.push('B.Tech');
    }
    if (textToSearch.includes('uttar pradesh') || textToSearch.includes(' up ')) {
      validated.tags.push('UP');
    }
  }

  if (source === 'rssFeed') {
    if (!raw.link) return null;
    validated.description = raw.description || title;
    validated.officialUrl = raw.link;
    validated.provider = 'RSS Feed Provider';
  }

  // URL Validation
  try {
    new URL(validated.officialUrl);
  } catch (e) {
    validated.officialUrl = 'https://scholarships.gov.in';
  }

  // Final check: don't fabricate missing details
  if (validated.amount === 'Check Official Site') validated.amount = 'Unknown';
  if (validated.deadline === 'Check Official Site') validated.deadline = 'Unknown';

  return validated;
}

module.exports = { validateScholarship };
