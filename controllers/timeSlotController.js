const TimeSlot = require('../models/TimeSlot');
const Reservation = require('../models/Reservation');
const mongoose = require('mongoose');

// Create time slots for a scenario on a specific date (admin)


exports.createTimeSlots = async (req, res) => {
  try {
    const { chapterId, dateRange, weekdayTime, weekendTime } = req.body;

    // Validate input
    if (!chapterId || !dateRange || !dateRange.from || !dateRange.to) {
      return res.status(400).json({ message: 'Invalid data: chapterId and dateRange are required.' });
    }

    const startDate = new Date(dateRange.from);
    const endDate = new Date(dateRange.to);
    if (startDate > endDate) {
      return res.status(400).json({ message: '"from" date cannot be later than "to" date.' });
    }

    if (
      !weekdayTime.startTime || !weekdayTime.endTime ||
      !weekendTime.startTime || !weekendTime.endTime
    ) {
      return res.status(400).json({ message: 'Invalid data: Missing time ranges for weekday or weekend.' });
    }

    const slotDuration = 90; // Duration in minutes (1h30)
    const timeSlotsData = [];

    // Loop through each day in the range
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const currentDate = d.toISOString().split('T')[0];
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;

      const startTime = isWeekend ? weekendTime.startTime : weekdayTime.startTime;
      const endTime = isWeekend ? weekendTime.endTime : weekdayTime.endTime;

      const start = new Date(`${currentDate}T${startTime}:00`);
      const end = new Date(`${currentDate}T${endTime}:00`);

      let currentSlotStart = start;
      while (currentSlotStart < end) {
        const currentSlotEnd = new Date(currentSlotStart.getTime() + slotDuration * 60 * 1000);

        if (currentSlotEnd > end) break;

        timeSlotsData.push({
          chapter: chapterId,
          date: currentDate,
          startTime: currentSlotStart.toISOString(),
          endTime: currentSlotEnd.toISOString(),
          isAvailable: true,
        });

        currentSlotStart = currentSlotEnd; // Move to the next slot
      }
    }

    // Log generated slots
    console.log(`Generated ${timeSlotsData.length} time slots for chapter ${chapterId}`);

    // Insert time slots into the database
    const timeSlots = await TimeSlot.insertMany(timeSlotsData);
    res.status(201).json({ message: 'Time slots created successfully', timeSlots });
  } catch (error) {
    console.error('Error creating time slots:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};










// Get all time slots for a specific scenario
exports.getAllTimeSlotsByScenario = async (req, res) => {
  try {
    const { scenarioId } = req.params;

    if (!scenarioId) {
      return res.status(400).json({ message: 'Missing required parameter: scenarioId.' });
    }

    // Fetch all time slots for the given scenario
    const timeSlots = await TimeSlot.find({ scenario: scenarioId }).lean();

    // Helper function to format the time slots
    const formatTimeSlot = (start, end) => {
      const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
      const startDate = new Date(start);
      const endDate = new Date(end);

      const dayDate = startDate.toLocaleDateString('en-US', options);
      const startTime = startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      const endTime = endDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

      return `${dayDate}, ${startTime} - ${endTime}`;
    };

    // Map the time slots to include formatted data
    const formattedTimeSlots = timeSlots.map(slot => ({
      id: slot._id,
      scenario: slot.scenario,
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      formattedTimeSlot: formatTimeSlot(slot.startTime, slot.endTime),
      isAvailable: slot.isAvailable,
    }));

    res.status(200).json(formattedTimeSlots);
  } catch (error) {
    console.error('Error fetching time slots by scenario:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};



// Get time slots by scenario and date (for a specific date)
exports.getTimeSlotsByDate = async (req, res) => {
  try {
    const { chapterId, date } = req.query;
    const timeSlots = await TimeSlot.find({ chapter: chapterId, date, isAvailable: true });
    res.status(200).json(timeSlots);
  } catch (error) {
    console.error('Error fetching time slots:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

/*

exports.getTimeSlotsByDate = async (req, res) => {
  try {
    const { scenarioId } = req.params; // Correctly access scenarioId from params
    const { date } = req.query; // Access date from query

    if (!date) {
      return res.status(400).json({ message: 'Date query parameter is required' });
    }

    const timeSlots = await TimeSlot.find({ scenario: scenarioId, date, isAvailable: true });
    res.status(200).json(timeSlots);
  } catch (error) {
    console.error('Error fetching time slots:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
*/
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
    const { id } = req.params;
    const { isAvailable } = req.body;

    // Log incoming data for debugging
    console.log('Request Params:', req.params);
    console.log('Request Body:', req.body);

    // Validate the inputs
    if (!id || typeof isAvailable !== 'boolean') {
      console.error('Validation failed:', { id, isAvailable });
      return res.status(400).json({ message: 'Invalid ID or availability status.' });
    }

    // Find and update the time slot
    const updatedTimeSlot = await TimeSlot.findByIdAndUpdate(
      id,
      { isAvailable },
      { new: true } // Return the updated document
    );

    if (!updatedTimeSlot) {
      console.error('Time slot not found:', id);
      return res.status(404).json({ message: 'Time slot not found.' });
    }

    res.status(200).json(updatedTimeSlot);
  } catch (error) {
    console.error('Error toggling availability:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};





// timeSlotController.js
exports.getTimeSlotsByChapterAndDate = async (req, res) => {
  try {
    console.log('Received Query:', req.query); // Debugging

    const { chapterId, date } = req.query;

    if (!chapterId || !date) {
      console.log('Validation Error: Missing chapterId or date');
      return res.status(400).json({ message: 'Chapter ID and date are required.' });
    }

    const timeSlots = await TimeSlot.find({ chapter: chapterId, date }).lean();

    console.log('Query Result:', timeSlots); // Debugging

    if (!timeSlots.length) {
      console.log('No time slots found for:', { chapterId, date });
      return res.status(404).json({ message: 'No time slots found for the given chapter and date.' });
    }

    res.status(200).json(timeSlots);
  } catch (error) {
    console.error('Error in getTimeSlotsByChapterAndDate:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};



// Controller function to clear all time slots for a chapter
exports.clearAllTimeSlotsForChapter = async (req, res) => {
  try {
    const { chapterId } = req.params;
    const deletedSlots = await TimeSlot.deleteMany({ chapter: chapterId });

    res.status(200).json({
      message: `${deletedSlots.deletedCount} time slots deleted for chapter ${chapterId}.`,
    });
  } catch (error) {
    console.error('Error clearing all time slots for chapter:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Controller function to clear time slots for a specific date
exports.clearTimeSlotsForDay = async (req, res) => {
  try {
    const { chapterId } = req.params;
    const { date } = req.body; // Now expects date from request body

    if (!date) {
      return res.status(400).json({ message: 'Date is required.' });
    }

    const deletedSlots = await TimeSlot.deleteMany({ chapter: chapterId, date });

    res.status(200).json({
      message: `${deletedSlots.deletedCount} time slots deleted for chapter ${chapterId} on ${date}.`,
    });
  } catch (error) {
    console.error('Error clearing time slots for day:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Controller function to disable all time slots for a specific date
exports.disableTimeSlotsForDay = async (req, res) => {
  try {
    const { chapterId } = req.params;
    const { date } = req.body; // Now expects date from request body

    if (!date) {
      return res.status(400).json({ message: 'Date is required.' });
    }

    const updatedSlots = await TimeSlot.updateMany(
      { chapter: chapterId, date },
      { isAvailable: false }
    );

    res.status(200).json({
      message: `${updatedSlots.modifiedCount} time slots disabled for chapter ${chapterId} on ${date}.`,
    });
  } catch (error) {
    console.error('Error disabling time slots for day:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
// Controller function to enable all time slots for a specific date
exports.enableTimeSlotsForDay = async (req, res) => {
  try {
    const { chapterId } = req.params;
    const { date } = req.body; // Expect date in YYYY-MM-DD format

    if (!date) {
      return res.status(400).json({ message: 'Date is required.' });
    }

    const updatedSlots = await TimeSlot.updateMany(
      { chapter: chapterId, date },
      { isAvailable: true }
    );

    res.status(200).json({
      message: `${updatedSlots.modifiedCount} time slots enabled for chapter ${chapterId} on ${date}.`,
    });
  } catch (error) {
    console.error('Error enabling time slots for day:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
