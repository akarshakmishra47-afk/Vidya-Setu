const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected");
  
  const Job = require('./models/Job');
  
  // We may need to remove old duplicates first if there are any that share exactly the same deduplicationKey.
  // The previous script cleaned up based on title+company+url, which means deduplicationKeys should now be mostly unique.
  // Let's drop existing indexes and sync again.
  try {
    await Job.collection.dropIndex('deduplicationKey_1');
  } catch (e) {
    console.log("Index didn't exist or couldn't be dropped:", e.message);
  }
  
  console.log("Syncing indexes...");
  await Job.syncIndexes();
  console.log("Indexes synced.");
  
  const indexes = await Job.collection.indexes();
  console.log("Current indexes:", JSON.stringify(indexes, null, 2));
  
  process.exit();
}
run();
