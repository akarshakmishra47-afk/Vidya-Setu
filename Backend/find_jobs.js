require('dotenv').config();
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
.then(async () => {
  const Job = require('./models/Job');
  const ce = await Job.findOne({ title: 'Cloud Engineer (WFH)' });
  if (ce) console.log('Found CE under source:', ce.source);
  else console.log('CE not found anywhere.');
  
  const ade = await Job.findOne({ title: 'AWS DevOps Engineer' });
  if (ade) console.log('Found ADE under source:', ade.source);
  else console.log('ADE not found anywhere.');

  process.exit(0);
});
