const express = require('express');
const router = express.Router();
const Subject = require('../models/Subject');
const Role = require('../models/Role');

// Get all subjects
router.get('/subjects', async (req, res) => {
  try {
    const subjects = await Subject.find({});
    // Structure as an object with subject name as key, topics as value array for backward compatibility
    const structured = {};
    subjects.forEach(sub => {
      structured[sub.name] = sub.topics.map(t => ({ t: t.title, p: t.probability, y: t.years }));
    });
    res.json(structured);
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching subjects' });
  }
});

// Get all roles
router.get('/roles', async (req, res) => {
  try {
    const roles = await Role.find({});
    const structured = {};
    roles.forEach(role => {
      structured[role.title] = {
        req: role.reqSkills,
        nice: role.niceSkills,
        projs: role.projects
      };
    });
    res.json(structured);
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching roles' });
  }
});

module.exports = router;
