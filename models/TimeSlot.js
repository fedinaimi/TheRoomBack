const mongoose = require('mongoose');

const timeSlotSchema = new mongoose.Schema({
  chapter: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter', required: true },
  date: { type: String, required: true }, // Format: YYYY-MM-DD
  startTime: { type: String, required: true }, // Format: HH:mm:ss
  endTime: { type: String, required: true },   // Format: HH:mm:ss
  isAvailable: { type: Boolean, default: true },
});

module.exports = mongoose.model('TimeSlot', timeSlotSchema);
