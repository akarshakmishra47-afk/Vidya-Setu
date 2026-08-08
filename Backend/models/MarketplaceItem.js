const mongoose = require('mongoose');

const marketplaceItemSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  price:       { type: Number, required: true },
  orig:        { type: Number, default: 0 },
  cond:        { type: String, default: 'Good' },
  cat:         { type: String, default: 'Other' },
  desc:        { type: String, default: '' },
  sellerName:  { type: String, required: true },
  sellerRoll:  { type: String, required: true },
  branch:      { type: String, default: '' },
  year:        { type: String, default: '' },
  verified:    { type: Boolean, default: false },
  photoUrl:    { type: String, default: '' },
  active:      { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('MarketplaceItem', marketplaceItemSchema);
