require('dotenv').config({ path: './.env' });
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
const Perk = require('./models/Perk');

async function sedb() {
  const mongoURI = process.env.MONGO_URI;
  if(!mongoURI) { console.log('No MONGO_URI'); return; }
  await mongoose.connect(mongoURI);

  // We are just finding Samsung and Autodesk and updating their icons
  await Perk.updateOne(
    { "items.name": "Autodesk Education" },
    { $set: { "items.$.icon": "https://asset.brandfetch.io/id8yO8D1d_/id7pZ0N58F.png" } }
  );

  await Perk.updateOne(
    { "items.name": "Samsung Student Advantage" },
    { $set: { "items.$.icon": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/Samsung_Logo.svg/512px-Samsung_Logo.svg.png" } }
  );

  console.log('MongoDB Perks updated with valid Autodesk/Samsung images!');
  process.exit(0);
}
sedb();
