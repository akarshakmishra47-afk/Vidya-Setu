const express = require('express');
const router = express.Router();
const Subject = require('../models/Subject');
const Role = require('../models/Role');
const PYQ = require('../models/PYQ');

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

// ============================================================
// PYQ (Prashna-Kosh) Endpoints — Isolated Exam Analytics API
// ============================================================

// GET /api/academic/pyqs/filters — Return dynamically available filter options
router.get('/pyqs/filters', async (req, res) => {
  try {
    const exams = await PYQ.distinct('exam');
    const branches = await PYQ.distinct('branch');
    const semesters = await PYQ.distinct('semester');
    const subjects = await PYQ.distinct('subject');

    // Create a mapping of exam -> available subjects for cascading dropdowns
    const examSubjects = {};
    for (const exam of exams) {
      examSubjects[exam] = await PYQ.distinct('subject', { exam });
    }

    res.json({
      exams,
      branches: branches.filter(Boolean),
      semesters: semesters.filter(Boolean),
      subjects,
      examSubjects
    });
  } catch (err) {
    console.error('PYQ Filters Error:', err.message);
    res.status(500).json({ error: 'Server error fetching PYQ filters' });
  }
});

// GET /api/academic/pyqs/analytics — Return analytics from VERIFIED data only
router.get('/pyqs/analytics', async (req, res) => {
  try {
    const { exam, subject, branch, semester } = req.query;
    if (!exam || !subject) {
      return res.status(400).json({ error: 'Exam and subject are required' });
    }

    // STRICT: Only verified data for analytics — never sample data
    const query = { exam, subject, isVerified: true };
    if (branch) query.branch = branch;
    if (semester) query.semester = Number(semester);

    const pyqs = await PYQ.find(query);

    // Sufficiency check: BOTH conditions must be true (AND, not OR)
    const distinctYears = new Set(pyqs.map(q => q.year));
    const hasSufficientData = pyqs.length >= 5 && distinctYears.size >= 2;

    if (!hasSufficientData) {
      return res.json({
        sufficientData: false,
        totalQuestions: pyqs.length,
        yearsCovered: distinctYears.size,
        topics: [],
        units: [],
        availableYears: Array.from(distinctYears).sort((a, b) => a - b)
      });
    }

    // Build topic analytics
    const topicsMap = {};
    const unitMap = {};

    pyqs.forEach(q => {
      // Topic aggregation
      if (!topicsMap[q.topic]) {
        topicsMap[q.topic] = {
          title: q.topic,
          yearsSet: new Set(),
          frequency: 0,
          totalMarks: 0
        };
      }
      topicsMap[q.topic].yearsSet.add(q.year);
      topicsMap[q.topic].frequency += 1;
      topicsMap[q.topic].totalMarks += (q.marks || 0);

      // Unit aggregation
      if (q.unit) {
        if (!unitMap[q.unit]) unitMap[q.unit] = { unit: q.unit, questions: 0 };
        unitMap[q.unit].questions += 1;
      }
    });

    const yearsCovered = distinctYears.size;
    const availableYears = Array.from(distinctYears).sort((a, b) => a - b);

    // Unit coverage percentages (from verified data only)
    const units = Object.values(unitMap).map(u => ({
      u: u.unit,
      c: Math.round((u.questions / pyqs.length) * 100)
    })).sort((a, b) => a.u - b.u);

    // Topic probabilities (based on years appeared vs total years)
    const topics = Object.values(topicsMap).map(t => {
      const probability = Math.round((t.yearsSet.size / yearsCovered) * 100);
      return {
        t: t.title,
        p: probability,
        y: Array.from(t.yearsSet).sort((a, b) => a - b),
        frequency: t.frequency,
        totalMarks: t.totalMarks
      };
    }).sort((a, b) => b.p - a.p);

    res.json({
      sufficientData: true,
      totalQuestions: pyqs.length,
      yearsCovered,
      topics,
      units,
      availableYears
    });
  } catch (err) {
    console.error('PYQ Analytics Error:', err.message);
    res.status(500).json({ error: 'Server error generating PYQ analytics' });
  }
});

// GET /api/academic/pyqs/questions — Return PYQ questions (verified + sample)
router.get('/pyqs/questions', async (req, res) => {
  try {
    const { exam, subject, topic, year, verified } = req.query;
    if (!exam || !subject) {
      return res.status(400).json({ error: 'Exam and subject are required' });
    }

    const query = { exam, subject };
    if (topic) query.topic = topic;
    if (year) query.year = Number(year);
    if (verified === 'true') query.isVerified = true;
    if (verified === 'false') query.isVerified = false;

    const pyqs = await PYQ.find(query).sort({ year: -1, topic: 1 });

    // Always expose verification fields for every question
    const result = pyqs.map(q => ({
      _id: q._id,
      exam: q.exam,
      branch: q.branch,
      semester: q.semester,
      subject: q.subject,
      year: q.year,
      unit: q.unit,
      topic: q.topic,
      question: q.question,
      marks: q.marks,
      questionType: q.questionType,
      difficulty: q.difficulty,
      isVerified: q.isVerified,
      isSampleData: q.isSampleData,
      source: q.source,
      sourceYear: q.sourceYear
    }));

    res.json(result);
  } catch (err) {
    console.error('PYQ Questions Error:', err.message);
    res.status(500).json({ error: 'Server error fetching PYQ questions' });
  }
});

module.exports = router;
