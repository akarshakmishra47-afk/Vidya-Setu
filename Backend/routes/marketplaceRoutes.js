const express = require('express');
const router = express.Router();
const MarketplaceItem = require('../models/MarketplaceItem');
const User = require('../models/User');
const { uploadImage } = require('../cloudinaryConfig');

// POST /api/marketplace - List a new item for sale
router.post('/', async (req, res) => {
  try {
    const { title, price, orig, cond, cat, desc, sellerName, sellerRoll, branch, year, verified, photoData } = req.body;
    if (!title || !price || !sellerName || !sellerRoll) {
      return res.status(400).json({ error: 'title, price, sellerName and sellerRoll are required.' });
    }

    // Upload image to Cloudinary if provided
    let photoUrl = '';
    if (photoData) {
      try {
        photoUrl = await uploadImage(photoData);
        console.log('✅ Image uploaded to Cloudinary:', photoUrl);
      } catch (uploadErr) {
        console.error('⚠️ Image upload failed, continuing without photo:', uploadErr.message);
        // Continue without photo rather than failing the entire listing
      }
    }

    const item = new MarketplaceItem({ title, price, orig, cond, cat, desc, sellerName, sellerRoll, branch, year, verified, photoUrl });
    await item.save();

    // Look up seller's profile photo to include in the response
    let sellerPhoto = '';
    try {
      const seller = await User.findOne({ rollNo: sellerRoll }, { profilePhoto: 1 });
      if (seller && seller.profilePhoto) sellerPhoto = seller.profilePhoto;
    } catch (_) { }

    const itemObj = item.toObject();
    itemObj.sellerPhoto = sellerPhoto;

    res.status(201).json({ message: 'Item listed successfully', item: itemObj });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/marketplace/admin/all - Admin only: fetch ALL items (including inactive)
router.get('/admin/all', async (req, res) => {
  try {
    const items = await MarketplaceItem.find().sort({ createdAt: -1 });
    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/marketplace - Fetch all active listings with seller profile photos
router.get('/', async (req, res) => {
  try {
    const items = await MarketplaceItem.find({ active: true }).sort({ createdAt: -1 });

    // Collect unique seller roll numbers and look up their profile photos
    const rollNumbers = [...new Set(items.map(i => i.sellerRoll).filter(Boolean))];
    const sellers = await User.find({ rollNo: { $in: rollNumbers } }, { rollNo: 1, profilePhoto: 1 });
    const photoMap = {};
    sellers.forEach(s => { if (s.profilePhoto) photoMap[s.rollNo] = s.profilePhoto; });

    // Attach sellerPhoto to each item
    const enrichedItems = items.map(item => {
      const obj = item.toObject();
      obj.sellerPhoto = photoMap[item.sellerRoll] || '';
      return obj;
    });

    res.status(200).json(enrichedItems);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/marketplace/:id - Mark item as sold/removed
router.delete('/:id', async (req, res) => {
  try {
    const item = await MarketplaceItem.findByIdAndUpdate(req.params.id, { active: false }, { new: true });
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.status(200).json({ message: 'Item removed from listing', item });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

