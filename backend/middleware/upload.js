const multer = require('multer');

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB per image
const MAX_FILES = 3;

const instance = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILES,
  },
  fileFilter(req, file, cb) {
    if (typeof file.mimetype === 'string' && file.mimetype.startsWith('image/')) {
      return cb(null, true);
    }
    return cb(new Error('Only image files are allowed.'));
  },
});

function handleImagesUpload(req, res, next) {
  instance.array('images', MAX_FILES)(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'Each image must be 5 MB or smaller.' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(413).json({ error: 'Maximum 3 images per report.' });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ error: 'Unexpected file field. Use "images".' });
    }
    return res.status(400).json({ error: err.message || 'Image upload failed.' });
  });
}

module.exports = { handleImagesUpload, MAX_FILES, MAX_FILE_SIZE };