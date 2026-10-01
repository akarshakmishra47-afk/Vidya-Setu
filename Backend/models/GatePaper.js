const mongoose = require('mongoose');

const gatePaperSchema = new mongoose.Schema({
  paperCode: {
    type: String,
    required: true,
    uppercase: true,
    trim: true
  },
  year: {
    type: Number,
    required: true

  },
  set: {
    type: String,
    default: ''
  },
  title: {
    type: String
  },
  originalFileName: {
    type: String
  },
  pdfUrl: {
    type: String
  },
  cloudinaryPublicId: {
    type: String,
    required: true,
    unique: true
  },
  resourceType: {
    type: String,
    default: 'image'
  },
  pageCount: {
    type: Number
  },
  fileSize: {
    type: Number
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  processingStatus: {
    type: String,
    enum: ['uploaded', 'processing', 'review_required', 'completed', 'failed'],
    default: 'uploaded'
  },
  extractionStatus: {
    type: String,
    enum: ['not_started', 'text_extracted', 'ocr_required', 'parsed', 'verified'],
    default: 'not_started'
  },
  totalQuestions: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

gatePaperSchema.index({ paperCode: 1, year: 1, set: 1 }, { unique: true });

module.exports = mongoose.model('GatePaper', gatePaperSchema);
