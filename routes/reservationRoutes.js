const express = require('express');
const router = express.Router();
const reservationController = require('../controllers/reservationController');
const auth = require('../middlewares/auth'); // Import the auth middleware

// Create a reservation (no login required)
router.post('/', reservationController.createReservation);

// Get all reservations (admin)
router.get('/', auth, reservationController.getAllReservations);

// Get reservation by ID (admin)
router.get('/:id', auth, reservationController.getReservationById);

// Update reservation status (admin)
router.put('/:source/:reservationId/status', auth, reservationController.updateReservationStatus);

// Delete a reservation (admin)
router.delete("/:source/:reservationId", auth, reservationController.deleteReservation);

module.exports = router;
