const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const morgan = require("morgan");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const mongoose = require("mongoose");
require("dotenv").config({ path: "./config/config.env" });

// Import routes
const userRoutes = require("./routes/userRoutes");
const chapterRoutes = require("./routes/chapterRoutes");
const timeSlotRoutes = require("./routes/timeSlotRoutes");
const scenarioRoutes = require("./routes/scenarioRoutes");
const reservationRoutes = require("./routes/reservationRoutes");
const notificationRoutes = require('./routes/notificationRoutes');

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: "*", // Replace with your frontend URL in production
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  },
});

// Make io accessible globally
global.io = io;

// Socket.IO connection handler
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);
  
  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// Middleware to handle errors from multer (if used)
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // Multer-specific errors
    return res.status(400).json({ message: err.message });
  } else if (err) {
    // Other errors
    return res.status(500).json({ message: err.message });
  }
  next();
});

app.use(cors());

// Middleware
app.use(morgan("dev"));
app.use(cors({ origin: "*", methods: "GET,POST,PUT,DELETE,OPTIONS" }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(helmet());

// Logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - Body:`, req.body);
  next();
});

// Routes
app.use("/api", userRoutes);
app.use("/api/chapters", chapterRoutes);
app.use("/api/timeslots", timeSlotRoutes);
app.use("/api/scenarios", scenarioRoutes);
app.use("/api/reservations", reservationRoutes);
app.use('/api/notifications', notificationRoutes);

// MongoDB connection
mongoose.connect(process.env.DB_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log("MongoDB connected");
  server.listen(process.env.PORT || 5000, () => console.log(`Server running on port ${process.env.PORT || 5000}`));
}).catch((err) => console.error(err));
