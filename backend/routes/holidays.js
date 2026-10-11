const router = require("express").Router();
const {
  getHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  getLeaveRequests,
  createLeaveRequest,
  updateLeaveStatus,
  deleteLeave,
  getLeaveBalance,
  previewLeave,
} = require("../controllers/holidayController");

router.get("/holidays", getHolidays);
router.post("/holidays", createHoliday);
router.put("/holidays/:id", updateHoliday);
router.delete("/holidays/:id", deleteHoliday);
router.get("/leaves", getLeaveRequests);
router.post("/leaves", createLeaveRequest);
router.put("/leaves/:id/status", updateLeaveStatus);
router.delete("/leaves/:id", deleteLeave);
router.get("/leaves/balance", getLeaveBalance);
router.post("/leaves/preview", previewLeave);

module.exports = router;