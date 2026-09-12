const express = require('express');
const router = express.Router();
const Perk = require('../models/Perk');
const User = require('../models/User');
const { fetchAllPerks } = require('../services/perks/perkFetcher');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const mongoose = require('mongoose');

let lastRefresh = null;
let refreshInProgress = false;
let autoRefreshTimer = null;

// Initialize & Migrate DB on startup
async function initializePerks() {
  try {
    if (mongoose.connection.readyState !== 1) return; // Wait for connection

    const db = mongoose.connection.db;
    const oldPerks = await db.collection('perks').find({ items: { $exists: true } }).toArray();
    
    if (oldPerks.length > 0) {
      console.log(`[PerkRoutes] Found ${oldPerks.length} old nested perk categories. Migrating to flat schema...`);
      for (const old of oldPerks) {
        for (const item of old.items) {
          const deduplicationKey = `manual::${String(item.name).toLowerCase().replace(/[^a-z0-9]/g, '')}`;
          await Perk.updateOne(
            { deduplicationKey },
            {
              $setOnInsert: {
                title: item.name,
                description: item.val,
                provider: item.name,
                category: old.cat,
                discount: item.val,
                instructions: item.steps || [],
                officialUrl: item.url || 'https://vidyasetu.com',
                icon: item.icon,
                color: old.color,
                source: 'manual',
                sourceId: String(item.id),
                status: 'active'
              }
            },
            { upsert: true }
          );
        }
        await db.collection('perks').deleteOne({ _id: old._id });
      }
      console.log('[PerkRoutes] Migration to flat schema complete.');
    }
  } catch (error) {
    console.error('[PerkRoutes] Migration error:', error);
  }
}
setTimeout(initializePerks, 3000); // Wait for db to connect

// Fetch Latest Integration
async function triggerPerkFetch() {
  if (refreshInProgress) return;
  refreshInProgress = true;
  try {
    const newPerks = await fetchAllPerks();
    let inserted = 0;
    
    // Insert new external perks securely using upsert to avoid race conditions
    for (const perk of newPerks) {
      try {
        const result = await Perk.updateOne(
          { deduplicationKey: perk.deduplicationKey },
          { $setOnInsert: perk },
          { upsert: true }
        );
        if (result.upsertedCount > 0) {
          inserted++;
        }
      } catch (e) {
        console.error('[PerkRoutes] Insert error:', e);
      }
    }
    
    lastRefresh = new Date();
    console.log(`[PerkRoutes] Successfully processed fetch cycle. Inserted ${inserted} new external perks.`);
  } catch (error) {
    console.error('[PerkRoutes] Fetch error:', error);
  } finally {
    refreshInProgress = false;
  }
}

// Scheduled refresh (e.g. every 12 hours)
autoRefreshTimer = setInterval(() => {
  triggerPerkFetch();
}, 12 * 60 * 60 * 1000);

/**
 * Retrieves all active perks.
 * @route GET /api/perks
 * @access Public
 */
router.get('/', async (req, res) => {
  try {
    const perks = await Perk.find({ status: 'active' }).sort({ createdAt: -1 });
    res.json(perks);
  } catch (err) {
    console.error('[PerkRoutes] GET error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch perks' });
  }
});

/**
 * Retrieves platform perk statistics.
 * @route GET /api/perks/status
 * @access Public
 */
router.get('/status', async (req, res) => {
  try {
    const total = await Perk.countDocuments();
    const active = await Perk.countDocuments({ status: 'active' });
    const categories = await Perk.distinct('category');
    
    res.json({
      success: true,
      total,
      active,
      categories: categories.length,
      lastRefresh,
      refreshInProgress
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch perk stats' });
  }
});

/**
 * Manually triggers a fetch of the latest perks.
 * @route POST /api/perks/fetch-latest
 * @access Private/Admin
 */
router.post('/fetch-latest', authenticateToken, requireAdmin, async (req, res) => {
  if (refreshInProgress) {
    return res.status(429).json({ success: false, message: 'Refresh already in progress' });
  }
  triggerPerkFetch();
  res.json({ success: true, message: 'Refresh triggered successfully' });
});

/**
 * Claims a specific perk for the authenticated user.
 * @route POST /api/perks/claim/:id
 * @access Private
 */
router.post('/claim/:id', authenticateToken, async (req, res) => {
  try {
    const perkId = req.params.id;
    if (!perkId || !mongoose.Types.ObjectId.isValid(perkId)) {
      return res.status(400).json({ success: false, message: 'Invalid perk ID format' });
    }

    const perk = await Perk.findById(perkId);
    if (!perk) return res.status(404).json({ success: false, message: 'Perk not found' });
    
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    
    if (!user.claimedPerks.includes(perk._id.toString())) {
      user.claimedPerks.push(perk._id.toString());
      await user.save();
    }
    
    res.status(200).json({ success: true, message: 'Perk claimed successfully', officialUrl: perk.officialUrl });
  } catch (error) {
    console.error('[PerkRoutes] Claim error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to claim perk' });
  }
});

module.exports = router;
