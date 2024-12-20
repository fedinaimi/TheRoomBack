const mongoose = require("mongoose");

const deletedReservationSchema = new mongoose.Schema({
  scenario: { type: mongoose.Schema.Types.ObjectId, ref: "Scenario", required: true },
  chapter: { type: mongoose.Schema.Types.ObjectId, ref: "Chapter", required: true },
  timeSlot: { type: mongoose.Schema.Types.ObjectId, ref: "TimeSlot", required: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  language: { type: String },
  createdAt: { type: Date, default: Date.now },
  status: { type: String, default: "deleted" }, // Marked as deleted
  people: { type: Number, required: true },
  deletedAt: { type: Date, default: Date.now }, // Timestamp when deleted
});

module.exports = mongoose.model("DeletedReservation", deletedReservationSchema);
