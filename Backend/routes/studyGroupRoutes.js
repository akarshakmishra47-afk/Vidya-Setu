const express = require('express');
const router = express.Router();
const StudyGroup = require('../models/StudyGroup');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

// GET /api/study-groups - Fetch all study groups
router.get('/', async (req, res) => {
  try {
    const groups = await StudyGroup.find().sort({ createdAt: -1 });
    res.json(groups);
  } catch (err) {
    console.error('Fetch study groups error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch study groups' });
  }
});

// POST /api/study-groups - Create a new study group
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, desc, branch, year } = req.body;
    
    if (!name) return res.status(400).json({ success: false, message: 'Name is required' });

    const user = await User.findById(req.user.userId).select('name rollNo');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const newGroup = new StudyGroup({
      name,
      desc: desc || '',
      branch: branch || 'All Branches',
      year: year || 'All Years',
      createdBy: user.name,
      authorRoll: user.rollNo,
      members: [user.rollNo] // Creator automatically joins
    });

    await newGroup.save();
    res.status(201).json(newGroup);
  } catch (err) {
    console.error('Create study group error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to create study group' });
  }
});

// POST /api/study-groups/:id/join - Join a study group
router.post('/:id/join', authenticateToken, async (req, res) => {
  try {
    const group = await StudyGroup.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });

    const user = await User.findById(req.user.userId).select('rollNo');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (!group.members.includes(user.rollNo)) {
      group.members.push(user.rollNo);
      await group.save();
    }
    
    res.json(group);
  } catch (err) {
    console.error('Join study group error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to join study group' });
  }
});

// POST /api/study-groups/:id/chat - Add a chat message
router.post('/:id/chat', authenticateToken, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ success: false, message: 'Text is required' });

    const group = await StudyGroup.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });

    const user = await User.findById(req.user.userId).select('name rollNo');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Check if user is a member
    if (!group.members.includes(user.rollNo)) {
      return res.status(403).json({ success: false, message: 'You must join the group to chat' });
    }

    const newMsg = {
      authorName: user.name,
      authorRoll: user.rollNo,
      text: text
    };

    group.messages.push(newMsg);
    await group.save();

    res.json(newMsg);
  } catch (err) {
    console.error('Group chat error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to send message' });
  }
});

module.exports = router;
