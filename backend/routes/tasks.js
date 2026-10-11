const router = require("express").Router();
const {
  getTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  submitTask,
  submitPlan,
  reviewTask,
  updateProgress,
  addProofs,
} = require("../controllers/taskController");

router.get("/", getTasks);
router.get("/:id", getTask);
router.post("/", createTask);
router.put("/:id", updateTask);
router.delete("/:id", deleteTask);
router.post("/:id/submit", submitTask);
router.post("/submit-plan", submitPlan);
router.put("/:id/review", reviewTask);
router.patch("/:id/progress", updateProgress);
router.post("/:id/proofs", addProofs);

module.exports = router;