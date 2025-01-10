const Price = require('../models/Price');

// GET all prices
exports.getAllPrices = async (req, res) => {
  try {
    const prices = await Price.find();
    return res.status(200).json(prices);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// GET one price by ID
exports.getPriceById = async (req, res) => {
  try {
    const { id } = req.params;
    const price = await Price.findById(id);
    if (!price) {
      return res.status(404).json({ message: 'Price not found' });
    }
    return res.status(200).json(price);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// CREATE a new price
exports.createPrice = async (req, res) => {
  try {
    const { playersCount, isAndAbove, pricePerPerson, currency } = req.body;
    const newPrice = await Price.create({
      playersCount,
      isAndAbove,
      pricePerPerson,
      currency,
    });
    return res.status(201).json(newPrice);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// UPDATE a price
exports.updatePrice = async (req, res) => {
  try {
    const { id } = req.params;
    const { playersCount, isAndAbove, pricePerPerson, currency } = req.body;

    const updatedPrice = await Price.findByIdAndUpdate(
      id,
      { playersCount, isAndAbove, pricePerPerson, currency },
      { new: true }
    );

    if (!updatedPrice) {
      return res.status(404).json({ message: 'Price not found' });
    }

    return res.status(200).json(updatedPrice);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// DELETE a price
exports.deletePrice = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedPrice = await Price.findByIdAndDelete(id);
    if (!deletedPrice) {
      return res.status(404).json({ message: 'Price not found' });
    }
    return res.status(200).json({ message: 'Price deleted successfully' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
