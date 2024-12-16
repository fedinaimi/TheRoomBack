const mongoose = require('mongoose');

const timeSlotSchema = new mongoose.Schema({
  chapter: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter', required: true },
  date: { type: String, required: true }, // Format: YYYY-MM-DD
  startTime: { type: String, required: true }, // Format: HH:mm:ss
  endTime: { type: String, required: true },   // Format: HH:mm:ss
  isAvailable: { type: Boolean, default: true },
  status: {
    type: String,
    enum: ['available', 'pending', 'booked', 'unavailable'], // Valid status values
    default: 'available', // Default to "available"
  },
});

module.exports = mongoose.model('TimeSlot', timeSlotSchema);
