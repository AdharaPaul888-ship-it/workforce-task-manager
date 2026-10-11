const router = require("express").Router();
const mongoose = require("mongoose");

// Placeholder routes - will be replaced with actual module routers
router.get("/health", (req, res) => {
  res.json({
    success: true,
    data: {
      status: "ok",
      db: mongoose.connection.readyState,
    },
  });
});

module.exports = router;