const express = require('express');
const router = express.Router();
const CommunityPost = require('../models/CommunityPost');
const { uploadImage } = require('../cloudinaryConfig');
const { authenticateToken } = require('../middleware/auth');

// GET /api/community - Fetch all posts (public read)
router.get('/', async (req, res) => {
  try {
    const posts = await CommunityPost.find().sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) {
    console.error('Community fetch error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch posts' });
  }
});

// POST /api/community - Create a new post — Bug 12: require auth, identity from JWT
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { title, content, photoData, category } = req.body;

    if (!title || !content) {
      return res.status(400).json({ success: false, message: 'Title and content are required.' });
    }
    if (typeof title !== 'string' || title.length > 200) {
      return res.status(400).json({ success: false, message: 'Invalid title.' });
    }
    if (typeof content !== 'string' || content.length > 5000) {
      return res.status(400).json({ success: false, message: 'Content too long (max 5000 characters).' });
    }
    
    let photoUrl = '';
    if (photoData) {
      photoUrl = await uploadImage(photoData);
    }

    // Bug 12: Author identity from authenticated JWT, not from request body
    const User = require('../models/User');
    const user = await User.findById(req.user.userId).select('name rollNo profilePhoto');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const newPost = new CommunityPost({
      authorName: user.name,
      authorRoll: user.rollNo,
      authorPhoto: user.profilePhoto || '',
      title,
      content,
      photoUrl,
      category: category || 'Doubt'
    });

    await newPost.save();
    res.status(201).json(newPost);
  } catch (err) {
    console.error('Community create error:', err.message);
    res.status(400).json({ success: false, message: 'Failed to create post' });
  }
});

// POST /api/community/:id/comment - Add a comment — Bug 12: require auth
router.post('/:id/comment', authenticateToken, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string' || text.length > 2000) {
      return res.status(400).json({ success: false, message: 'Valid comment text required (max 2000 characters).' });
    }

    const post = await CommunityPost.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

    // Identity from JWT
    const User = require('../models/User');
    const user = await User.findById(req.user.userId).select('name rollNo profilePhoto');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    post.comments.push({
      authorName: user.name,
      authorRoll: user.rollNo,
      authorPhoto: user.profilePhoto || '',
      text
    });
    await post.save();
    
    res.json(post);
  } catch (err) {
    console.error('Community comment error:', err.message);
    res.status(400).json({ success: false, message: 'Failed to add comment' });
  }
});

// DELETE /api/community/:id - Delete a post — Bug 12: auth + ownership check
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const post = await CommunityPost.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
    
    // Bug 12: Only owner or admin can delete
    if (post.authorRoll !== req.user.rollNo && !req.user.isAdmin) {
      return res.status(403).json({ success: false, message: 'Forbidden: You can only delete your own posts' });
    }

    await post.deleteOne();
    res.json({ success: true, message: 'Post deleted' });
  } catch (err) {
    console.error('Community delete error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to delete post' });
  }
});

module.exports = router;
