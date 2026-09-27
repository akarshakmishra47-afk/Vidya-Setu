require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const mongoose = require('mongoose');
const https = require('https');
const GatePaper = require('../models/GatePaper');

function checkDelivery(url) {
  return new Promise((resolve) => {
    const req = https.request(url, { method: 'HEAD' }, (res) => {
      resolve({
        statusCode: res.statusCode,
        contentType: res.headers['content-type']
      });
    });
    req.on('error', (err) => {
      resolve({ error: err.message });
    });
    req.end();
  });
}

async function runCheck() {
  console.log('Checking GATE PDF delivery status...');

  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI not set.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);

  try {
    const papers = await GatePaper.find({ pdfUrl: { $exists: true, $ne: null } });
    console.log(`Found ${papers.length} stored GATE papers to check.\n`);

    let failedCount = 0;

    for (const paper of papers) {
      const result = await checkDelivery(paper.pdfUrl);

      if (result.error) {
        console.error(`[ERROR] ${paper.title}: Network error - ${result.error}`);
        failedCount++;
      } else if (result.statusCode === 401 || result.statusCode === 403 || result.statusCode === 404) {
        console.error(`[BLOCKED] ${paper.title} (${result.statusCode}): ${paper.pdfUrl}`);
        failedCount++;
      } else if (result.contentType !== 'application/pdf') {
        console.warn(`[WARNING] ${paper.title} served as '${result.contentType}' instead of application/pdf`);
        // We still count this as a failure/warning
        failedCount++;
      } else {
        // Success
        console.log(`[OK] ${paper.title}`);
      }
    }

    if (failedCount > 0) {
      console.log(`\n❌ ${failedCount} papers had delivery issues.`);
      console.log(`REMINDER: If Cloudinary blocks PDFs with 401/403, you must enable "Allow delivery of PDF and ZIP files" in Cloudinary Console Settings > Security.`);
    } else {
      console.log(`\n✅ All ${papers.length} PDFs are publicly accessible as application/pdf.`);
    }

  } catch (error) {
    console.error('Fatal Error:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

runCheck();
