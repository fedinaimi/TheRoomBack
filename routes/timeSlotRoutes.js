const express = require('express');
const router = express.Router();
const timeSlotController = require('../controllers/timeSlotController');
const auth = require('../middlewares/auth'); // Import the auth middleware

// Create time slots for a scenario (admin)
router.post('/', auth, timeSlotController.createTimeSlots);

// Get all time slots for a scenario by date (no authentication needed)
router.get('/scenario/:scenarioId/date', timeSlotController.getTimeSlotsByDate);

// Update a time slot (admin)
router.put('/:id', auth, timeSlotController.updateTimeSlot);

// Delete a time slot (admin)
router.delete('/:id', auth, timeSlotController.deleteTimeSlot);

module.exports = router;