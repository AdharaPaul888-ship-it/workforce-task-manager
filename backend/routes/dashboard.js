const router = require("express").Router();
const {
  getDashboardStats,
  getMemberDetail,
} = require("../controllers/dashboardController");

router.get("/stats", getDashboardStats);
router.get("/member/:userId", getMemberDetail);

module.exports = router;