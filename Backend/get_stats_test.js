const mongoose = require('mongoose');
require('dotenv').config();
mongoose.connect(process.env.MONGO_URI).then(async () => {
  const User = require('./models/User');
  const totalStudents = await User.countDocuments({});
  const verifiedStudents = await User.countDocuments({ scholarshipStage: { $gt: 1 } });
  let totalClaimed = 0;
  const users = await User.find({});
  users.forEach(u => { if (u.claimedPerks) totalClaimed += u.claimedPerks.length; });
  console.log('totalStudents:', totalStudents, 'verifiedStudents:', verifiedStudents, 'totalClaimed:', totalClaimed);
  mongoose.disconnect();
});
