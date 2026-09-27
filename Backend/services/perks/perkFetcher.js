const Perk = require('../../models/Perk');
const { validatePerk, generatePerkDeduplicationKey } = require('./perkValidator');

// In the future, import sources like githubPackAdapter, etc.
const sources = [];

async function fetchAllPerks() {
  console.log('🚀 [PerkFetcher] Starting perk fetch cycle...');
  const startTime = Date.now();
  let totalRaw = 0;
  let allValidPerks = [];


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
