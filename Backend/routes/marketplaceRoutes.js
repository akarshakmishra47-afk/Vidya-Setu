const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const MarketplaceItem = require('../models/MarketplaceItem');
const User = require('../models/User');
const { uploadImage } = require('../cloudinaryConfig');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

/* ─────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────── */

/** Attach seller contact info (photo, email, mobile) from User docs to items */
async function enrichWithSellerInfo(items) {
  const rollNumbers = [...new Set(items.map(i => i.sellerRoll).filter(Boolean))];
  const sellers = await User.find(
    { rollNo: { $in: rollNumbers } },
    { rollNo: 1, profilePhoto: 1, email: 1, mobileNumber: 1 }
  );
  const sellerMap = {};
  sellers.forEach(s => {
    sellerMap[s.rollNo] = {
      profilePhoto: s.profilePhoto || '',
      email: s.email || '',
      mobileNumber: s.mobileNumber || ''
    };
  });
  return items.map(item => {
    const obj = item.toObject ? item.toObject() : { ...item };
    const sInfo = sellerMap[item.sellerRoll] || {};
    obj.sellerPhoto   = sInfo.profilePhoto || '';
    obj.sellerEmail   = sInfo.email || '';
    obj.sellerContact = sInfo.mobileNumber || '';
    return obj;
  });
}

/** Validate MongoDB ObjectId */
function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

/* ─────────────────────────────────────────────────────────
   GET /api/marketplace/stats  — dynamic counts for dashboard
───────────────────────────────────────────────────────── */
router.get('/stats', async (req, res) => {
  try {
    const [total, byType] = await Promise.all([
      MarketplaceItem.countDocuments({ active: true }),
      MarketplaceItem.aggregate([
        { $match: { active: true } },
        { $group: { _id: { $ifNull: ['$listingType', 'sell'] }, count: { $sum: 1 } } }
      ])
    ]);
    const counts = { total, sell: 0, rent: 0, exchange: 0, free: 0, wanted: 0 };
    byType.forEach(b => { if (b._id && counts[b._id] !== undefined) counts[b._id] = b.count; });
    res.status(200).json(counts);
  } catch (error) {
    console.error('Marketplace stats error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
});

/* ─────────────────────────────────────────────────────────
   GET /api/marketplace/admin/all  — admin: see ALL items
───────────────────────────────────────────────────────── */
router.get('/admin/all', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const items = await MarketplaceItem.find().sort({ createdAt: -1 });
    const enriched = await enrichWithSellerInfo(items);
    res.status(200).json(enriched);
  } catch (error) {
    console.error('Marketplace admin fetch error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch items' });
  }
});

/* ─────────────────────────────────────────────────────────
   GET /api/marketplace/mine  — authenticated: my listings
───────────────────────────────────────────────────────── */
router.get('/mine', authenticateToken, async (req, res) => {
  try {
    const items = await MarketplaceItem.find({ sellerRoll: req.user.rollNo }).sort({ createdAt: -1 });
    const enriched = await enrichWithSellerInfo(items);
    res.status(200).json(enriched);
  } catch (error) {
    console.error('My listings error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch your listings' });
  }
});

/* ─────────────────────────────────────────────────────────
   GET /api/marketplace/saved  — authenticated: saved items
───────────────────────────────────────────────────────── */
router.get('/saved', authenticateToken, async (req, res) => {
  try {
    const items = await MarketplaceItem.find({
      active: true,
      savedBy: req.user.rollNo
    }).sort({ createdAt: -1 });
    const enriched = await enrichWithSellerInfo(items);
    res.status(200).json(enriched);
  } catch (error) {
    console.error('Saved items error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch saved items' });
  }
});

