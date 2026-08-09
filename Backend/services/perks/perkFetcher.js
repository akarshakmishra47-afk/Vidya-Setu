const Perk = require('../../models/Perk');
const { validatePerk, generatePerkDeduplicationKey } = require('./perkValidator');

// In the future, import sources like githubPackAdapter, etc.
const sources = [];

async function fetchAllPerks() {
  console.log('🚀 [PerkFetcher] Starting perk fetch cycle...');
  const startTime = Date.now();
  let totalRaw = 0;
  let allValidPerks = [];
  
  // Example of how sources will be processed:
  /*
  const results = await Promise.allSettled(sources.map(source => source.fetch()));
  results.forEach(result => {
    if (result.status === 'fulfilled' && Array.isArray(result.value)) {
      totalRaw += result.value.length;
      result.value.forEach(p => {
        if (validatePerk(p)) {
          p.deduplicationKey = p.deduplicationKey || generatePerkDeduplicationKey(p.source, p.provider, p.title);
          allValidPerks.push(p);
        }
      });
    }
  });
  */

  // Deduplicate in memory
  const uniquePerksMap = new Map();
  allValidPerks.forEach(p => {
    if (!uniquePerksMap.has(p.deduplicationKey)) {
      uniquePerksMap.set(p.deduplicationKey, p);
    }
  });

  const uniquePerks = Array.from(uniquePerksMap.values());
  
  console.log(`📦 [PerkFetcher] Fetch cycle complete in ${Date.now() - startTime}ms`);
  console.log(`✅ [PerkFetcher] ${uniquePerks.length} unique new/external perks processed.`);
  
  return uniquePerks;
}

module.exports = {
  fetchAllPerks
};
