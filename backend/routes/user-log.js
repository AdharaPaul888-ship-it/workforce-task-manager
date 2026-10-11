const router = require("express").Router();
const {
  getUserLog,
  exportUserLogCSV,
} = require("../controllers/userLogController");

router.get("/user-log", getUserLog);
router.get("/user-log/export", exportUserLogCSV);

module.exports = router;