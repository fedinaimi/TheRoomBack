const multer = require('multer');

// Allowed MIME types
const MIME_TYPES = {
  'image/jpg': 'jpg',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/ogg': 'ogg',
};

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, 'uploads'); // Set your upload directory
  },
  filename: (req, file, callback) => {
    const name = file.originalname.split(' ').join('_');
    const extension = MIME_TYPES[file.mimetype] || '';
    callback(null, `${Date.now()}_${name}.${extension}`);
  },
});

// Set limits and file type filtering
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB file size limit
  fileFilter: (req, file, callback) => {
    const isValid = MIME_TYPES[file.mimetype];
    if (isValid) {
      callback(null, true);
    } else {
      callback(new Error('Invalid file type'), false);
    }
  },
});

module.exports = upload;
