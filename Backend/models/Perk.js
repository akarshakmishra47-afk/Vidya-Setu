const mongoose = require('mongoose');

const perkSchema = new mongoose.Schema({
  cat: { type: String, required: true },
  color: { type: String, required: true },
  items: [{
    _id: false,
    id: { type: Number, required: true },
    name: { type: String, required: true },
    val: { type: String, required: true },
    icon: { type: String, required: true },
    url: { type: String, default: "" },
    steps: [{ type: String }]
  }]
});

module.exports = mongoose.model('Perk', perkSchema);
