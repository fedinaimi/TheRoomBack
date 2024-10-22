// userRoutes.js
const express = require("express");
const multer = require('multer');
const {checkVerification ,updateAvatar, getUsernameById ,signin, signup, signout, forgotPassword, resetPassword, modifyPassword,completeProfile,fetchProfile,fetchAllUsers,updateProfile ,validateBlocNoteOwnership, updateCV} = require("../controllers/UserController");
const auth = require("../middlewares/auth");
const router = express.Router();
//const {  } = require('../controllers/UserController');

router.post("/signup", signup);
router.post("/signin", signin);
router.post("/signout", signout);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/modify-password", auth, modifyPassword);
router.put("/complete-profile", auth, completeProfile);
router.get("/fetch-profile", auth, fetchProfile);
router.get("/fetch-all-users", auth, fetchAllUsers);
router.put("/update-profile", auth, updateProfile);
////router.post("/validate-ownership",auth, validateBlocNoteOwnership);
router.put('/update-avatar', updateAvatar); // Route to update the avatar
router.put('/update-CV', updateCV); // Route to update the avatar
router.get("/check-verification", auth, checkVerification); // Add the route




// In your route



const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Directory to store uploaded files
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // Unique filename
    }
});

const upload = multer({ 
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});



// Use the upload middleware in the route
router.post("/complete-profile", auth, upload.single('avatar'), completeProfile);
router.get("/by-id/:id", getUsernameById);

module.exports = router;
