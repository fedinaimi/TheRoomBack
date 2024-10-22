const crypto = require('crypto');

function generateUniqueCode(length = 6) {
  return crypto.randomBytes(length).toString('hex').substring(0, length);
}

module.exports = generateUniqueCode;
