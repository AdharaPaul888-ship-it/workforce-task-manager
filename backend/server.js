// server.js
// Entry point - keeps "creating the app" separate from "starting the server".
// This separation also makes automated testing easier later.
require("dotenv").config();

// Fix for MongoDB driver crypto issue in some environments
global.crypto = require("crypto");

const app = require("./app");
const connectDB = require("./config/db");

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err.message);
    process.exit(1);
  });

// app.listen(PORT, () => {
//   console.log(`Server running on http://localhost:${PORT}`);
// });