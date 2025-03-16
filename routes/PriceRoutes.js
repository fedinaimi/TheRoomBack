const express = require('express');
const router = express.Router();
const priceController = require('../controllers/PriceController');
const auth = require('../middlewares/auth'); // Authentication middleware

// GET all
router.get('/', priceController.getAllPrices);

// GET one by ID
router.get('/:id', priceController.getPriceById);

// CREATE
router.post('/',auth, priceController.createPrice);

// UPDATE
router.put('/:id',auth, priceController.updatePrice);

// DELETE
router.delete('/:id',auth, priceController.deletePrice);

module.exports = router;