/* ─────────────────────────────────────────────────────────
   GET /api/marketplace  — public: active listings with filters
   Query params:
     listingType, cat, status, search, sort, page, limit, minPrice, maxPrice
───────────────────────────────────────────────────────── */
router.get('/', async (req, res) => {
  try {
    const {
      listingType, cat, status, search,
      sort = 'newest', page = 1, limit = 50,
      minPrice, maxPrice
    } = req.query;

    const andConditions = [{ active: true }];

    // Filter by listing type (legacy items without listingType default to 'sell')
    const validTypes = ['sell', 'rent', 'exchange', 'free', 'wanted'];
    if (listingType && validTypes.includes(listingType)) {
      if (listingType === 'sell') {
        andConditions.push({
          $or: [
            { listingType: 'sell' },
            { listingType: { $exists: false } },
            { listingType: null }
          ]
        });
      } else {
        andConditions.push({ listingType });
      }
    }

    // Filter by status (default: available or reserved, plus legacy docs with no status set)
    const validStatuses = ['available', 'reserved', 'sold', 'claimed', 'fulfilled', 'closed'];
    if (status && validStatuses.includes(status)) {
      if (status === 'available') {
        andConditions.push({
          $or: [
            { status: 'available' },
            { status: { $exists: false } },
            { status: null }
          ]
        });
      } else {
        andConditions.push({ status });
      }
    } else {
      // By default only show available/reserved (not sold/closed)
      andConditions.push({
        $or: [
          { status: { $in: ['available', 'reserved'] } },
          { status: { $exists: false } },
          { status: null }
        ]
      });
    }

    // Filter by category
    if (cat && cat !== 'All') {
      andConditions.push({ cat });
    }

    // Price range (only for non-free/wanted)
    if (minPrice !== undefined || maxPrice !== undefined) {
      const priceCond = {};
      if (minPrice !== undefined) priceCond.$gte = Number(minPrice);
      if (maxPrice !== undefined) priceCond.$lte = Number(maxPrice);
      andConditions.push({ price: priceCond });
    }

    // Search across title, description, category, subcategory
    if (search && search.trim()) {
      const q = search.trim();
      andConditions.push({
        $or: [
          { title:  { $regex: q, $options: 'i' } },
          { desc:   { $regex: q, $options: 'i' } },
          { cat:    { $regex: q, $options: 'i' } },
          { subcat: { $regex: q, $options: 'i' } },
          { sellerName: { $regex: q, $options: 'i' } },
          { location: { $regex: q, $options: 'i' } }
        ]
      });
    }

    const filter = andConditions.length > 1 ? { $and: andConditions } : andConditions[0];

    // Sorting
    let sortObj = { createdAt: -1 }; // default: newest
    if (sort === 'price_asc')  sortObj = { price: 1, createdAt: -1 };
    if (sort === 'price_desc') sortObj = { price: -1, createdAt: -1 };
    if (sort === 'updated')    sortObj = { updatedAt: -1 };

    const skip = (Number(page) - 1) * Number(limit);

    const [items, total] = await Promise.all([
      MarketplaceItem.find(filter).sort(sortObj).skip(skip).limit(Number(limit)),
      MarketplaceItem.countDocuments(filter)
    ]);

    const enriched = await enrichWithSellerInfo(items);

    res.status(200).json({ items: enriched, total, page: Number(page), limit: Number(limit) });
  } catch (error) {
    console.error('Marketplace fetch error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch listings' });
  }
});

/* ─────────────────────────────────────────────────────────
   GET /api/marketplace/:id  — single listing detail
───────────────────────────────────────────────────────── */
router.get('/:id', async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid listing ID' });
    }
    const item = await MarketplaceItem.findById(req.params.id);
    if (!item || !item.active) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }
    const [enriched] = await enrichWithSellerInfo([item]);
    res.status(200).json(enriched);
  } catch (error) {
    console.error('Marketplace item fetch error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch listing' });
  }
});

