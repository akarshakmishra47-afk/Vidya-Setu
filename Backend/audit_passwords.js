require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/vidyasetu', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    const users = await User.find({});
    let noPassword = 0;
    let bcryptHash = 0;
    let plainText = 0;
    let otherFormat = 0;
    for (let u of users) {
      if (!u.password) { noPassword++; }
      else if (u.password.startsWith('$2a$') || u.password.startsWith('$2b$') || u.password.startsWith('$2y$')) {
        bcryptHash++;
      } else {
        plainText++;
      }
    }
    console.log("========== PASSWORD AUDIT ==========");
    console.log("Users scanned: " + users.length);
    console.log("Secure bcrypt hashes: " + bcryptHash);
    console.log("Plaintext-looking passwords: " + plainText);
    console.log("Missing password: " + noPassword);
    console.log("Other password formats: " + otherFormat);
    console.log("====================================");
    process.exit(0);
  });
