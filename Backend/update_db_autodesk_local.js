require('dotenv').config({ path: './.env' });
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
const Perk = require('./models/Perk');

async function sedbAutodeskLocal() {
  const mongoURI = process.env.MONGO_URI;
  if(!mongoURI) { console.log('No MONGO_URI'); return; }
  await mongoose.connect(mongoURI);

  // Autodesk update
  await Perk.updateOne(
    { "items.name": "Autodesk Education" },
    { $set: { "items.$.icon": "./Autodesk.svg" } }
  );

  console.log('MongoDB Autodesk updated with local SVG path!');
  process.exit(0);
}
sedbAutodeskLocal();
