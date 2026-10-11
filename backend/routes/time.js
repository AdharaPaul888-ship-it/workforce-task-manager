const router = require("express").Router();
const {
  getTimer,
  startTimer,
  pauseTimer,
  resumeTimer,
  stopTimer,
  discardTimer,
  setIdle,
  getWeeklyTimesheet,
  updateTimesheetCell,
  submitTimesheet,
  getTimesheets,
  approveTimesheet,
  getTimeEntries,
  createTimeEntry,
} = require("../controllers/timeController");
const { authorize } = require("../middlewares/authorize");

router.get("/timer", getTimer);
router.post("/timer/start", authorize("timelog.record"), startTimer);
router.post("/timer/pause", authorize("timelog.record"), pauseTimer);
router.post("/timer/resume", authorize("timelog.record"), resumeTimer);
router.post("/timer/stop", authorize("timelog.record"), stopTimer);
router.post("/timer/discard", authorize("timelog.record"), discardTimer);
router.post("/idle", setIdle);
router.get("/timesheets/week", getWeeklyTimesheet);
router.put("/timesheets/:id/cell", updateTimesheetCell);
router.post("/timesheets/:id/submit", submitTimesheet);
router.get("/timesheets", getTimesheets);
router.post("/timesheets/:id/approve", approveTimesheet);
router.get("/entries", getTimeEntries);
router.post("/entries", createTimeEntry);

module.exports = router;