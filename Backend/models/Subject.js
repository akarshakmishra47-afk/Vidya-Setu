const mongoose = require("mongoose");

const SubjectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  topics: [
    {
      title: { type: String, required: true },
      probability: { type: Number, required: true }, // 0 to 100
      years: { type: [Number], required: true }, // e.g. [2019, 2020]
    }
  ]
});

module.exports = mongoose.model("Subject", SubjectSchema);
