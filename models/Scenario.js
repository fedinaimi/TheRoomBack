const mongoose = require('mongoose');

const scenarioSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, required: true },
  chapters: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' }],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Scenario', scenarioSchema);
