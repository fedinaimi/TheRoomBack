const express = require('express');
const router = express.Router();
const priceController = require('../controllers/PriceController');

// GET all
router.get('/', priceController.getAllPrices);

// GET one by ID
router.get('/:id', priceController.getPriceById);

// CREATE
router.post('/', priceController.createPrice);

// UPDATE
router.put('/:id', priceController.updatePrice);

// DELETE
router.delete('/:id', priceController.deletePrice);

module.exports = router;
