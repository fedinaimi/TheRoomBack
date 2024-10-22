const { body } = require('express-validator');

const validateSignUp = [
  body('email').isEmail().withMessage('Invalid email address'),
  body('mobileNumber').isMobilePhone().withMessage('Invalid mobile number'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
];

const validateSignIn = [
  body('email').isEmail().withMessage('Invalid email address'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
];
