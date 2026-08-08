const express = require('express');
const router = express.Router();
const CommunityPost = require('../models/CommunityPost');
const { uploadImage } = require('../cloudinaryConfig');

// GET /api/community - Fetch all posts
router.get('/', async (req, res) => {
  try {
    const posts = await CommunityPost.find().sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/community - Create a new post
router.post('/', async (req, res) => {
  try {
    const { authorName, authorRoll, authorPhoto, title, content, photoData, category } = req.body;
    
    let photoUrl = '';
    if (photoData) {
      photoUrl = await uploadImage(photoData);
    }

    const newPost = new CommunityPost({
      authorName,
      authorRoll,
      authorPhoto,
      title,
      content,
      photoUrl,
      category
    });

    await newPost.save();
    res.status(201).json(newPost);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/community/:id/comment - Add a comment
router.post('/:id/comment', async (req, res) => {
  try {
    const { authorName, authorRoll, authorPhoto, text } = req.body;
    const post = await CommunityPost.findById(req.params.id);
    
    if (!post) return res.status(404).json({ error: 'Post not found' });

    post.comments.push({ authorName, authorRoll, authorPhoto, text });
    await post.save();
    
    res.json(post);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/community/:id - Delete a post
router.delete('/:id', async (req, res) => {
  try {
    const post = await CommunityPost.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    
    // In a real app, we'd check if the user is the author
    await post.deleteOne();
    res.json({ message: 'Post deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
