const cloudinary = require('cloudinary').v2;

// Configure Cloudinary with environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Upload a Base64 image to Cloudinary using unsigned upload
 * @param {string} base64Data - The Base64 encoded image string
 * @returns {Promise<string>} - The secure URL of the uploaded image
 */
async function uploadImage(base64Data) {
  try {
    // Ensure the base64 string has the data URI prefix
    const dataUri = base64Data.startsWith('data:')
      ? base64Data
      : `data:image/jpeg;base64,${base64Data}`;

    // Use unsigned upload - bypasses signature issues entirely
    const result = await cloudinary.uploader.unsigned_upload(dataUri, 'vidya_setu', {
      resource_type: 'image'
    });

    return result.secure_url;
  } catch (error) {
    console.error('❌ Cloudinary upload error:', error.message);
    throw new Error('Image upload failed: ' + error.message);
  }
}

module.exports = { cloudinary, uploadImage };
