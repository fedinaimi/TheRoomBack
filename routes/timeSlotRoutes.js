const express = require('express');
const router = express.Router();
const timeSlotController = require('../controllers/timeSlotController');
const auth = require('../middlewares/auth'); // Ensure middleware for secured routes

// ** Time Slot Routes **

// Create time slots (Admin)
router.post('/', auth, timeSlotController.createTimeSlots);

// Get all time slots for a scenario
router.get('/scenario/:scenarioId', timeSlotController.getAllTimeSlotsByScenario);

// Get time slots by scenario and date
router.get('/scenario/:scenarioId/date', timeSlotController.getTimeSlotsByDate);

// Get time slots with availability (scenario-based and date range)
router.get('/availability', timeSlotController.getTimeSlotsWithAvailability);

// Toggle time slot availability (Admin)
router.put('/:id/toggle-availability', auth, timeSlotController.toggleAvailability);

// Update a time slot (Admin)
router.put('/:id', auth, timeSlotController.updateTimeSlot);

// Delete a time slot (Admin)
router.delete('/:id', auth, timeSlotController.deleteTimeSlot);

// Route to get time slots by chapter and date
router.get('/', timeSlotController.getTimeSlotsByChapterAndDate);

// ** New Routes **

// Clear all time slots for a chapter (Admin)
router.delete('/clear-all/:chapterId', auth, timeSlotController.clearAllTimeSlotsForChapter);

// Clear time slots for a specific day (Admin)
router.delete('/clear-day/:chapterId', auth, timeSlotController.clearTimeSlotsForDay);

// Disable all time slots for a specific day (Admin)
router.put('/disable-day/:chapterId', auth, timeSlotController.disableTimeSlotsForDay);
router.put('/enable-day/:chapterId', auth, timeSlotController.enableTimeSlotsForDay);

module.exports = router;
