const Chapter = require('../models/Chapter');
const Scenario = require('../models/Scenario');

// Create a new chapter and assign it to a scenario
exports.createChapter = async (req, res) => {
  try {
    const {
      name,
      image,
      video,
      playerNumber,
      time,
      difficulty,
      description,
      comment,
      place,
      scenarioId,
    } = req.body;

    // Check if the scenario exists
    const scenario = await Scenario.findById(scenarioId);
    if (!scenario) {
      return res.status(404).json({ message: 'Scenario not found' });
    }

    // Create the new chapter
    const chapter = new Chapter({
      name,
      image, // Base64 image string
      video, // Base64 video string or URL
      playerNumber,
      time,
      difficulty,
      description,
      comment,
      place,
      scenario: scenarioId, // Link the chapter to the scenario
    });

    await chapter.save();

    // Add the chapter ID to the scenario's chapters array
    scenario.chapters.push(chapter._id);
    await scenario.save();

    res.status(201).json({ message: 'Chapter created successfully and added to scenario', chapter });
  } catch (error) {
    console.error('Error creating chapter:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Get all chapters with their linked scenarios
exports.getAllChapters = async (req, res) => {
  try {
    const chapters = await Chapter.find().populate('scenario');
    res.status(200).json(chapters);
  } catch (error) {
    console.error('Error fetching chapters:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Get chapter by ID
exports.getChapterById = async (req, res) => {
  try {
    const chapter = await Chapter.findById(req.params.id).populate('scenario');
    if (!chapter) {
      return res.status(404).json({ message: 'Chapter not found' });
    }
    res.status(200).json(chapter);
  } catch (error) {
    console.error('Error fetching chapter:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Update a chapter
exports.updateChapter = async (req, res) => {
  try {
    const chapter = await Chapter.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!chapter) {
      return res.status(404).json({ message: 'Chapter not found' });
    }
    res.status(200).json({ message: 'Chapter updated successfully', chapter });
  } catch (error) {
    console.error('Error updating chapter:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Delete a chapter
exports.deleteChapter = async (req, res) => {
  try {
    const chapter = await Chapter.findByIdAndDelete(req.params.id);
    if (!chapter) {
      return res.status(404).json({ message: 'Chapter not found' });
    }

    // Remove the chapter from the scenario's chapters array
    await Scenario.findByIdAndUpdate(chapter.scenario, {
      $pull: { chapters: chapter._id },
    });

    res.status(200).json({ message: 'Chapter deleted successfully' });
  } catch (error) {
    console.error('Error deleting chapter:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
