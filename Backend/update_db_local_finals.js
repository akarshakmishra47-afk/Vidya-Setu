require('dotenv').config({ path: './.env' });
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
const Perk = require('./models/Perk');

async function sedbFinalLocals() {
  const mongoURI = process.env.MONGO_URI;
  if(!mongoURI) { console.log('No MONGO_URI'); return; }
  await mongoose.connect(mongoURI);

  // Autodesk update
  await Perk.updateOne(
    { "items.name": "Autodesk Education" },
    { $set: { "items.$.icon": "./autodeskv2.png" } }
  );

  console.log('MongoDB Perks updated to use local Autodesk image!');
  process.exit(0);
}
sedbFinalLocals();
