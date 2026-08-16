require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/vidyasetu', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    const users = await User.find({});
    let migrated = 0;
    
    for (let u of users) {
      if (u.password && !u.password.startsWith('$2a$') && !u.password.startsWith('$2b$') && !u.password.startsWith('$2y$')) {
        u.password = await bcrypt.hash(u.password, 10);
        await u.save();
        migrated++;
      }
    }
    
    console.log("========== MIGRATION COMPLETE ==========");
    console.log("Passwords migrated to bcrypt: " + migrated);
    console.log("========================================");
    process.exit(0);
  });
