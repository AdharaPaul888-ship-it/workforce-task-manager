const express = require("express");
const router = express.Router();
const { protect, tenantScope } = require("../middlewares/auth");
const {
  getMonthlyPlanStats,
  getMonthlyPlans,
  getMonthlyPlanById,
  createMonthlyPlan,
  updateMonthlyPlan,
  updateMonthlyPlanStatus,
  deleteMonthlyPlan,
  addScheduleItem,
  updateScheduleItem,
  deleteScheduleItem,
  addAssignment,
  updateAssignment,
  deleteAssignment,
  getPlannedVsActualTracking,
  getOrganizationMembers,
} = require("../controllers/monthlyPlanController");

router.use(protect);
router.use(tenantScope);

// Stats & tracking
router.get("/stats", getMonthlyPlanStats);
router.get("/tracking/variance", getPlannedVsActualTracking);
router.get("/members", getOrganizationMembers);

// Plan CRUD
router.get("/", getMonthlyPlans);
router.get("/:id", getMonthlyPlanById);
router.post("/", createMonthlyPlan);
router.put("/:id", updateMonthlyPlan);
router.patch("/:id/status", updateMonthlyPlanStatus);
router.delete("/:id", deleteMonthlyPlan);

// Schedules
router.post("/:id/schedules", addScheduleItem);
router.put("/:id/schedules/:scheduleId", updateScheduleItem);
router.delete("/:id/schedules/:scheduleId", deleteScheduleItem);

// Employee assignments
router.post("/:id/assignments", addAssignment);
router.put("/:id/assignments/:assignmentId", updateAssignment);
router.delete("/:id/assignments/:assignmentId", deleteAssignment);

module.exports = router;
