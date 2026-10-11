const Attendance = require("../models/Attendance");

// @desc    Get attendance records (with filters)
// @route   GET /api/attendance
exports.getAttendanceRecords = async (req, res) => {
  try {
    const { date, userId, status, from, to } = req.query;
    const query = { tenant: req.user.tenant };

    if (userId) query.user = userId;
    if (status) query.status = status;
    if (date) query.date = date;
    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = from;
      if (to) query.date.$lte = to;
    }

    const records = await Attendance.find(query)
      .populate("user", "name email department role empCode")
      .sort({ date: -1, createdAt: -1 })
      .limit(100);

    res.status(200).json({ success: true, count: records.length, data: records });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get today's attendance status for logged-in user
// @route   GET /api/attendance/today
exports.getTodayStatus = async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split("T")[0];
    const record = await Attendance.findOne({
      tenant: req.user.tenant,
      user: req.user.id,
      date: todayStr,
    });

    res.status(200).json({
      success: true,
      data: record || null,
      today: todayStr,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Check-in (Clock in)
// @route   POST /api/attendance/check-in
exports.checkIn = async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split("T")[0];
    let record = await Attendance.findOne({
      tenant: req.user.tenant,
      user: req.user.id,
      date: todayStr,
    });

    if (record && record.clockIn) {
      return res.status(400).json({ success: false, message: "Already checked in today" });
    }

    const now = new Date();
    // Mark as late if checked in after 9:30 AM
    const isLate = now.getHours() > 9 || (now.getHours() === 9 && now.getMinutes() > 30);

    if (!record) {
      record = new Attendance({
        tenant: req.user.tenant,
        user: req.user.id,
        userName: req.user.name,
        date: todayStr,
        clockIn: now,
        status: isLate ? "Late" : "Present",
        location: req.body.location || "Office",
        note: req.body.note || "",
      });
    } else {
      record.clockIn = now;
      record.status = isLate ? "Late" : "Present";
    }

    await record.save();
    res.status(200).json({ success: true, message: "Checked in successfully", data: record });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Check-out (Clock out)
// @route   POST /api/attendance/check-out
exports.checkOut = async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split("T")[0];
    const record = await Attendance.findOne({
      tenant: req.user.tenant,
      user: req.user.id,
      date: todayStr,
    });

    if (!record || !record.clockIn) {
      return res.status(400).json({ success: false, message: "Please check in first before checking out" });
    }

    const now = new Date();
    record.clockOut = now;
    const diffMs = now.getTime() - new Date(record.clockIn).getTime();
    record.durationMinutes = Math.round(diffMs / (1000 * 60));

    await record.save();
    res.status(200).json({ success: true, message: "Checked out successfully", data: record });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get monthly attendance report
// @route   GET /api/attendance/monthly-report
exports.getMonthlyReport = async (req, res) => {
  try {
    const { month, year } = req.query;
    const currentYear = year || new Date().getFullYear();
    const currentMonth = month ? String(month).padStart(2, "0") : String(new Date().getMonth() + 1).padStart(2, "0");
    const prefix = `${currentYear}-${currentMonth}`;

    const records = await Attendance.find({
      tenant: req.user.tenant,
      date: { $regex: `^${prefix}` },
    }).populate("user", "name email department role");

    const summary = {
      totalRecords: records.length,
      present: records.filter((r) => r.status === "Present").length,
      late: records.filter((r) => r.status === "Late").length,
      absent: records.filter((r) => r.status === "Absent").length,
      leave: records.filter((r) => r.status === "Leave").length,
      halfDay: records.filter((r) => r.status === "Half-Day").length,
    };

    res.status(200).json({
      success: true,
      period: prefix,
      summary,
      data: records,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
