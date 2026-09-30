const mongoose = require('mongoose');

const marketplaceItemSchema = new mongoose.Schema({
  // Core fields (preserved from original schema for backward compatibility)
  title:       { type: String, required: true, maxlength: 200 },
  price:       { type: Number, default: 0 },        // 0 for Free/Wanted
  orig:        { type: Number, default: 0 },         // Original MRP
  cond:        { type: String, default: 'Good', enum: ['Like New', 'Good', 'Used', 'Digital', 'N/A'] },
  cat:         { type: String, default: 'Other' },   // Main category
  subcat:      { type: String, default: '' },        // Subcategory (new)
  desc:        { type: String, default: '' },

  // Seller identity — always derived from JWT, never trusted from frontend
  sellerName:  { type: String, required: true },
  sellerRoll:  { type: String, required: true },
  branch:      { type: String, default: '' },
  year:        { type: String, default: '' },
  verified:    { type: Boolean, default: false },

  // Image (kept as single URL, same Cloudinary flow)
  photoUrl:    { type: String, default: '' },

  // === NEW FIELDS ===

  // Listing type: what kind of transaction this is
  listingType: {
    type: String,
    default: 'sell',
    enum: ['sell', 'rent', 'exchange', 'free', 'wanted']
  },

  // Listing lifecycle status
  status: {
    type: String,
    default: 'available',
    enum: ['available', 'reserved', 'sold', 'claimed', 'fulfilled', 'closed']
  },

  // Campus meetup / pickup location (optional)
  location:    { type: String, default: '' },

  // Exchange preference description (shown only for exchange listings)
  exchangeFor: { type: String, default: '' },

  // Rental info (optional, for rent listings)
  rentalPeriod: { type: String, default: '' },  // e.g., "Per day", "Per week"
  rentalDeposit: { type: Number, default: 0 },

  // Wanted-specific: needed by date
  neededBy:    { type: Date, default: null },

  // Saved/favorited by list of user rollNos
  savedBy:     [{ type: String }],

  // Reports
  reports: [{
    reporterRoll: { type: String },
    reason: { type: String },
    reportedAt: { type: Date, default: Date.now }
  }],

  // Replaces original boolean `active` — backward compat: if active was false, status becomes 'closed'
  active:      { type: Boolean, default: true },

}, { timestamps: true });

// Index for common query patterns
marketplaceItemSchema.index({ active: 1, listingType: 1, createdAt: -1 });
marketplaceItemSchema.index({ sellerRoll: 1 });

module.exports = mongoose.model('MarketplaceItem', marketplaceItemSchema);
