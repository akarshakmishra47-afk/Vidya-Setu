const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("========== UNSTOP HACKATHON DIAGNOSTIC ==========\n");

  const Job = mongoose.model('Job', new mongoose.Schema({}, {strict: false}));

  const a = await Job.countDocuments({ source: "Unstop", isActive: true });
  const b = await Job.countDocuments({ source: "Unstop", type: "Hackathon", isActive: true });
  const c = await Job.countDocuments({ source: "Unstop", primaryType: "Hackathon", isActive: true });
  const d = await Job.countDocuments({ source: "Unstop", category: "Hackathon", isActive: true });
  const e = await Job.countDocuments({ source: "Unstop", isActive: true, isIndiaLocation: true });

  console.log(`MongoDB Unstop active: ${a}`);
  console.log(`Unstop type=Hackathon: ${b}`);
  console.log(`Unstop primaryType=Hackathon: ${c}`);
  console.log(`Unstop category=Hackathon: ${d}`);
  console.log(`Unstop India-eligible: ${e}`);

  console.log("\n--- 5 REAL UNSTOP HACKATHON RECORDS ---");
  const unstopRecords = await Job.find({ source: "Unstop", isActive: true }).limit(5);
  for (const r of unstopRecords) {
    console.log(`_id: ${r._id}`);
    console.log(`title: ${r.title}`);
    console.log(`source: ${r.source}`);
    console.log(`type: ${r.type}`);
    console.log(`primaryType: ${r.primaryType}`);
    console.log(`category: ${r.category}`);
    console.log(`isActive: ${r.isActive}`);
    console.log(`isIndiaLocation: ${r.isIndiaLocation}`);
    console.log(`sourceUrl: ${r.sourceUrl}`);
    console.log(`deadline: ${r.deadline}`);
    console.log("---------------------------------------");
  }

  console.log("\n--- WORKING HACKERARTH RECORD FIELDS ---");
  const hackerRecord = await Job.findOne({ source: /hackerearth/i, isActive: true });
  if (hackerRecord) {
    console.log(JSON.stringify({
      _id: hackerRecord._id,
      title: hackerRecord.title,
      source: hackerRecord.source,
      type: hackerRecord.type,
      primaryType: hackerRecord.primaryType,
      category: hackerRecord.category,
      isActive: hackerRecord.isActive,
      isIndiaLocation: hackerRecord.isIndiaLocation
    }, null, 2));
  } else {
    // Try without case insensitive if not found, or just search by title hackathon etc.
    const altHacker = await Job.findOne({ source: "hackerearth", isActive: true }) || 
                      await Job.findOne({ primaryType: "Hackathon", source: { $ne: "Unstop" } });
    if (altHacker) {
      console.log("Found alternative working hackathon:", JSON.stringify({
        _id: altHacker._id,
        title: altHacker.title,
        source: altHacker.source,
        type: altHacker.type,
        primaryType: altHacker.primaryType,
        category: altHacker.category,
        isActive: altHacker.isActive,
        isIndiaLocation: altHacker.isIndiaLocation
      }, null, 2));
    } else {
      console.log("No working hackerearth record found.");
    }
  }

  process.exit(0);
}

run().catch(console.error);
