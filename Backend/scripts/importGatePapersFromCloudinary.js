require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const mongoose = require('mongoose');
const { cloudinary } = require('../cloudinaryConfig');
const GatePaper = require('../models/GatePaper');

function parseGateFilename(filename) {
  let baseName = filename.split('/').pop().replace(/\.[^/.]+$/, "").toUpperCase();
  
  const yr = baseName.match(/(199\d|20[0-2]\d)/);
  if (!yr) return null;
  const year = parseInt(yr[1], 10);
  
  let remainder = baseName.replace(yr[0], ' ').replace(/GATE/g, ' ');
  
  let set = '';
  const knownCodes = ['CS','ME','CE','EE','EC','IN','CH','BT','BM','AE','AG','AR','CY','GG','MA','MN','MT','PE','PH','PI','ST','TF','XE','XH','XL', 'DA'];
  
  let paperCode = null;
  for (const code of knownCodes) {
    const regex = new RegExp(`(?:^|[^A-Z])${code}(?:[^A-Z]|$)`);
    if (regex.test(remainder)) {
      paperCode = code;
      remainder = remainder.replace(new RegExp(`(?:^|[^A-Z])(${code})(?:[^A-Z]|$)`), ' ');
      break;
    }
    const regexNum = new RegExp(`(?:^|[^A-Z])${code}(\\d)`);
    const match = remainder.match(regexNum);
    if (match) {
      paperCode = code;
      set = `Set-${match[1]}`;
      remainder = remainder.replace(regexNum, ' ');
      break;
    }
  }
  
  if (!paperCode) return null;
  
  if (!set) {
    const setMatch = remainder.match(/(?:SET|S)[\\s_-]*([1-9])/);
    if (setMatch) {
      set = `Set-${setMatch[1]}`;
    } else {
      const solitary = remainder.match(/\\b([1-9])\\b/);
      if (solitary) set = `Set-${solitary[1]}`;
    }
  }
  
  return { year, paperCode, set };
}

async function runImport() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const folderArgIndex = args.indexOf('--folder');
  const folder = folderArgIndex !== -1 ? args[folderArgIndex + 1] : null;

  console.log(`Starting Cloudinary import... Dry run: ${isDryRun}`);
  
  if (!isDryRun) {
    if (!process.env.MONGO_URI) {
      console.error("MONGO_URI not set.");
      process.exit(1);
    }
    await mongoose.connect(process.env.MONGO_URI);
  }

  let next_cursor = null;
  let created = 0;
  let skipped = 0;
  let needsReview = 0;
  let failed = 0;

  try {
    do {
      const options = {
        resource_type: 'image',
        max_results: 100,
        type: 'upload'
      };
      if (folder) {
        options.prefix = folder + '/';
      }
      if (next_cursor) {
        options.next_cursor = next_cursor;
      }

      const result = await cloudinary.api.resources(options);
      
      const pdfs = result.resources.filter(r => r.format === 'pdf');

      for (const asset of pdfs) {
        const parsed = parseGateFilename(asset.public_id);
        
        if (!parsed) {
          console.log(`[NEEDS REVIEW] Could not parse: ${asset.public_id}`);
          needsReview++;
          continue;
        }

        const docData = {
          paperCode: parsed.paperCode,
          year: parsed.year,
          set: parsed.set,
          title: `GATE ${parsed.year} ${parsed.paperCode} ${parsed.set}`.trim(),
          originalFileName: asset.public_id.split('/').pop() + '.pdf',
          pdfUrl: asset.secure_url,
          cloudinaryPublicId: asset.public_id,
          resourceType: asset.resource_type,
          pageCount: asset.pages || 0,
          fileSize: asset.bytes
        };

        if (isDryRun) {
          console.log(`[DRY RUN] Would upsert: ${docData.title} (${asset.public_id})`);
          created++;
        } else {
          try {
            const updateResult = await GatePaper.updateOne(
              { cloudinaryPublicId: asset.public_id },
              { $setOnInsert: docData },
              { upsert: true }
            );

            if (updateResult.upsertedCount > 0) {
              console.log(`[CREATED] ${docData.title}`);
              created++;
            } else {
              console.log(`[SKIPPED] ${docData.title} already exists.`);
              skipped++;
            }
          } catch (err) {
            if (err.code === 11000) {
              console.error(`[FAILED] Duplicate paperCode+year+set for ${asset.public_id}`);
            } else {
              console.error(`[FAILED] Error saving ${asset.public_id}:`, err.message);
            }
            failed++;
          }
        }
      }

      next_cursor = result.next_cursor;
    } while (next_cursor);

    console.log(`\n--- SUMMARY ---`);
    console.log(`Created: ${created}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Needs Review: ${needsReview}`);
    console.log(`Failed: ${failed}`);

  } catch (error) {
    console.error('Fatal Error:', error);
  } finally {
    if (!isDryRun) {
      await mongoose.disconnect();
    }
    process.exit(0);
  }
}

runImport();
