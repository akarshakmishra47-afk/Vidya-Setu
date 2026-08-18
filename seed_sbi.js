const mongoose = require('mongoose');
const Scholarship = require('./Backend/models/Scholarship');
require('dotenv').config({ path: './Backend/.env' });

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    try {
      const doc = {
        title: "SBI Platinum Jubilee Asha Scholarship 2026",
        provider: "SBI Foundation",
        category: "Private/NGO",
        amount: "₹15,000 - ₹15,00,000",
        deadline: "31 Oct 2026",
        description: "The SBI Platinum Jubilee Asha Scholarship is one of India's largest scholarship initiatives, supporting meritorious students from economically weaker backgrounds — from Class 9 all the way to study abroad. It ensures that financial challenges never hinder access to quality education.",
        officialUrl: "https://www.sbiashascholarship.co.in",
        howToApply: [
          "Visit the official SBI Asha Scholarship portal (sbiashascholarship.co.in).",
          "Register using your email or mobile number.",
          "Fill out the online application form with personal and academic details.",
          "Upload required documents (Income Certificate, Aadhaar, previous marksheets).",
          "Submit the application and save the reference number."
        ],
        tags: ["SBI", "Asha", "Platinum Jubilee", "Class 9-12", "UG/PG", "Study Abroad"],
        source: "manual",
        deduplicationKey: "manual::sbiplatinumjubileeashascholarship2026",
        status: "active",
        isActive: true,
        eligibility: {
          maxIncome: 300000, // typically 3 LPA for Asha, but varies
          allowedCategories: ['General', 'OBC', 'SC', 'ST', 'EWS'],
          isDefenceRequired: false,
          isCapfRequired: false
        },
        documentsRequired: ['Income Certificate', 'Aadhaar', 'Previous Year Marksheet', 'Bank Passbook']
      };

      await Scholarship.updateOne({ deduplicationKey: doc.deduplicationKey }, { $set: doc }, { upsert: true });
      console.log("SBI Asha Scholarship successfully inserted or updated!");
    } catch (e) {
      console.error("Error inserting scholarship:", e);
    } finally {
      mongoose.disconnect();
    }
  })
  .catch(err => {
    console.error("DB connection error:", err);
  });
