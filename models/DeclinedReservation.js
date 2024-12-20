const mongoose = require("mongoose");

const declinedReservationSchema = new mongoose.Schema({
  scenario: { type: mongoose.Schema.Types.ObjectId, ref: "Scenario", required: true },
  chapter: { type: mongoose.Schema.Types.ObjectId, ref: "Chapter", required: true },
  timeSlot: { type: mongoose.Schema.Types.ObjectId, ref: "TimeSlot", required: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  language: { type: String, required: false },
  createdAt: { type: Date, default: Date.now },
  status: { type: String, enum: ["declined", "pending", "approved"], default: "declined" }, // Add status field
  people: { type: Number, required: true }, // New field

});

module.exports = mongoose.model("DeclinedReservation", declinedReservationSchema);
