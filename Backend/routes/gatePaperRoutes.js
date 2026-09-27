const express = require('express');
const multer = require('multer');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const GatePaper = require('../models/GatePaper');
const { cloudinary } = require('../cloudinaryConfig');

const router = express.Router();

const maxMb = Number(process.env.MAX_GATE_PDF_MB) || 10;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxMb * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Only PDF files are allowed'), false);
    }
    cb(null, true);
  }
});

// Middleware to catch multer errors cleanly
const uploadMiddleware = (req, res, next) => {
  upload.single('gatePdf')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: `File too large. Maximum size is ${maxMb}MB.` });
      }
      return res.status(400).json({ error: err.message });
    }
    next();
  });
};

router.post('/upload', authenticateToken, requireAdmin, uploadMiddleware, async (req, res) => {
  try {
    const { paperCode, year, title, set = '' } = req.body;

    if (!paperCode || !year || !title) {
      return res.status(400).json({ error: 'paperCode, year, and title are required.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'PDF file is required (field: gatePdf).' });
    }

    const upperPaperCode = paperCode.trim().toUpperCase();
    const numYear = Number(year);

    const existing = await GatePaper.findOne({ paperCode: upperPaperCode, year: numYear, set });
    if (existing) {
      return res.status(409).json({ error: 'A GATE paper with this code, year, and set already exists.' });
    }

    const publicId = `${upperPaperCode}-${numYear}${set ? `-${set}` : ''}-${Date.now()}`;

    // Upload to Cloudinary via stream
    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'image',
          folder: 'vidya-setu/gate-papers',
          public_id: publicId,
          format: 'pdf'
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      
      const { Readable } = require('stream');
      Readable.from(req.file.buffer).pipe(uploadStream);
    });

    const newPaper = new GatePaper({
      paperCode: upperPaperCode,
      year: numYear,
      set,
      title,
      originalFileName: req.file.originalname,
      pdfUrl: uploadResult.secure_url,
      cloudinaryPublicId: uploadResult.public_id,
      resourceType: uploadResult.resource_type,
      pageCount: uploadResult.pages || 0,
      fileSize: uploadResult.bytes,
      uploadedBy: req.user.userId,
      processingStatus: 'uploaded',
      extractionStatus: 'not_started'
    });

    await newPaper.save();

    res.status(201).json({ success: true, gatePaper: newPaper });
  } catch (error) {
    console.error('Upload Error:', error);
    res.status(500).json({ error: 'Internal server error during upload.' });
  }
});

router.get('/', async (req, res) => {
  try {
    const { paperCode, year, processingStatus } = req.query;
    const filter = {};
    if (paperCode) filter.paperCode = paperCode.trim().toUpperCase();
    if (year) filter.year = Number(year);
    if (processingStatus) filter.processingStatus = processingStatus;

    const papers = await GatePaper.find(filter).sort({ year: -1 });
    res.json(papers);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching GATE papers.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const paper = await GatePaper.findById(req.params.id);
    if (!paper) return res.status(404).json({ error: 'GATE paper not found.' });
    res.json(paper);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching GATE paper.' });
  }
});

module.exports = router;
