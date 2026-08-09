function validatePerk(perk) {
  if (!perk.title || typeof perk.title !== 'string' || perk.title.trim().length === 0) return false;
  if (!perk.provider || typeof perk.provider !== 'string' || perk.provider.trim().length === 0) return false;
  if (!perk.category || typeof perk.category !== 'string') return false;
  
  // Basic URL validation
  if (!perk.officialUrl || typeof perk.officialUrl !== 'string') return false;
  try {
    const url = new URL(perk.officialUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  } catch (e) {
    return false;
  }

  return true;
}

function generatePerkDeduplicationKey(source, provider, title) {
  const safeProvider = String(provider || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const safeTitle = String(title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${source}::${safeProvider}_${safeTitle}`.substring(0, 150);
}

module.exports = {
  validatePerk,
  generatePerkDeduplicationKey
};
