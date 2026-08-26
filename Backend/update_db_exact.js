require('dotenv').config({ path: './.env' });
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
const Perk = require('./models/Perk');

async function sedbExact() {
  const mongoURI = process.env.MONGO_URI;
  if(!mongoURI) { console.log('No MONGO_URI'); return; }
  await mongoose.connect(mongoURI);

  // Autodesk update
  await Perk.updateOne(
    { "items.name": "Autodesk Education" },
    { $set: { "items.$.icon": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/Autodesk_Logo_2021.svg/1920px-Autodesk_Logo_2021.svg.png" } }
  );

  // Samsung update
  await Perk.updateOne(
    { "items.name": "Samsung Student Advantage" },
    { $set: { "items.$.icon": "https://upload.wikimedia.org/wikipedia/commons/9/9c/Samsung_logo_wordmark.svg" } }
  );

  console.log('MongoDB Perks updated with exact user-provided images!');
  process.exit(0);
}
sedbExact();
