// routes/notificationRoutes.js
const express = require("express");
const router = express.Router();
const {
  getAllNotifications,
  markAsRead,
  deleteNotification,
} = require("../controllers/notificationController");

// Routes
router.get("/", getAllNotifications);
router.put("/:id/read", markAsRead);
router.delete("/:id", deleteNotification);

module.exports = router;
