const cloudinary = require('cloudinary').v2;

cloudinary.config({
  secure: true, // Use HTTPS URLs
});

module.exports = cloudinary;
