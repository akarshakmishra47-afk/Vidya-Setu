const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const Job = require('./models/Job');
  
  const jobs = await Job.find({ primaryType: 'Hackathon' });
  console.log("Hackathons count:", jobs.length);
  
  const all = await Job.aggregate([{ $group: { _id: '$primaryType', count: { $sum: 1 } } }]);
  console.log(all);
  
  mongoose.disconnect();
}
run();
