const express = require('express');
const router = express.Router();
const scenarioController = require('../controllers/scenarioController');
const auth = require('../middlewares/auth'); // Import the auth middleware

// Create a scenario (admin)
router.post('/', auth, scenarioController.createScenario);

// Get all scenarios (no authentication needed)
router.get('/', scenarioController.getAllScenarios);

// Get scenario by ID (no authentication needed)
router.get('/:id', scenarioController.getScenarioById);

// Update a scenario (admin)
router.put('/:id', auth, scenarioController.updateScenario);

// Delete a scenario (admin)
router.delete('/:id', auth, scenarioController.deleteScenario);

module.exports = router;
