const router = require("express").Router();
const {
  getNotifications,
  markNotificationRead,
} = require("../controllers/notificationController");

router.get("/", getNotifications);
router.put("/:id/read", markNotificationRead);

module.exports = router;