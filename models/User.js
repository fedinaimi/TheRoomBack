const mongoose = require("mongoose");
const crypto = require("crypto");
const { boolean } = require("joi");

const options = { discriminatorKey: "usertype" };

const UserSchema = new mongoose.Schema(
  {

  
    
    firstName: {
      type: String,
      required: true, // Changed to true
    },
    lastName: {
      type: String,
      required: true, // Changed to true
    },
    
    email: {
      type: String,
      required: true,
      unique: true, // Ensure the email is unique
    },

    usertype: {
      type: String,
      enum: ['admin', 'subadmin'],
      default: "admin", // Default role
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
 
    verified: {
      type: Boolean,
      default: false,
    },
    phone: {
      type: Number,
      required: false,
    },
  
 
    resetPasswordToken: String,
    resetPasswordExpires: Date,

    hash: String,
    salt: String,
  },
  options
);

// Method to hash and set the user's password
UserSchema.methods.setPassword = function (password) {
  this.salt = crypto.randomBytes(16).toString("hex");
  this.hash = crypto.pbkdf2Sync(password, this.salt, 1000, 64, `sha512`).toString(`hex`);
};

// Method to check if the entered password is valid
UserSchema.methods.validPassword = function (password) {
  const hash = crypto.pbkdf2Sync(password, this.salt, 1000, 64, `sha512`).toString(`hex`);
  return this.hash === hash;
};

// Method to generate a random password
UserSchema.methods.generatePassword = function (
  length = 20,
  wishlist = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz~!@-#$"
) {
  return Array.from(crypto.randomFillSync(new Uint32Array(length)))
    .map((x) => wishlist[x % wishlist.length])
    .join("");
};

// Method to modify the password
UserSchema.methods.modifyPassword = function (oldPassword, newPassword) {
  if (this.validPassword(oldPassword)) {
    this.setPassword(newPassword);
    return true;
  }
  return false;
};





// Export the User model
const User = mongoose.model("User", UserSchema);

module.exports = User;
