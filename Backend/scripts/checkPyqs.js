require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const PYQ = require('../models/PYQ');

async function verify() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is not defined in .env");
    }
    
    // Connect to the database
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Database Connected');
    
    // Count the exact number of questions currently saved
    const count = await PYQ.countDocuments();
    console.log(`\n📊 Total questions saved in database: ${count}`);
    
    if (count > 0) {
      // Find the first question to verify formatting
      const firstQ = await PYQ.findOne();
      console.log('\n📝 First Question Extracted:');
      console.log('--------------------------------------------------');
      console.log(`Exam: ${firstQ.exam}`);
      console.log(`Number: Q.${firstQ.questionNumber}`);
      console.log(`Source File: ${firstQ.sourceFile || 'Unknown'}`);
      console.log(`\nText:\n${firstQ.question}`);
      console.log('--------------------------------------------------');
    } else {
      console.log('\n⚠️ No questions found in the database. Please run the bulk upload first.');
    }
    
  } catch (err) {
    console.error('❌ Verification Error:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Database Disconnected');
  }
}

verify();
