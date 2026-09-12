const express = require('express');
const router = express.Router();
const multer = require('multer');
const pdfParse = require('pdf-parse');
const mongoose = require('mongoose');
const PYQ = require('../models/PYQ');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

/**
 * Configure Multer to use memory storage with a limit of 150 files.
 * This keeps the uploaded PDFs in RAM as buffers, allowing for fast, direct processing.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 150, // Max 150 files per request
    fileSize: 10 * 1024 * 1024 // 10MB per file limit to prevent memory exhaustion
  }
});

/**
 * Helper function to process an array of promises in chunks.
 * This ensures we don't overwhelm Node.js memory or the Event Loop when parsing 100+ PDFs.
 *
 * @param {Array} items - The array of items to process (e.g., PDF file buffers).
 * @param {Number} chunkSize - The maximum number of items to process concurrently (Promise pooling).
 * @param {Function} processFn - The async function to execute on each item.
 * @returns {Promise<Array>} Array of results containing success/failure data.
 */
async function processInChunks(items, chunkSize, processFn) {
  const results = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    // Execute the chunk concurrently and wait for it to finish before starting the next chunk
    const chunkResults = await Promise.all(
      chunk.map(async (item) => {
        try {
          return await processFn(item);
        } catch (error) {
          return { success: false, fileName: item.originalname || 'Unknown', error: error.message };
        }
      })
    );
    results.push(...chunkResults);
  }
  return results;
}

/**
 * Robust placeholder function to extract questions from raw PDF text.
 * In a real-world scenario, this regex would need to be finely tuned to the specific PDF format.
 *
 * @param {String} text - The raw text extracted from the PDF via pdf-parse.
 * @param {String} fileName - The original filename (used for tracking source).
 * @returns {Array} Array of extracted question objects ready for mapping to the DB schema.
 */
function extractQuestionsFromText(text, fileName) {
  const questions = [];
  
  // Regex to find the start of a question block, e.g., "Q.1", "Q. 2", "Q 3.", "Q4"
  const questionBlockRegex = /Q\.?\s*(\d+)[.)]?\s+/g;
  
  // Capture all indices where a new question starts
  let match;
  const indices = [];
  while ((match = questionBlockRegex.exec(text)) !== null) {
    indices.push({ index: match.index, number: parseInt(match[1], 10), matchedLength: match[0].length });
  }
  
  // Iterate through each detected question block
  for (let i = 0; i < indices.length; i++) {
    const current = indices[i];
    // The block ends where the next question begins, or at the end of the text
    const nextIndex = i + 1 < indices.length ? indices[i + 1].index : text.length;
    
    // Extract the raw text for this specific question
    const rawBlock = text.substring(current.index + current.matchedLength, nextIndex).trim();
    
    // Regex to extract multiple-choice options (A), (B), (C), (D)
    const optionsRegex = /(?:\(A\)|A\))\s*(.*?)\s*(?:\(B\)|B\))\s*(.*?)\s*(?:\(C\)|C\))\s*(.*?)\s*(?:\(D\)|D\))\s*(.*)/is;
    const optionsMatch = rawBlock.match(optionsRegex);
    
    let questionText = rawBlock;
    let options = null;
    
    if (optionsMatch) {
      // The question text is everything before the first option "(A)"
      questionText = rawBlock.substring(0, optionsMatch.index).trim();
      options = {
        A: optionsMatch[1].trim(),
        B: optionsMatch[2].trim(),
        C: optionsMatch[3].trim(),
        D: optionsMatch[4].trim()
      };
    }
    
    // If the question text is meaningful, save it
    if (questionText.length > 5) {
      // Append options to the question text if they were successfully parsed
      const fullQuestionText = options 
        ? `${questionText}\n\n(A) ${options.A}\n(B) ${options.B}\n(C) ${options.C}\n(D) ${options.D}`
        : questionText;

      questions.push({
        exam: 'GATE CSE',
        subject: 'General / TBD', // Would ideally be parsed from the header or filename
        topic: 'Uncategorized',
        year: new Date().getFullYear(), // Placeholder
        questionNumber: current.number,
        question: fullQuestionText,
        isVerified: true,
        isSampleData: false,
        sourceType: 'PDF',
        sourceFile: fileName,
        source: 'GATE Official Paper'
      });
    }
  }
  
  return questions;
}

/**
 * @route POST /api/admin-pyq/bulk-upload
 * @desc Uploads and parses up to 150 GATE PYQ PDFs, extracting questions and saving them atomically.
 * @access Private/Admin
 */
router.post('/bulk-upload', authenticateToken, requireAdmin, upload.array('pdfs', 150), async (req, res) => {
  try {
    const files = req.files;
    
    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, message: 'No PDF files provided.' });
    }

    let totalProcessedFiles = 0;
    let totalFailedFiles = 0;
    let totalExtractedQuestions = 0;
    let errors = [];
    
    // Process the uploaded PDFs in chunks of 5 to prevent memory crashes
    const processingResults = await processInChunks(files, 5, async (file) => {
      // 1. Parse the PDF Buffer
      const parsedData = await pdfParse(file.buffer);
      const rawText = parsedData.text;
      
      // 2. Extract Questions using Regex
      const extractedQuestions = extractQuestionsFromText(rawText, file.originalname);
      
      if (extractedQuestions.length === 0) {
        throw new Error('No questions could be extracted from this PDF format.');
      }

      // 3. Prepare Atomic Upserts (bulkWrite)
      // We use updateOne with upsert: true to prevent E11000 Duplicate Key errors
      const bulkOps = extractedQuestions.map(q => ({
        updateOne: {
          // Identify uniqueness by exact question text and source file (or modify as needed)
          filter: { question: q.question, sourceFile: q.sourceFile },
          update: { $set: q },
          upsert: true
        }
      }));

      // 4. Execute Bulk Write
      const bulkResult = await PYQ.bulkWrite(bulkOps, { ordered: false });
      
      return { 
        success: true, 
        fileName: file.originalname, 
        questionsUpserted: bulkResult.upsertedCount + bulkResult.modifiedCount,
        totalFound: extractedQuestions.length
      };
    });

    // Tally the results
    processingResults.forEach(result => {
      if (result.success) {
        totalProcessedFiles++;
        totalExtractedQuestions += result.totalFound;
      } else {
        totalFailedFiles++;
        errors.push({ fileName: result.fileName, error: result.error });
      }
    });

    // 5. Return Professional JSON Summary Payload
    res.status(200).json({
      success: true,
      summary: {
        processedFiles: totalProcessedFiles,
        failedFiles: totalFailedFiles,
        totalExtractedQuestions: totalExtractedQuestions,
      },
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Bulk Upload Error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'A critical server error occurred during bulk processing.' 
    });
  }
});

module.exports = router;
