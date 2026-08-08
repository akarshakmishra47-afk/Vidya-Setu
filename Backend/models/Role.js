const mongoose = require("mongoose");

const RoleSchema = new mongoose.Schema({
  title: { type: String, required: true },
  reqSkills: { type: [String], required: true },
  niceSkills: { type: [String], required: true },
  projects: { type: [String], required: true }
});

module.exports = mongoose.model("Role", RoleSchema);
