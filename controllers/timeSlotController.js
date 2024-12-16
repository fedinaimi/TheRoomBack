const TimeSlot = require('../models/TimeSlot');
const Reservation = require('../models/Reservation');
const mongoose = require('mongoose');

// Create time slots for a scenario on a specific date (admin)




exports.createTimeSlots = async (req, res) => {
  try {
    const { chapterId, dateRange, weekdayTime } = req.body;

    if (!chapterId || !dateRange || !dateRange.from || !dateRange.to) {
      return res.status(400).json({ message: 'Chapter ID and date range are required.' });
    }

    const startDate = new Date(dateRange.from);
    const endDate = new Date(dateRange.to);
    if (startDate > endDate) {
      return res.status(400).json({ message: '"From" date cannot be later than "To" date.' });
    }

    if (!weekdayTime.startTime || !weekdayTime.endTime) {
      return res.status(400).json({ message: 'Time range for days is required.' });
    }

    const slotDuration = 90; // 90 minutes per time slot
    const timeSlots = [];

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const currentDate = d.toISOString().split('T')[0];
      const start = new Date(`${currentDate}T${weekdayTime.startTime}:00`);
      const end = new Date(`${currentDate}T${weekdayTime.endTime}:00`);

      let currentSlotStart = start;

      while (currentSlotStart < end) {
        const currentSlotEnd = new Date(currentSlotStart.getTime() + slotDuration * 60 * 1000);

        if (currentSlotEnd > end) break;

        timeSlots.push({
          chapter: chapterId,
          date: currentDate,
          startTime: currentSlotStart.toISOString(),
          endTime: currentSlotEnd.toISOString(),
          isAvailable: true,
          status: 'available',
        });

        currentSlotStart = currentSlotEnd;
      }
    }

    const createdTimeSlots = await TimeSlot.insertMany(timeSlots);

    res.status(201).json({ message: 'Time slots created successfully.', timeSlots: createdTimeSlots });
  } catch (error) {
    console.error('Error creating time slots:', error);
    res.status(500).json({ message: 'Internal server error.' });
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

    // Validate input
    if (!chapterId || !date) {
      return res.status(400).json({ message: 'Chapter ID and date are required.' });
    }

    console.log(`Fetching time slots for Chapter ID: ${chapterId}, Date: ${date}`);

    // Fetch time slots from the database
    const timeSlots = await TimeSlot.find({ chapter: chapterId, date }).lean();

    // Handle case where no time slots exist for the chapter
    if (!timeSlots || timeSlots.length === 0) {
      console.warn(`No time slots found for Chapter ID: ${chapterId} on Date: ${date}`);
      return res.status(200).json([]); // Return an empty array
    }

    console.log(`Found ${timeSlots.length} time slot(s) for Chapter ID: ${chapterId}, Date: ${date}`);
    res.status(200).json(timeSlots);
  } catch (error) {
    console.error('Error fetching time slots by date:', error);
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
    const { chapterId, date } = req.query;

    if (!chapterId || !date) {
      return res.status(400).json({ message: 'Chapter ID and date are required.' });
    }

    // Fetch all time slots for the chapter and date
    const timeSlots = await TimeSlot.find({ chapter: chapterId, date }).lean();

    if (!timeSlots.length) {
      return res.status(200).json([]); // Return an empty array if no slots are found
    }

    // Fetch all reservations for the time slots
    const reservations = await Reservation.find({
      timeSlot: { $in: timeSlots.map(slot => slot._id) },
    }).lean();

    // Map reservations to time slots
    const reservationStatusMap = {};
    reservations.forEach((reservation) => {
      const slotId = reservation.timeSlot.toString();
      if (!reservationStatusMap[slotId]) {
        reservationStatusMap[slotId] = reservation.status;
      } else if (reservation.status === 'approved') {
        reservationStatusMap[slotId] = 'approved'; // Prioritize approved reservations
      }
    });

    // Add status to time slots
    const updatedTimeSlots = timeSlots.map((slot) => {
      const reservationStatus = reservationStatusMap[slot._id.toString()] || null;
      if (!slot.isAvailable) {
        slot.status = 'unavailable';
      } else if (reservationStatus === 'approved') {
        slot.status = 'booked';
      } else if (reservationStatus === 'pending') {
        slot.status = 'pending';
      } else {
        slot.status = 'available';
      }
      return slot;
    });

    res.status(200).json(updatedTimeSlots);
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
exports.disableTimeSlotsForScenarios = async (req, res) => {
  try {
    const { scenarioIds } = req.body;

    if (!scenarioIds || scenarioIds.length === 0) {
      return res.status(400).json({ message: "No scenarios selected." });
    }

    await TimeSlot.updateMany(
      { chapter: { $in: scenarioIds }, isAvailable: true },
      { $set: { isAvailable: false, status: "disabled" } }
    );

    res.status(200).json({ message: "Schedules disabled successfully." });
  } catch (error) {
    console.error("Error disabling schedules:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};
