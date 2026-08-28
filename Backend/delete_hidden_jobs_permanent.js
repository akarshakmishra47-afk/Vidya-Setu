const mongoose = require('mongoose');
const Job = require('./models/Job');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  // We want to DELETE anything that:
  // 1. isIndiaLocation === false
  // 2. isActive === false
  // 3. source is in the disabled list
  
  const query = {
    $or: [
      { isIndiaLocation: false },
      { isActive: false },
      { source: { $in: ['greenhouse', 'lever', 'govtRss', 'manual', 'web', 'arbeitnow', 'himalayas'] } }
    ]
  };

  const result = await Job.deleteMany(query);
  console.log(`Successfully permanently deleted ${result.deletedCount} hidden/inactive records from the database.`);
  
  process.exit(0);
}).catch(console.error);
