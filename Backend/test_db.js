const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected");
  const jobs = await mongoose.model('Job', new mongoose.Schema({}, {strict: false})).find({ title: /KEA Recruitment/i });
  console.log(JSON.stringify(jobs, null, 2));
  process.exit();
}
run();
