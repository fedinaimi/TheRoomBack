const express = require('express');
const router = express.Router();
const chapterController = require('../controllers/chapterController');
const auth = require('../middlewares/auth'); // Import the auth middleware

// Create a chapter (admin)
router.post('/', auth, chapterController.createChapter);

// Get all chapters (no authentication needed)
router.get('/', chapterController.getAllChapters);

// Get chapter by ID (no authentication needed)
router.get('/:id', chapterController.getChapterById);

// Update a chapter (admin)
router.put('/:id', auth, chapterController.updateChapter);

// Delete a chapter (admin)
router.delete('/:id', auth, chapterController.deleteChapter);

module.exports = router;
