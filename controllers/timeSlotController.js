const TimeSlot = require('../models/TimeSlot');

// Create time slots for a scenario on a specific date (admin)
// Create time slots for a scenario on a specific date (admin)
exports.createTimeSlots = async (req, res) => {
  try {
    const { scenarioId, date, timeRanges } = req.body;

    if (!Array.isArray(timeRanges) || timeRanges.length === 0) {
      return res.status(400).json({ message: 'Time ranges are required' });
    }

    const timeSlotsData = timeRanges.map(range => ({
      scenario: scenarioId,
      date,
      startTime: range.startTime,
      endTime: range.endTime,
      isAvailable: true,
    }));

    const timeSlots = await TimeSlot.insertMany(timeSlotsData);
    res.status(201).json({ message: 'Time slots created successfully', timeSlots });
  } catch (error) {
    console.error('Error creating time slots:', error);
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
