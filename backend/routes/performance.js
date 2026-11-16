const express = require("express");
const router = express.Router();
const { protect, tenantScope } = require("../middlewares/auth");
const {
  getPerformanceStats,
  getPerformanceEmployees,
  getGoals,
  getGoalById,
  createGoal,
  updateGoal,
  updateGoalProgress,
  deleteGoal,
  getKPIs,
  getKPIById,
  createKPI,
  updateKPI,
  recordKPIHistory,
  deleteKPI,
  getReviews,
  getReviewById,
  createReview,
  submitSelfAssessment,
  submitManagerAssessment,
  deleteReview,
  getFeedback,
  createFeedback,
  acknowledgeFeedback,
  deleteFeedback,
  getAppraisals,
  getAppraisalById,
  createAppraisal,
  updateAppraisal,
  signOffAppraisal,
  deleteAppraisal,
} = require("../controllers/performanceController");

router.use(protect);
router.use(tenantScope);

// Stats & Employees helper
router.get("/stats", getPerformanceStats);
router.get("/employees", getPerformanceEmployees);

// Goals
router.get("/goals", getGoals);
router.get("/goals/:id", getGoalById);
router.post("/goals", createGoal);
router.put("/goals/:id", updateGoal);
router.patch("/goals/:id/progress", updateGoalProgress);
router.delete("/goals/:id", deleteGoal);

// KPIs
router.get("/kpis", getKPIs);
router.get("/kpis/:id", getKPIById);
router.post("/kpis", createKPI);
router.put("/kpis/:id", updateKPI);
router.post("/kpis/:id/history", recordKPIHistory);
router.delete("/kpis/:id", deleteKPI);

// Performance Reviews
router.get("/reviews", getReviews);
router.get("/reviews/:id", getReviewById);
router.post("/reviews", createReview);
router.put("/reviews/:id/self", submitSelfAssessment);
router.put("/reviews/:id/manager", submitManagerAssessment);
router.delete("/reviews/:id", deleteReview);

// Continuous Feedback
router.get("/feedback", getFeedback);
router.post("/feedback", createFeedback);
router.patch("/feedback/:id/acknowledge", acknowledgeFeedback);
router.delete("/feedback/:id", deleteFeedback);

// Appraisals
router.get("/appraisals", getAppraisals);
router.get("/appraisals/:id", getAppraisalById);
router.post("/appraisals", createAppraisal);
router.put("/appraisals/:id", updateAppraisal);
router.patch("/appraisals/:id/sign-off", signOffAppraisal);
router.delete("/appraisals/:id", deleteAppraisal);

module.exports = router;
