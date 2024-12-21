const mongoose = require('mongoose');

const timeSlotSchema = new mongoose.Schema({
  chapter: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter', required: true },
  date: { type: String, required: true }, // Format: YYYY-MM-DD
  startTime: { type: String, required: true }, // Format: HH:mm:ss
  endTime: { type: String, required: true },   // Format: HH:mm:ss
  isAvailable: { type: Boolean, default: true },
  status: {
    type: String,
    enum: ['available', 'pending', 'booked', 'blocked', 'unavailable'], // Added 'blocked'
    default: 'available',
  },
  blockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Reservation', default: null }, // Tracks which reservation blocked this slot
});

module.exports = mongoose.model('TimeSlot', timeSlotSchema);
