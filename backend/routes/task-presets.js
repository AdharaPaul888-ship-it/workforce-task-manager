const router = require("express").Router();
const {
  getTaskPresets,
  createTaskPreset,
  updateTaskPreset,
  deleteTaskPreset,
  updateTaskPresetStatus,
} = require("../controllers/taskPresetController");

router.get("/", getTaskPresets);
router.post("/", createTaskPreset);
router.put("/:id", updateTaskPreset);
router.patch("/:id/status", updateTaskPresetStatus);
router.delete("/:id", deleteTaskPreset);

module.exports = router;