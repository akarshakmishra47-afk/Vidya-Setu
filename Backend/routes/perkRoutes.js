const express = require('express');
const router = express.Router();
const Perk = require('../models/Perk');
const User = require('../models/User');
const { fetchAllPerks } = require('../services/perks/perkFetcher');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

let lastRefresh = null;
let refreshInProgress = false;
let autoRefreshTimer = null;

// Initialize & Migrate DB on startup
async function initializePerks() {
  try {
    const mongoose = require('mongoose');
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
    
    // Insert new external perks
    for (const perk of newPerks) {
      try {
        const existing = await Perk.findOne({ deduplicationKey: perk.deduplicationKey });
        if (!existing) {
          await Perk.create(perk);
          inserted++;
        }
      } catch (e) {
        if (e.code !== 11000) console.error('[PerkRoutes] Insert error:', e);
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

// GET all perks — public
router.get('/', async (req, res) => {
  try {
    const perks = await Perk.find({ status: 'active' }).sort({ createdAt: -1 });
    res.json(perks);
  } catch (err) {
    console.error('[PerkRoutes] GET error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch perks' });
  }
});

// GET perks status — public
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

// POST trigger manual fetch — Bug 1: admin only
router.post('/fetch-latest', authenticateToken, requireAdmin, async (req, res) => {
  if (refreshInProgress) {
    return res.status(429).json({ success: false, message: 'Refresh already in progress' });
  }
  triggerPerkFetch();
  res.json({ success: true, message: 'Refresh triggered successfully' });
});

// POST claim a perk — Bug 3: use authenticateToken instead of manual jwt.verify with wrong secret
router.post('/claim/:id', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    
    const perk = await Perk.findById(req.params.id);
    if (!perk) return res.status(404).json({ success: false, message: 'Perk not found' });
    
    if (!user.claimedPerks.includes(perk._id.toString())) {
      user.claimedPerks.push(perk._id.toString());
      await user.save();
    }
    
    res.json({ success: true, message: 'Perk claimed successfully', officialUrl: perk.officialUrl });
  } catch (error) {
    console.error('[PerkRoutes] Claim error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to claim perk' });
  }
});

module.exports = router;