/* ─────────────────────────────────────────────────────────
   POST /api/marketplace  — create listing (auth required)
───────────────────────────────────────────────────────── */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      title, price, orig, cond, cat, subcat, desc, photoData,
      listingType, location, exchangeFor, rentalPeriod, rentalDeposit, neededBy
    } = req.body;

    // --- Validate required fields ---
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Title is required.' });
    }
    if (title.length > 200) {
      return res.status(400).json({ success: false, message: 'Title is too long (max 200 chars).' });
    }

    // Valid listing types
    const validTypes = ['sell', 'rent', 'exchange', 'free', 'wanted'];
    const type = (listingType || 'sell').toLowerCase();
    if (!validTypes.includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid listing type.' });
    }

    // Price validation (free/wanted don't require price)
    let numPrice = 0;
    if (type !== 'free' && type !== 'wanted') {
      numPrice = Number(price);
      if (isNaN(numPrice) || numPrice < 0) {
        return res.status(400).json({ success: false, message: 'Invalid price.' });
      }
    }

    // Seller identity from JWT (never from frontend)
    const seller = await User.findById(req.user.userId)
      .select('name rollNo branch year profilePhoto verified');
    if (!seller) return res.status(404).json({ success: false, message: 'User not found' });

    // Image upload
    let photoUrl = '';
    if (photoData && type !== 'wanted') {
      try {
        photoUrl = await uploadImage(photoData);
      } catch (uploadErr) {
        console.error('⚠️ Image upload failed:', uploadErr.message);
      }
    }

    // Validate condition enum
    const validConds = ['Like New', 'Good', 'Used', 'Digital', 'N/A'];
    const itemCond = validConds.includes(cond) ? cond : (type === 'wanted' ? 'N/A' : 'Good');

    const item = new MarketplaceItem({
      title: title.trim(),
      price: numPrice,
      orig: Number(orig) || numPrice,
      cond: itemCond,
      cat: cat || 'Other',
      subcat: subcat || '',
      desc: typeof desc === 'string' ? desc.substring(0, 2000) : '',
      sellerName: seller.name,
      sellerRoll: seller.rollNo,
      branch: seller.branch || '',
      year: seller.year || '',
      verified: !!seller.verified,
      photoUrl,
      listingType: type,
      status: 'available',
      location: typeof location === 'string' ? location.substring(0, 100) : '',
      exchangeFor: typeof exchangeFor === 'string' ? exchangeFor.substring(0, 300) : '',
      rentalPeriod: typeof rentalPeriod === 'string' ? rentalPeriod.substring(0, 50) : '',
      rentalDeposit: Number(rentalDeposit) || 0,
      neededBy: neededBy ? new Date(neededBy) : null,
    });
    await item.save();

    const itemObj = item.toObject();
    itemObj.sellerPhoto   = seller.profilePhoto || '';
    itemObj.sellerEmail   = '';
    itemObj.sellerContact = '';

    res.status(201).json({ success: true, message: 'Item listed successfully', item: itemObj });
  } catch (error) {
    console.error('Marketplace create error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to list item' });
  }
});

/* ─────────────────────────────────────────────────────────
   PUT /api/marketplace/:id  — edit listing (owner only)
───────────────────────────────────────────────────────── */
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid listing ID' });
    }

    const item = await MarketplaceItem.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Listing not found' });

    // Ownership check
    if (item.sellerRoll !== req.user.rollNo && !req.user.isAdmin) {
      return res.status(403).json({ success: false, message: 'Forbidden: You can only edit your own listings' });
    }

    const {
      title, price, orig, cond, cat, subcat, desc, photoData,
      listingType, location, exchangeFor, rentalPeriod, rentalDeposit, neededBy
    } = req.body;

    // Fields to update
    const updates = {};

    if (title && typeof title === 'string' && title.trim().length > 0) {
      if (title.length > 200) return res.status(400).json({ success: false, message: 'Title too long.' });
      updates.title = title.trim();
    }

    const validTypes = ['sell', 'rent', 'exchange', 'free', 'wanted'];
    if (listingType && validTypes.includes(listingType.toLowerCase())) {
      updates.listingType = listingType.toLowerCase();
    }

    const type = updates.listingType || item.listingType;

    if (price !== undefined && type !== 'free' && type !== 'wanted') {
      const numPrice = Number(price);
      if (!isNaN(numPrice) && numPrice >= 0) updates.price = numPrice;
    }
    if (orig !== undefined) updates.orig = Number(orig) || item.orig;
    if (cat) updates.cat = cat;
    if (subcat !== undefined) updates.subcat = subcat.substring(0, 50);
    if (desc !== undefined) updates.desc = desc.substring(0, 2000);
    if (location !== undefined) updates.location = location.substring(0, 100);
    if (exchangeFor !== undefined) updates.exchangeFor = exchangeFor.substring(0, 300);
    if (rentalPeriod !== undefined) updates.rentalPeriod = rentalPeriod.substring(0, 50);
    if (rentalDeposit !== undefined) updates.rentalDeposit = Number(rentalDeposit) || 0;
    if (neededBy !== undefined) updates.neededBy = neededBy ? new Date(neededBy) : null;

    const validConds = ['Like New', 'Good', 'Used', 'Digital', 'N/A'];
    if (cond && validConds.includes(cond)) updates.cond = cond;

    // Handle new image upload
    if (photoData) {
      try {
        updates.photoUrl = await uploadImage(photoData);
      } catch (uploadErr) {
        console.error('⚠️ Image upload failed on edit:', uploadErr.message);
      }
    }

    const updated = await MarketplaceItem.findByIdAndUpdate(req.params.id, updates, { new: true });
    const [enriched] = await enrichWithSellerInfo([updated]);
    res.status(200).json({ success: true, message: 'Listing updated', item: enriched });
  } catch (error) {
    console.error('Marketplace edit error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to update listing' });
  }
});

