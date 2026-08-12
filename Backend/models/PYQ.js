const mongoose = require("mongoose");

const pyqSchema = new mongoose.Schema({
  exam: { type: String, required: true, enum: ['AKTU B.Tech', 'GATE CSE'] },
  branch: { type: String, required: false }, // Useful for AKTU
  semester: { type: Number, required: false }, // Useful for AKTU
  subject: { type: String, required: true },
  year: { type: Number, required: true },
  unit: { type: Number, required: false }, // Syllabus unit (1-5 typically)
  topic: { type: String, required: true }, // The specific topic this question relates to
  question: { type: String, required: true },
  marks: { type: Number, required: false }, // Marks awarded for this question
  questionType: { type: String, required: false, enum: ['Conceptual', 'Numerical', 'Programming', 'Theoretical', 'Other'] },
  difficulty: { type: String, required: false, enum: ['Easy', 'Medium', 'Hard'] },
  
  // Strict Verification Fields
  isVerified: { type: Boolean, default: false }, // TRUE ONLY if backed by actual official papers
  isSampleData: { type: Boolean, default: true }, // TRUE if generated/seeded/unverified
  source: { type: String, required: false }, // e.g., "Official GATE 2023 Paper", "AKTU 2021 End Sem"
  sourceYear: { type: Number, required: false }
}, { timestamps: true });

module.exports = mongoose.model("PYQ", pyqSchema);
