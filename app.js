const express = require("express");
const errorHandler = require("./middlewares/errorHandler");
const http = require("http");
const morgan = require("morgan");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const mongoose = require("mongoose"); // Import Mongoose

// Load environment variables from .env file
require("dotenv").config({ path: "./config/config.env" });

const dbUrl = process.env.DB_URL; // Database URL from .env file
const port = 5000;

// Import routes
const userRoutes = require("./routes/userRoutes");
const chapterRoutes = require("./routes/chapterRoutes");
const timeSlotRoutes = require("./routes/timeSlotRoutes");
const scenarioRoutes = require("./routes/scenarioRoutes");
const reservationRoutes = require("./routes/reservationRoutes");




const app = express();
app.use("/images", express.static(path.join(__dirname, "images")));
app.use("/public", express.static("public"));
app.use(morgan("dev"));

// CORS configuration
app.use(cors({
  origin: 'http://localhost:3000', // Allow requests from React app
  methods: "GET,POST,PUT,DELETE,PATCH,OPTIONS",
  credentials: true
}));

// Parsing middleware
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());

// Security headers
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "data:", "'unsafe-inline'", "'unsafe-eval'", "*.example.me"],
      styleSrc: ["'self'", "data:", "'unsafe-inline'", "*.example.me"],
      imgSrc: ["'self'", "data:", "blob:", "*.example.me"],
      mediaSrc: ["'self'", "data:", "*.example.me"],
    },
  })
);

// Use routes
app.use("/api", userRoutes);
app.use("/api/chapters", chapterRoutes);  // Chapter routes
app.use("/api/timeslots", timeSlotRoutes); // TimeSlot routes
app.use("/api/scenarios", scenarioRoutes); // Scenario routes
app.use("/api/reservations", reservationRoutes); // Reservation routes
// Error handling middleware
app.use(errorHandler);

// MongoDB connection configuration using Mongoose
async function connectToDatabase() {
  try {
    await mongoose.connect(dbUrl, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000, // Increase timeout to 30 seconds
    });
    console.log("Connected to MongoDB!");
  } catch (error) {
    console.error('Failed to connect to the database:', error);
    throw error; // Rethrow the error to handle it later
  }
}

// Call the connectToDatabase function
connectToDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  })
  .catch(error => {
    console.error('Failed to start the server:', error);
  });
