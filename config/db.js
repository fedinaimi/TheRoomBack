const mongoose = require("mongoose");

const connectToDatabase = async (dbUrl) => {
  try {
    await mongoose.connect(dbUrl);
    console.log("Database connected!");
  } catch (error) {
    console.error("Database connection error:", error);
    throw error;
  }
};

module.exports = connectToDatabase;