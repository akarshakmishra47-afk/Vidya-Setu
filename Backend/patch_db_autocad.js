
require('dotenv').config({ path: '../Backend/.env' });
const dns = require('dns'); dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
const Perk = require('../Backend/models/Perk');

async function patch() {
  await mongoose.connect(process.env.MONGO_URI);
  await Perk.updateOne(
    { "items.name": "Autodesk Education" },
    { $set: { "items.$.icon": "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPEVycm9yPjxDb2RlPkFjY2Vzc0RlbmllZDwvQ29kZT48TWVzc2FnZT5BY2Nlc3MgRGVuaWVkPC9NZXNzYWdlPjwvRXJyb3I+" } }
  );
  console.log('DB patched successfully with Autocad Base64!');
  process.exit(0);
}
patch();
    