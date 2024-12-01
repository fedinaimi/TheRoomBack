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
const notificationRoutes = require("./routes/notificationRoutes");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'https://theroomclient-1.onrender.com', // Allow requests from React app
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  },
});

// Middleware
app.use(morgan("dev"));
app.use(
  cors({
    origin: process.env.FRONTEND_URL, // Render frontend URL
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  })
);
app.use(bodyParser.json());
app.use(cookieParser());
app.use(helmet());
app.use((req, res, next) => {
  console.log(
    `[${new Date().toISOString()}] ${req.method} ${req.url} - Body:`,
    req.body
  );
  req.io = io; // Attach socket.io instance to requests
  next();
});

// Routes
app.use("/api", userRoutes);
app.use("/api/chapters", chapterRoutes);
app.use("/api/timeslots", timeSlotRoutes);
app.use("/api/scenarios", scenarioRoutes);
app.use("/api/reservations", reservationRoutes);
app.use("/api/notifications", notificationRoutes);

// MongoDB Connection
mongoose
  .connect(process.env.DB_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("MongoDB connected");
    server.listen(process.env.PORT || 5000, () =>
      console.log(`Server running on port ${process.env.PORT || 5000}`)
    );
  })
  .catch((err) => console.error("MongoDB connection error:", err));

// Global Socket.IO Instance
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  // Custom socket events can go here
  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});
