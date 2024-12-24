// src/models/Chapter.js

const mongoose = require('mongoose');

const ChapterSchema = new mongoose.Schema({
  name: { type: String, required: true },
  image: { type: String },
  video: { type: String },
  minPlayerNumber: { type: Number, required: true },
  maxPlayerNumber: { type: Number, required: true },
  percentageOfSuccess: { type: Number, default: 0 }, // Existing field
  time: { type: Number, required: true },
  difficulty: { type: String, required: true },
  description: { type: String },
  comment: { type: String },
  place: { type: String, required: true },
  scenario: { type: mongoose.Schema.Types.ObjectId, ref: 'Scenario', required: true }, // Linked scenario
  
  // New Fields
  price: {
    type: Number,
    required: true,
    min: [0, 'Le prix ne peut pas être négatif.'],
  },
  remisePercentagePerPerson: {
    type: Number,
    required: true,
    min: [0, 'Le pourcentage de remise ne peut pas être inférieur à 0%.'],
    max: [100, 'Le pourcentage de remise ne peut pas dépasser 100%.'],
  },
});

module.exports = mongoose.model('Chapter', ChapterSchema);
