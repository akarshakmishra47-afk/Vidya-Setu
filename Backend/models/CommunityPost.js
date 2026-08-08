const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  authorName: { type: String, required: true },
  authorRoll: { type: String, required: true },
  authorPhoto: { type: String, default: '' },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const communityPostSchema = new mongoose.Schema({
  authorName: { type: String, required: true },
  authorRoll: { type: String, required: true },
  authorPhoto: { type: String, default: '' },
  title: { type: String, required: true },
  content: { type: String, required: true },
  photoUrl: { type: String, default: '' },
  category: { type: String, default: 'Doubt' },
  comments: [commentSchema],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('CommunityPost', communityPostSchema);
