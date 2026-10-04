const mongoose = require('mongoose');

const groupMessageSchema = new mongoose.Schema({
  authorName: { type: String, required: true },
  authorRoll: { type: String, required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const studyGroupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  desc: { type: String, default: '' },
  branch: { type: String, required: true },
  year: { type: String, required: true },
  createdBy: { type: String, required: true }, // author name
  authorRoll: { type: String, required: true }, // creator's rollNo
  members: { type: [String], default: [] }, // Array of rollNos
  messages: [groupMessageSchema],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('StudyGroup', studyGroupSchema);
