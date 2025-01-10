const mongoose = require('mongoose');

const priceSchema = new mongoose.Schema(
  {
    playersCount: {
      type: Number,
      required: true,
      // e.g. 2 for "2 players," 3 for "3 players," 4 for "4 players"
    },
    isAndAbove: {
      type: Boolean,
      default: false,
      // If true, it means "playersCount or more"
      // e.g. if playersCount=4 and isAndAbove=true => "4 or more"
    },
    pricePerPerson: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'TND',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Price', priceSchema);
