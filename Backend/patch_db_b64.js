
require('dotenv').config({ path: './.env' });
const dns = require('dns'); dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
const Perk = require('./models/Perk');

async function patch() {
  await mongoose.connect(process.env.MONGO_URI);
  await Perk.updateOne(
    { "items.name": "Autodesk Education" },
    { $set: { "items.$.icon": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGZpbGw9Im5vbmUiIHZpZXdCb3g9IjAgMCAyNCAyNCIgaWQ9IkF1dG9kZXNrLUxvZ28tMi0tU3RyZWFtbGluZS1Mb2dvcy1CbG9jayIgaGVpZ2h0PSIyNCIgd2lkdGg9IjI0Ij4KICA8ZGVzYz4KICAgIEF1dG9kZXNrIExvZ28gMiBTdHJlYW1saW5lIEljb246IGh0dHBzOi8vc3RyZWFtbGluZWhxLmNvbQogIDwvZGVzYz4KICA8cGF0aCBmaWxsPSIjMDAwMDAwIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik01IDFhNCA0IDAgMCAwIC00IDR2MTRhNCA0IDAgMCAwIDQgNGgxNGE0IDQgMCAwIDAgNCAtNFY1YTQgNCAwIDAgMCAtNCAtNEg1Wm0tMC41IDE2LjExNCA5LjU0NiAtNS40NTVoMy41NTlhMC4xNyAwLjE3IDAgMCAxIDAuMDk4IDAuMzFsLTQuMDU0IDIuODk1YTAuNjgyIDAuNjgyIDAgMCAwIC0wLjI4NSAwLjU1NXYxLjY5NUgxOS41VjcuNTY4YTAuNjgyIDAuNjgyIDAgMCAwIC0wLjY4MiAtMC42ODJoLTUuMTE0TDQuNSAxMi4zNDF2NC43NzNaIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIHN0cm9rZS13aWR0aD0iMSI+PC9wYXRoPgo8L3N2Zz4=" } }
  );
  console.log('DB Patched with Base64 Autodesk!');
  process.exit(0);
}
patch();
