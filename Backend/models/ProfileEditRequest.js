const mongoose = require('mongoose');

const profileEditRequestSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  requestedChanges: { type: Object, required: true },
  reason: { type: String, default: '' },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
  requestedAt: { type: Date, default: Date.now },
  reviewedAt: { type: Date },
  reviewedBy: { type: String },
  rejectionReason: { type: String }
});

module.exports = mongoose.model('ProfileEditRequest', profileEditRequestSchema);
