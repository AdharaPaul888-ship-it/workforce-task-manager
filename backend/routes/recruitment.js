const express = require("express");
const router = express.Router();
const { protect, tenantScope } = require("../middlewares/auth");
const {
  getRecruitmentStats,
  getJobOpenings,
  getJobOpeningById,
  createJobOpening,
  updateJobOpening,
  deleteJobOpening,
  getApplicants,
  getApplicantById,
  createApplicant,
  updateApplicant,
  updateApplicantStatus,
  deleteApplicant,
  makeOffer,
  updateOfferStatus,
  getInterviews,
  scheduleInterview,
  updateInterview,
  submitInterviewFeedback,
  deleteInterview,
  getOnboardingList,
  getOnboardingById,
  initiateOnboarding,
  updateOnboardingTask,
  addOnboardingTask,
  deleteOnboardingTask,
} = require("../controllers/recruitmentController");

router.use(protect);
router.use(tenantScope);

// Stats
router.get("/stats", getRecruitmentStats);

// Job Openings
router.get("/jobs", getJobOpenings);
router.get("/jobs/:id", getJobOpeningById);
router.post("/jobs", createJobOpening);
router.put("/jobs/:id", updateJobOpening);
router.delete("/jobs/:id", deleteJobOpening);

// Applicants
router.get("/applicants", getApplicants);
router.get("/applicants/:id", getApplicantById);
router.post("/applicants", createApplicant);
router.put("/applicants/:id", updateApplicant);
router.patch("/applicants/:id/status", updateApplicantStatus);
router.delete("/applicants/:id", deleteApplicant);

// Candidate Selection & Offer
router.post("/applicants/offer", makeOffer);
router.patch("/applicants/:id/offer", updateOfferStatus);

// Interview Stages
router.get("/interviews", getInterviews);
router.post("/interviews", scheduleInterview);
router.put("/interviews/:id", updateInterview);
router.patch("/interviews/:id/feedback", submitInterviewFeedback);
router.delete("/interviews/:id", deleteInterview);

// Employee Onboarding
router.get("/onboarding", getOnboardingList);
router.get("/onboarding/:id", getOnboardingById);
router.post("/onboarding/initiate", initiateOnboarding);
router.patch("/onboarding/:onboardingId/tasks/:taskId", updateOnboardingTask);
router.post("/onboarding/:onboardingId/tasks", addOnboardingTask);
router.delete("/onboarding/:onboardingId/tasks/:taskId", deleteOnboardingTask);

module.exports = router;
