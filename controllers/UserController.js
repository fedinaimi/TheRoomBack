const User = require("../models/User");
const crypto = require("crypto");
var jwt = require("jsonwebtoken");
const Token = require("../models/Token");
const path = require("path");
const fs = require("fs");
const handlebars = require("handlebars");
const sendEmail = require("../utils/sendEmail");
const urll = ""; // Define the URL here

exports.signup = async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;
    let user = await User.findOne({ email });

    if (user) {
      return res.status(409).send({ message: "User with given email already exists!" });
    }

    user = new User({ firstName, lastName, email });
    user.setPassword(password);
    await user.save();

    const token = new Token({
      userId: user._id,
      token: crypto.randomBytes(32).toString("hex"),
    });

    await token.save();

    const templatePath = path.join(__dirname, "../public/email_templates", "verification.html");
    const templateContent = fs.readFileSync(templatePath, "utf-8");
    const template = handlebars.compile(templateContent);

    const verificationToken = `${urll}/${user._id}/verify/${token.token}`;
    const emailContent = template({ firstName: user.firstName, verificationToken });

    await sendEmail(user.email, "Verify Email", emailContent);

    res.status(201).send({ message: "An email has been sent to your account, please verify" });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).send({ message: "Internal Server Error" });
  }
};

exports.verifyToken = async (req, res) => {
  try {
    const token = await Token.findOne({ token: req.params.token });

    if (!token) {
      return res.status(400).send({
        type: "not-verified",
        msg: "We were unable to find a valid token. Your token may have expired.",
      });
    }

    const user = await User.findOne({ _id: token.userId });

    if (!user) {
      return res.status(400).send({ msg: "We were unable to find a user for this token." });
    }

    if (user.verified) {
      return res.status(400).send({
        type: "already-verified",
        msg: "This user has already been verified.",
      });
    }

    user.verified = true;
    await user.save();
    res.status(200).send("The account has been verified. Please login.");
  } catch (error) {
    console.error("Verification error:", error);
    res.status(500).send({ message: "Internal Server Error" });
  }
};

exports.signin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || !user.validPassword(password)) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (!user.verified) {
      return res.status(401).json({ message: "User not verified" });
    }

    const token = jwt.sign(
      { _id: user._id, email: user.email, firstName: user.firstName, usertype: user.usertype },
      process.env.JWT_SECRET,
      { expiresIn: "2h" }
    );

    res.json({
      token,
      userId: user._id,
      email: user.email,
      firstName: user.firstName,
      usertype: user.usertype,
      birthday: user.birthday,
      occupation: user.occupation,
    });
  } catch (error) {
    console.error("Signin error:", error);
    res.status(500).send({ message: "Internal Server Error" });
  }
};

exports.signout = (req, res) => {
  res.clearCookie("token");
  return res.json({
    message: "User signout",
  });
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }

    const resetCode = crypto.randomBytes(3).toString("hex").toUpperCase(); // 6-digit code
    const resetTokenExpiration = Date.now() + 3600000; // 1-hour expiration

    user.resetPasswordToken = resetCode;
    user.resetPasswordExpires = resetTokenExpiration;

    await user.save();

    const emailContent = `Your password reset code is ${resetCode}. This code will expire in one hour.`;
    await sendEmail(user.email, "Reset Password", emailContent);

    res.status(200).send({ message: "Reset password code sent to your email" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Internal Server Error" });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { code, newPassword, confirmPassword } = req.body;

    if (newPassword !== confirmPassword) {
      return res.status(400).send({ message: "Passwords do not match" });
    }

    const user = await User.findOne({
      resetPasswordToken: code,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).send({ message: "Invalid or expired reset code" });
    }

    user.setPassword(newPassword);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    res.status(200).send({ message: "Password reset successful" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Internal Server Error" });
  }
};

exports.modifyPassword = async (req, res) => {
  try {
    const userId = req.user._id;
    const { oldPassword, newPassword, confirmPassword } = req.body;

    if (newPassword !== confirmPassword) {
      return res.status(400).send({ message: "Passwords do not match" });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }

    if (user.modifyPassword(oldPassword, newPassword)) {
      await user.save();
      return res.status(200).send({ message: "Password modified successfully" });
    } else {
      return res.status(401).send({ message: "Incorrect old password" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Internal Server Error" });
  }
};

exports.completeProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      verified, username, address, occupation, birthday, gender, institution, bio,
      phone, skills, linkedinLink, githubLink, facebookLink
    } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }

    // Update fields if provided in the request
    user.verified = verified !== undefined ? verified : user.verified;
    user.address = address !== undefined ? address : user.address;
    user.occupation = occupation !== undefined ? occupation : user.occupation;
    user.birthday = birthday !== undefined ? birthday : user.birthday;
    user.gender = gender !== undefined ? gender : user.gender;
    user.institution = institution !== undefined ? institution : user.institution;
    user.bio = bio !== undefined ? bio : user.bio;
    user.phone = phone !== undefined ? phone : user.phone;
    user.username = username !== undefined ? username : user.username;

    if (Array.isArray(skills)) {
      user.skills = skills;
    }

    user.linkedinLink = linkedinLink !== undefined ? linkedinLink : user.linkedinLink;
    user.githubLink = githubLink !== undefined ? githubLink : user.githubLink;
    user.facebookLink = facebookLink !== undefined ? facebookLink : user.facebookLink;

    await user.save();

    res.status(200).send({ message: "Profile updated successfully", user });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Internal Server Error" });
  }
};

exports.fetchProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).select('-hash -salt');

    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Internal Server Error" });
  }
};

exports.fetchAllUsers = async (req, res) => {
  if (req.user.usertype !== 'admin') {
    return res.status(403).send({ message: "Access denied" });
  }

  try {
    const users = await User.find().select('-hash -salt');
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Internal Server Error" });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const { gender, occupation, avatarUrl } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: { gender, occupation, avatarUrl } },
      { new: true, runValidators: true }
    ).select('-hash -salt');

    if (!updatedUser) {
      return res.status(404).send({ message: "User not found" });
    }

    res.status(200).send({ message: "Profile updated successfully", user: updatedUser });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).send({ message: "Internal Server Error" });
  }
};

exports.updateAvatar = async (req, res) => {
  try {
    const { userId, avatarBase64 } = req.body;

    if (!userId || !avatarBase64) {
      return res.status(400).send('User ID and avatar image are required.');
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { avatarUrl: avatarBase64 },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).send('User not found.');
    }

    res.status(200).json(updatedUser);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
};

exports.updateCV = async (req, res) => {
  try {
    const { userId } = req.body;
    const CVFile = req.file;

    if (!userId || !CVFile) {
      return res.status(400).send('User ID and CV file are required.');
    }

    const CVBase64 = CVFile.buffer.toString('base64');
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { CV: CVBase64 },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).send('User not found.');
    }

    res.status(200).json(updatedUser);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
};

exports.getUsernameById = async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ username: user.username });
  } catch (error) {
    res.status(500).json({ message: "Error retrieving user", error });
  }
};

exports.checkVerification = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).select('verified');

    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }

    res.status(200).send({ verified: user.verified });
  } catch (error) {
    console.error("Error fetching verification status:", error);
    res.status(500).send({ message: "Internal Server Error" });
  }
};
