const express = require("express");
const router = express.Router();
const { protect, tenantScope } = require("../middlewares/auth");
const {
  getAttendanceRecords,
  getTodayStatus,
  checkIn,
  checkOut,
  getMonthlyReport,
} = require("../controllers/attendanceController");

router.use(protect);
router.use(tenantScope);

router.get("/", getAttendanceRecords);
router.get("/today", getTodayStatus);
router.post("/check-in", checkIn);
router.post("/check-out", checkOut);
router.get("/monthly-report", getMonthlyReport);

module.exports = router;
