const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  message: { type: String, required: true },
  reservationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Reservation', required: true },
  isRead: { type: Boolean, default: false },
  details: { type: Object, default: {} }, // To store detailed reservation info
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Notification', notificationSchema);
