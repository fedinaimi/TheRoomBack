const mongoose = require('mongoose');

const timeSlotSchema = new mongoose.Schema({
  scenario: { type: mongoose.Schema.Types.ObjectId, ref: 'Scenario', required: true },
  date: { type: String, required: true }, // Date in "YYYY-MM-DD" format
  startTime: { type: String, required: true }, // e.g., '10:00 AM'
  endTime: { type: String, required: true },   // e.g., '12:00 PM'
  isAvailable: { type: Boolean, default: true }, // Whether the slot is available
});

module.exports = mongoose.model('TimeSlot', timeSlotSchema);