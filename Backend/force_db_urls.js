
require('dotenv').config({ path: './.env' });
const dns = require('dns'); dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
const Perk = require('./models/Perk');

async function patch() {
  await mongoose.connect(process.env.MONGO_URI);
  await Perk.updateOne(
    { "items.name": "Autodesk Education" },
    { $set: { "items.$.icon": "https://logos-world.net/wp-content/uploads/2023/09/Autodesk-Logo.png" } }
  );
  await Perk.updateOne(
    { "items.name": "Samsung Student Advantage" },
    { $set: { "items.$.icon": "https://upload.wikimedia.org/wikipedia/commons/9/9c/Samsung_logo_wordmark.svg" } }
  );
  console.log('DB exact URLs enforced directly');
  process.exit(0);
}
patch();
