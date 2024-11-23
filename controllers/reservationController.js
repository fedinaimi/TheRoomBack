const Reservation = require('../models/Reservation');
const TimeSlot = require('../models/TimeSlot');
const sendEmail = require('../utils/sendEmail');

// Create a new reservation (no login required)
/*
exports.createReservation = async (req, res) => {
  try {
    const { scenarioId, chapterId, timeSlotId, name, email, phone, language } = req.body;

    const timeSlot = await TimeSlot.findById(timeSlotId);
    if (!timeSlot || !timeSlot.isAvailable) {
      return res.status(400).json({ message: 'Selected time slot is not available' });
    }

    const reservation = new Reservation({
      scenario: scenarioId,
      chapter: chapterId,
      timeSlot: timeSlotId,
      name,
      email,
      phone,
      language,
    });
    await reservation.save();

    // Mark the time slot as unavailable
    timeSlot.isAvailable = false;
    await timeSlot.save();

    res.status(201).json({ message: 'Reservation created successfully', reservation });
  } catch (error) {
    console.error('Error creating reservation:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
*/

// Create a new reservation (no login required)
exports.createReservation = async (req, res) => {
  try {
    // Destructure the incoming request body using the new attribute names
    const { scenario, chapter, timeSlot, name, email, phone, language, status } = req.body;

    // Log the incoming request body for debugging
    console.log("Received request body:", req.body);

    // Check if the timeSlot is provided
    if (!timeSlot) {
      return res.status(400).json({ message: 'Time slot ID is required' });
    }

    // Fetch the time slot from the database using the new name
    const timeSlotData = await TimeSlot.findById(timeSlot);

    // Check if the time slot exists
    if (!timeSlotData) {
      return res.status(400).json({ message: 'Time slot not found' });
    }

    // Check if the time slot is available
    if (!timeSlotData.isAvailable) {
      return res.status(400).json({ message: 'Selected time slot is not available' });
    }

    // Create a new reservation using the new attribute names
    const reservation = new Reservation({
      scenario, // Using the new name for scenario
      chapter, // Using the new name for chapter
      timeSlot: timeSlot, // The timeSlot is already matching
      name,
      email,
      phone,
      language,
      status // Assuming you want to keep the status in the reservation as well
    });

    // Save the reservation to the database
    await reservation.save();

    // Mark the time slot as unavailable
    timeSlotData.isAvailable = false;
    await timeSlotData.save();

    // Send success response
    res.status(201).json({ message: 'Reservation created successfully', reservation });
  } catch (error) {
    console.error('Error creating reservation:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};


// Get all reservations (admin)
exports.getAllReservations = async (req, res) => {
  try {
    const reservations = await Reservation.find()
      .populate('scenario')
      .populate('chapter')
      .populate('timeSlot');
    res.status(200).json(reservations);
  } catch (error) {
    console.error('Error fetching reservations:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Update reservation status (admin)
exports.updateReservationStatus = async (req, res) => {
  try {
    const { status } = req.body; // 'approved' or 'declined'
    const reservation = await Reservation.findById(req.params.id).populate('timeSlot');
    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }

    reservation.status = status;
    await reservation.save();

    const timeSlot = reservation.timeSlot;

    if (status === 'approved') {
      const emailContent = `Dear ${reservation.name}, your reservation has been approved.`;
      await sendEmail(reservation.email, 'Reservation Approved', emailContent);
    } else if (status === 'declined') {
      timeSlot.isAvailable = true;
      await timeSlot.save();
      const emailContent = `Dear ${reservation.name}, your reservation has been declined. Please choose another time slot.`;
      await sendEmail(reservation.email, 'Reservation Declined', emailContent);
    }

    res.status(200).json({ message: 'Reservation status updated successfully', reservation });
  } catch (error) {
    console.error('Error updating reservation status:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
exports.deleteReservation = async (req, res) => {
  try {
    const reservation = await Reservation.findByIdAndDelete(req.params.id);
    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }
    res.status(200).json({ message: 'Reservation deleted successfully' });
  } catch (error) {
    console.error('Error deleting reservation:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
// Get reservation by ID (admin)
exports.getReservationById = async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id)
      .populate('scenario')
      .populate('chapter')
      .populate('timeSlot');
    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }
    res.status(200).json(reservation);
  } catch (error) {
    console.error('Error fetching reservation:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
