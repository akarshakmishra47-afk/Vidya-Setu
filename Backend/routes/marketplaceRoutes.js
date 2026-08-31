const express = require('express');
const router = express.Router();
const MarketplaceItem = require('../models/MarketplaceItem');
const User = require('../models/User');
const { uploadImage } = require('../cloudinaryConfig');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// POST /api/marketplace - List a new item — Bug 13: require auth, seller from JWT
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { title, price, orig, cond, cat, desc, photoData } = req.body;
    if (!title || price === undefined || price === null) {
      return res.status(400).json({ success: false, message: 'Title and price are required.' });
    }
    if (typeof title !== 'string' || title.length > 200) {
      return res.status(400).json({ success: false, message: 'Invalid title.' });
    }
    const numPrice = Number(price);
    if (isNaN(numPrice) || numPrice < 0) {
      return res.status(400).json({ success: false, message: 'Invalid price.' });
    }

    // Bug 13: Seller identity from authenticated JWT
    const seller = await User.findById(req.user.userId).select('name rollNo branch year profilePhoto');
    if (!seller) return res.status(404).json({ success: false, message: 'User not found' });

    // Upload image to Cloudinary if provided
    let photoUrl = '';
    if (photoData) {
      try {
        photoUrl = await uploadImage(photoData);
      } catch (uploadErr) {
        console.error('⚠️ Image upload failed, continuing without photo:', uploadErr.message);
      }
    }

    const item = new MarketplaceItem({
      title,
      price: numPrice,
      orig: Number(orig) || 0,
      cond: cond || 'Good',
      cat: cat || 'Other',
      desc: typeof desc === 'string' ? desc.substring(0, 2000) : '',
      sellerName: seller.name,
      sellerRoll: seller.rollNo,
      branch: seller.branch || '',
      year: seller.year || '',
      verified: false,
      photoUrl
    });
    await item.save();

    const itemObj = item.toObject();
    itemObj.sellerPhoto = seller.profilePhoto || '';

    res.status(201).json({ message: 'Item listed successfully', item: itemObj });
  } catch (error) {
    console.error('Marketplace create error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to list item' });
  }
});

// GET /api/marketplace/admin/all — Bug 1: Admin only
router.get('/admin/all', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const items = await MarketplaceItem.find().sort({ createdAt: -1 });
    res.status(200).json(items);
  } catch (error) {
    console.error('Marketplace admin fetch error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch items' });
  }
});

// GET /api/marketplace - Fetch all active listings with seller profile photos
router.get('/', async (req, res) => {
  try {
    const items = await MarketplaceItem.find({ active: true }).sort({ createdAt: -1 });

    // Collect unique seller roll numbers and look up their profile photos, emails, and contact numbers
    const rollNumbers = [...new Set(items.map(i => i.sellerRoll).filter(Boolean))];
    const sellers = await User.find({ rollNo: { $in: rollNumbers } }, { rollNo: 1, profilePhoto: 1, email: 1, mobileNumber: 1 });
    const sellerMap = {};
    sellers.forEach(s => { 
      sellerMap[s.rollNo] = {
        profilePhoto: s.profilePhoto,
        email: s.email,
        mobileNumber: s.mobileNumber
      }; 
    });

    // Attach seller info to each item
    const enrichedItems = items.map(item => {
      const obj = item.toObject();
      const sInfo = sellerMap[item.sellerRoll] || {};
      obj.sellerPhoto = sInfo.profilePhoto || '';
      obj.sellerEmail = sInfo.email || '';
      obj.sellerContact = sInfo.mobileNumber || '';
      return obj;
    });

    res.status(200).json(enrichedItems);
  } catch (error) {
    console.error('Marketplace fetch error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch listings' });
  }
});

// DELETE /api/marketplace/:id — Bug 13: require auth, ownership check
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const item = await MarketplaceItem.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });

    // Bug 13: Only owner or admin can delete
    if (item.sellerRoll !== req.user.rollNo && !req.user.isAdmin) {
      return res.status(403).json({ success: false, message: 'Forbidden: You can only remove your own listings' });
    }

    await MarketplaceItem.findByIdAndUpdate(req.params.id, { active: false }, { new: true });
    res.status(200).json({ success: true, message: 'Item removed from listing' });
  } catch (error) {
    console.error('Marketplace delete error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to remove item' });
  }
});

module.exports = router;
