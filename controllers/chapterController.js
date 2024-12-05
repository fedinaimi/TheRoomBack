const Chapter = require('../models/Chapter');
const Scenario = require('../models/Scenario');
const mongoose = require('mongoose'); // Add this line to import mongoose

const cloudinary = require('../config/cloudinaryConfig');



const uploadToCloudinary = async (file, folder, resourceType = 'auto') => {
  try {
    const result = await cloudinary.uploader.upload(file, {
      folder,
      resource_type: resourceType,
    });
    return result.secure_url;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw new Error('Failed to upload to Cloudinary');
  }
};

exports.createChapter = async (req, res) => {
  try {
    const { name, playerNumber, time, difficulty, description, comment, place, scenarioId } = req.body;

    const imageUrl = req.files?.image
      ? await uploadToCloudinary(req.files.image[0].path, 'chapters/images', 'image')
      : null;
    const videoUrl = req.files?.video
      ? await uploadToCloudinary(req.files.video[0].path, 'chapters/videos', 'video')
      : null;

    const chapter = new Chapter({
      name,
      playerNumber,
      time,
      difficulty,
      description,
      comment,
      place,
      image: imageUrl,
      video: videoUrl,
      scenario: scenarioId,
    });

    await chapter.save();
    res.status(201).json({ message: 'Chapter created successfully', chapter });
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

exports.getChapterById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate the ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid chapter ID format' });
    }

    // Fetch the chapter and populate the scenario field
    const chapter = await Chapter.findById(id).populate('scenario');

    if (!chapter) {
      return res.status(404).json({ message: 'Chapter not found' });
    }

    // Return the chapter details
    res.status(200).json(chapter);
  } catch (error) {
    console.error('Error fetching chapter:', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Update a chapter
exports.updateChapter = async (req, res) => {
  try {
    const { name, playerNumber, time, difficulty, description, comment, place, scenarioId } = req.body;

    const chapter = await Chapter.findById(req.params.id);
    if (!chapter) return res.status(404).json({ message: 'Chapter not found' });

    const imageUrl = req.files?.image
      ? await uploadToCloudinary(req.files.image[0].path, 'chapters/images', 'image')
      : chapter.image;
    const videoUrl = req.files?.video
      ? await uploadToCloudinary(req.files.video[0].path, 'chapters/videos', 'video')
      : chapter.video;

    const updatedChapter = await Chapter.findByIdAndUpdate(
      req.params.id,
      {
        name,
        playerNumber,
        time,
        difficulty,
        description,
        comment,
        place,
        image: imageUrl,
        video: videoUrl,
        scenario: scenarioId || chapter.scenario,
      },
      { new: true }
    );

    res.status(200).json({ message: 'Chapter updated successfully', chapter: updatedChapter });
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



exports.getScenarioFromChapter = async (req, res) => {
  try {
      const chapterId = req.params.id; // Get chapter ID from request parameters
      const chapter = await Chapter.findById(chapterId).populate('scenario'); // Populate the scenario field

      if (!chapter) {
          return res.status(404).json({ message: 'Chapter not found' });
      }

      // Return the scenario ID and any other desired chapter information
      const scenarioId = chapter.scenario._id;
      res.status(200).json({
          chapterId: chapter._id,
          scenarioId: scenarioId,
          chapterName: chapter.name,
          // add more fields as needed
      });
  } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error', error: error.message });
  }
};