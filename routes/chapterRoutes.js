const express = require('express');
const router = express.Router();
const chapterController = require('../controllers/chapterController');
const auth = require('../middlewares/auth'); // Authentication middleware
const multerConfig = require('../middlewares/multer-config'); // Multer configuration

// Create Chapter
router.post(
  '/',
  multerConfig.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]),
  chapterController.createChapter
);

// Update Chapter
router.put(
  '/:id',
  auth,
  multerConfig.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]),
  chapterController.updateChapter
);

// Get All Chapters
router.get('/', chapterController.getAllChapters);

// Get Chapter by ID
router.get('/:id', chapterController.getChapterById);
router.delete('/:id', chapterController.deleteChapter);

module.exports = router;
