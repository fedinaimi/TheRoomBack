const mongoose = require('mongoose');

const ChapterSchema = new mongoose.Schema({
  name: { type: String, required: true },
  image: { type: String },
  video: { type: String },
  playerNumber: { type: Number, required: true },
  minPlayerNumber: { type: Number, required: true }, // Add this
  maxPlayerNumber: { type: Number, required: true }, // Add this
  time: { type: Number, required: true },
  difficulty: { type: String, required: true },
  description: { type: String },
  comment: { type: String },
  place: { type: String, required: true },
  scenario: { type: mongoose.Schema.Types.ObjectId, ref: 'Scenario', required: true }, // Linked scenario
});

module.exports = mongoose.model('Chapter', ChapterSchema);