/* ─────────────────────────────────────────────────────────
   PATCH /api/marketplace/:id/status  — update listing status (owner/admin)
───────────────────────────────────────────────────────── */
router.patch('/:id/status', authenticateToken, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid listing ID' });
    }

    const item = await MarketplaceItem.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Listing not found' });

    if (item.sellerRoll !== req.user.rollNo && !req.user.isAdmin) {
      return res.status(403).json({ success: false, message: 'Forbidden: You can only update your own listing status' });
    }

    const { status } = req.body;
    const validStatuses = ['available', 'reserved', 'sold', 'claimed', 'fulfilled', 'closed'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value.' });
    }

    const updates = { status };
    // If marking as sold/closed/claimed/fulfilled, set active false so it doesn't show in main listing
    if (['sold', 'closed', 'claimed', 'fulfilled'].includes(status)) {
      updates.active = false;
    } else {
      updates.active = true;
    }

    const updated = await MarketplaceItem.findByIdAndUpdate(req.params.id, updates, { new: true });
    res.status(200).json({ success: true, message: `Listing marked as ${status}`, item: updated });
  } catch (error) {
    console.error('Marketplace status error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to update status' });
  }
});

/* ─────────────────────────────────────────────────────────
   POST /api/marketplace/:id/save  — toggle save/unsave (auth)
───────────────────────────────────────────────────────── */
router.post('/:id/save', authenticateToken, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid listing ID' });
    }

    const item = await MarketplaceItem.findById(req.params.id);
    if (!item || !item.active) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }

    const rollNo = req.user.rollNo;
    const alreadySaved = item.savedBy.includes(rollNo);

    const update = alreadySaved
      ? { $pull: { savedBy: rollNo } }
      : { $addToSet: { savedBy: rollNo } };

    await MarketplaceItem.findByIdAndUpdate(req.params.id, update);
    res.status(200).json({ success: true, saved: !alreadySaved });
  } catch (error) {
    console.error('Marketplace save error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to save listing' });
  }
});

/* ─────────────────────────────────────────────────────────
   POST /api/marketplace/:id/report  — report a listing (auth)
───────────────────────────────────────────────────────── */
router.post('/:id/report', authenticateToken, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid listing ID' });
    }

    const item = await MarketplaceItem.findById(req.params.id);
    if (!item || !item.active) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }

    const { reason } = req.body;
    const validReasons = ['Spam', 'Wrong information', 'Inappropriate content', 'Scam/suspicious', 'Other'];
    if (!reason || !validReasons.includes(reason)) {
      return res.status(400).json({ success: false, message: 'Please select a valid report reason.' });
    }

    // Prevent duplicate reports from same user
    const alreadyReported = item.reports.some(r => r.reporterRoll === req.user.rollNo);
    if (alreadyReported) {
      return res.status(400).json({ success: false, message: 'You have already reported this listing.' });
    }

    await MarketplaceItem.findByIdAndUpdate(req.params.id, {
      $push: { reports: { reporterRoll: req.user.rollNo, reason, reportedAt: new Date() } }
    });

    res.status(200).json({ success: true, message: 'Report submitted. Thank you.' });
  } catch (error) {
    console.error('Marketplace report error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to submit report' });
  }
});

/* ─────────────────────────────────────────────────────────
   DELETE /api/marketplace/:id  — deactivate listing (owner/admin)
───────────────────────────────────────────────────────── */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid listing ID' });
    }

    const item = await MarketplaceItem.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });

    if (item.sellerRoll !== req.user.rollNo && !req.user.isAdmin) {
      return res.status(403).json({ success: false, message: 'Forbidden: You can only remove your own listings' });
    }

    await MarketplaceItem.findByIdAndUpdate(req.params.id, { active: false, status: 'closed' });
    res.status(200).json({ success: true, message: 'Listing removed' });
  } catch (error) {
    console.error('Marketplace delete error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to remove listing' });
  }
});

module.exports = router;
