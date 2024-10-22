const mongoose = require('mongoose');

const ChapterSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  image: String,  // Image encoded as base64 or stored URL
  video: String,  // Optional video field
  playerNumber: {
    type: Number,
    required: true
  },
  time: {
    type: Number,
    required: true  // Time in minutes
  },
  difficulty: {
    type: String,
    required: true
  },
  description: String,
  comment: String,
  place: {
    type: String,
    required: true
  },
  scenario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Scenario',  // Reference to the Scenario
    required: true
  }
});

module.exports = mongoose.model('Chapter', ChapterSchema);
