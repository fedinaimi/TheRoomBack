const TimeSlot = require('../models/TimeSlot');
const Reservation = require('../models/Reservation');
const mongoose = require('mongoose');

// Create time slots for a scenario on a specific date (admin)
// Create time slots for a scenario on a specific date (admin)
/*
exports.createTimeSlots = async (req, res) => {
  try {
    console.log(req.body);  // Log the request body for debugging

    const { scenarioId, dateRange, weekdayTime, weekendTime } = req.body;

    if (!scenarioId || !dateRange.from || !dateRange.to || !weekdayTime.startTime || !weekdayTime.endTime) {
      return res.status(400).json({ message: 'Invalid data: scenarioId, dateRange, and weekdayTime are required.' });
    }

    const startDate = new Date(dateRange.from);
    const endDate = new Date(dateRange.to);

    const timeSlotsData = [];

    for (let d = startDate; d <= endDate; d.setDate(d.getDate() + 1)) {
      const currentDate = d.toISOString().split('T')[0];
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;

      timeSlotsData.push({
        scenario: scenarioId,
        date: currentDate,
        startTime: isWeekend ? weekendTime.startTime : weekdayTime.startTime,
        endTime: isWeekend ? weekendTime.endTime : weekdayTime.endTime,
        isAvailable: true,
      });
    }

    const timeSlots = await TimeSlot.insertMany(timeSlotsData);
    res.status(201).json({ message: 'Time slots created successfully', timeSlots });
  } catch (error) {
    console.error('Error creating time slots:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
*/

exports.createTimeSlots = async (req, res) => {
  try {
    console.log('Request Body:', req.body);  // Log the request body for debugging

    const { scenarioId, dateRange, weekdayTime, weekendTime } = req.body;

    // Ensure the scenarioId and other data are correct
    if (!scenarioId || !dateRange || !dateRange.from || !dateRange.to || !weekdayTime.startTime || !weekdayTime.endTime) {
      return res.status(400).json({ message: 'Invalid data: scenarioId, dateRange, and weekdayTime are required.' });
    }

    const startDate = new Date(dateRange.from);
    const endDate = new Date(dateRange.to);

    // To store individual insert results and errors if any
    const results = [];
    const errors = [];

    // Loop through the date range and insert each time slot as a separate request
    for (let d = startDate; d <= endDate; d.setDate(d.getDate() + 1)) {
      const currentDate = d.toISOString().split('T')[0]; // Format as YYYY-MM-DD
      const isWeekend = d.getDay() === 0 || d.getDay() === 6; // Check if it's weekend

      // Prepare the data for each time slot
      const timeSlotData = {
        scenario: scenarioId,
        date: currentDate,
        startTime: isWeekend ? weekendTime.startTime : weekdayTime.startTime,
        endTime: isWeekend ? weekendTime.endTime : weekdayTime.endTime,
        isAvailable: true,
      };

      // Insert each time slot individually
      try {
        const timeSlot = await TimeSlot.create(timeSlotData);
        results.push({ message: `Time slot created for ${currentDate}`, timeSlot });
      } catch (error) {
        console.error(`Error creating time slot for ${currentDate}:`, error);
        errors.push({ message: `Error creating time slot for ${currentDate}`, error });
      }
    }

    // Send a summary response containing successes and errors
    if (errors.length > 0) {
      return res.status(207).json({
        message: 'Some time slots created with errors',
        results,
        errors,
      });
    } else {
      return res.status(201).json({
        message: 'All time slots created successfully',
        results,
      });
    }
  } catch (error) {
    console.error('Error creating time slots:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};








// Get all time slots for a specific scenario
exports.getAllTimeSlotsByScenario = async (req, res) => {
  try {
    const { scenarioId } = req.params;
    const timeSlots = await TimeSlot.find({ scenario: scenarioId });
    res.status(200).json(timeSlots);
  } catch (error) {
    console.error('Error fetching time slots by scenario:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};


// Get time slots by scenario and date (for a specific date)
exports.getTimeSlotsByDate = async (req, res) => {
  try {
    const { scenarioId, date } = req.query;
    const timeSlots = await TimeSlot.find({ scenario: scenarioId, date, isAvailable: true });
    res.status(200).json(timeSlots);
  } catch (error) {
    console.error('Error fetching time slots:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
exports.getTimeSlotsWithAvailability = async (req, res) => {
  try {
    const { scenarioId, from, to } = req.query;

    // Fetch time slots within the specified date range
    const timeSlots = await TimeSlot.find({
      scenario: scenarioId,
      date: { $gte: from, $lte: to },
    }).lean();

    // Fetch reservations for the given time slots
    const reservations = await Reservation.find({
      timeSlot: { $in: timeSlots.map(slot => slot._id) },
      status: 'approved',
    }).lean();

    // Map reservations to time slots
    const timeSlotMap = timeSlots.map(slot => {
      const isReserved = reservations.some(reservation => reservation.timeSlot.toString() === slot._id.toString());
      return {
        ...slot,
        isAvailable: !isReserved,
      };
    });

    res.status(200).json(timeSlotMap);
  } catch (error) {
    console.error('Error fetching time slots with availability:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Update a time slot (admin)
exports.updateTimeSlot = async (req, res) => {
  try {
    const timeSlot = await TimeSlot.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!timeSlot) {
      return res.status(404).json({ message: 'Time slot not found' });
    }
    res.status(200).json({ message: 'Time slot updated successfully', timeSlot });
  } catch (error) {
    console.error('Error updating time slot:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Delete a time slot (admin)
exports.deleteTimeSlot = async (req, res) => {
  try {
    const timeSlot = await TimeSlot.findByIdAndDelete(req.params.id);
    if (!timeSlot) {
      return res.status(404).json({ message: 'Time slot not found' });
    }
    res.status(200).json({ message: 'Time slot deleted successfully' });
  } catch (error) {
    console.error('Error deleting time slot:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
exports.getTimeSlotsWithAvailability = async (req, res) => {
  try {
    const { scenarioId, from, to } = req.query;

    const timeSlots = await TimeSlot.find({
      scenario: scenarioId,
      date: { $gte: from, $lte: to },
    }).lean(); // Fetch all time slots within the date range

    // Fetch reservations for the given time slots
    const reservations = await Reservation.find({
      timeSlot: { $in: timeSlots.map(slot => slot._id) },
      status: 'approved',
    }).lean();

    // Map reservations to time slots
    const timeSlotMap = timeSlots.map(slot => {
      const isReserved = reservations.some(reservation => reservation.timeSlot.toString() === slot._id.toString());
      return {
        ...slot,
        isAvailable: !isReserved,
      };
    });

    res.status(200).json(timeSlotMap);
  } catch (error) {
    console.error('Error fetching time slots with availability:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

exports.toggleAvailability = async (req, res) => {
  try {
    const { id } = req.params; // Read the time slot ID from the URL params
    const { isAvailable } = req.body; // The new availability status

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid time slot ID' });
    }

    const updatedTimeSlot = await TimeSlot.findByIdAndUpdate(
      id,
      { isAvailable },
      { new: true }
    );

    if (!updatedTimeSlot) {
      return res.status(404).json({ message: 'Time slot not found' });
    }

    res.status(200).json({ message: 'Time slot availability updated', timeSlot: updatedTimeSlot });
  } catch (error) {
    console.error('Error updating time slot:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
