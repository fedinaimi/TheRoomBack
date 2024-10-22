const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.applicationDefault(), // Or use a service account key
  storageBucket: "YOUR_STORAGE_BUCKET",
});

module.exports = admin;
