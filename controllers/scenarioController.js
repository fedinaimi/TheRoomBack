const Scenario = require('../models/Scenario');

// Create a new scenario (admin)
exports.createScenario = async (req, res) => {
  try {
    const { name, category, chapters } = req.body;
    const scenario = new Scenario({ name, category, chapters });
    await scenario.save();
    res.status(201).json({ message: 'Scenario created successfully', scenario });
  } catch (error) {
    console.error('Error creating scenario:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Get all scenarios
exports.getAllScenarios = async (req, res) => {
  try {
    const scenarios = await Scenario.find().populate('chapters');
    res.status(200).json(scenarios);
  } catch (error) {
    console.error('Error fetching scenarios:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Get scenario by ID
exports.getScenarioById = async (req, res) => {
  try {
    const scenario = await Scenario.findById(req.params.id).populate('chapters');
    if (!scenario) {
      return res.status(404).json({ message: 'Scenario not found' });
    }
    res.status(200).json(scenario);
  } catch (error) {
    console.error('Error fetching scenario:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Update a scenario (admin)
exports.updateScenario = async (req, res) => {
  try {
    const scenario = await Scenario.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!scenario) {
      return res.status(404).json({ message: 'Scenario not found' });
    }
    res.status(200).json({ message: 'Scenario updated successfully', scenario });
  } catch (error) {
    console.error('Error updating scenario:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Delete a scenario (admin)
exports.deleteScenario = async (req, res) => {
  try {
    const scenario = await Scenario.findByIdAndDelete(req.params.id);
    if (!scenario) {
      return res.status(404).json({ message: 'Scenario not found' });
    }
    res.status(200).json({ message: 'Scenario deleted successfully' });
  } catch (error) {
    console.error('Error deleting scenario:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
