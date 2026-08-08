const express = require('express');
const Job = require('../models/Job');
const { fetchLatestJobs } = require('../fetchJobs');

const router = express.Router();

// GET all jobs/internships (with optional query filters)
router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.type) filter.primaryType = req.query.type;
    if (req.query.secondaryType) filter.secondaryType = req.query.secondaryType;
    if (req.query.isAktu !== undefined) filter.isAktu = req.query.isAktu === 'true';

    const jobs = await Job.find(filter).sort({ createdAt: -1 });
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch jobs data" });
  }
});

// ⚠️  IMPORTANT: these named routes MUST come before  /:id  or they'd be swallowed
// GET /api/jobs/stats/summary — for admin dashboard stats cards
router.get('/stats/summary', async (req, res) => {
  try {
    const total = await Job.countDocuments();
    const paid = await Job.countDocuments({ primaryType: 'Internship', secondaryType: 'Paid' });
    const free = await Job.countDocuments({ primaryType: 'Internship', secondaryType: 'Free' });
    const aktuJobs = await Job.countDocuments({ primaryType: 'Job', isAktu: true });
    const webFetched = await Job.countDocuments({ source: 'web' });
    const manual = await Job.countDocuments({ source: 'manual' });

    res.json({ total, paid, free, aktuJobs, webFetched, manual });
  } catch (error) {
    res.status(500).json({ error: "Failed to get stats" });
  }
});

// POST /api/jobs/fetch-latest — fetch from web feeds & upsert into DB
router.post('/fetch-latest', async (req, res) => {
  try {
    const { paidInternships, freeInternships, aktusJobs } = await fetchLatestJobs();
    const allJobs = [...paidInternships, ...freeInternships, ...aktusJobs];

    let inserted = 0;
    let updated = 0;

    for (const jobData of allJobs) {
      // Upsert by title + company to avoid duplicates
      const existing = await Job.findOne({ title: jobData.title, company: jobData.company });
      if (!existing) {
        await Job.create(jobData);
        inserted++;
      } else {
        await Job.findOneAndUpdate(
          { title: jobData.title, company: jobData.company },
          { $set: jobData },
          { new: true }
        );
        updated++;
      }
    }

    const total = await Job.countDocuments();
    res.json({
      success: true,
      message: `Synced ${allJobs.length} listings — ${inserted} new, ${updated} updated`,
      totalInDB: total,
      breakdown: {
        paid: paidInternships.length,
        free: freeInternships.length,
        aktuJobs: aktusJobs.length
      }
    });
  } catch (error) {
    console.error('Fetch-latest error:', error);
    res.status(500).json({ error: "Failed to fetch latest jobs: " + error.message });
  }
});

// POST / — create a new job (admin manual entry)
router.post('/', async (req, res) => {
  try {
    const job = new Job(req.body);
    await job.save();
    res.status(201).json(job);
  } catch (error) {
    res.status(400).json({ error: error.message || "Failed to create job" });
  }
});

// GET /:id — single job (must come AFTER named GET routes)
router.get('/:id', async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ error: "Job not found" });
    res.json(job);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch job" });
  }
});

// DELETE /:id — delete a job by ID (admin use)
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Job.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Job not found" });
    res.json({ success: true, message: "Job deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete job" });
  }
});

module.exports = router;
