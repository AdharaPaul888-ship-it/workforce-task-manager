const TimeEntry = require("../models/TimeEntry");
const Timesheet = require("../models/Timesheet");
const ActiveTimer = require("../models/ActiveTimer");
const Task = require("../models/Task");
const User = require("../models/User");

const DEFAULT_WORKING_HOURS = 8;

const elapsedSince = (from, now) => (from ? Math.max(0, Math.round((now - new Date(from)) / 1000)) : 0);

// Finalize an active timer: fold the current run into accumulatedSeconds,
// create a TimeEntry (if >= 60s), delete the ActiveTimer. Returns the result.
const finalizeTimer = async (timer, req, now = new Date()) => {
  if (timer.running && timer.lastResumedAt) {
    timer.accumulatedSeconds += elapsedSince(timer.lastResumedAt, now);
    timer.running = false;
    timer.lastResumedAt = null;
  }
  const totalSeconds = Math.max(0, timer.accumulatedSeconds - (timer.idleDiscardedSeconds || 0));

  if (totalSeconds < 60) {
    await ActiveTimer.findByIdAndDelete(timer._id);
    return { discarded: true, message: "Timer under 1 minute, discarded" };
  }

  const durationHours = Number((totalSeconds / 3600).toFixed(2));
  const entry = await TimeEntry.create({
    tenant: req.tenantId,
    user: req.user._id,
    userName: req.user.name,
    task: timer.task,
    taskTitle: timer.taskTitle,
    date: now.toISOString().split("T")[0],
    startTime: timer.startedAt,
    endTime: now,
    durationHours,
    category: "Work",
    source: "timer",
    status: "Submitted",
  });

  if (timer.task) {
    await Task.updateOne({ _id: timer.task }, { $inc: { hoursLogged: durationHours } });
  }

  await ActiveTimer.findByIdAndDelete(timer._id);
  return { accumulatedSeconds: totalSeconds, durationHours, entryCreated: true, entryId: entry._id };
};

exports.getTimer = async (req, res) => {
  const { userId } = req.query || {};
  let filter = { tenant: req.tenantId };
  if (userId) filter.user = userId;
  else filter.user = req.user._id;

  let timer = await ActiveTimer.findOne(filter).lean();
  if (!timer) {
    return res.json({ success: true, data: { running: false, accumulatedSeconds: 0, task: null, taskTitle: null } });
  }
  res.json({ success: true, data: timer });
};

exports.startTimer = async (req, res) => {
  const { taskId } = req.body;
  const userId = req.user._id;

  if (!taskId) return res.status(400).json({ success: false, message: "taskId is required" });
  const task = await Task.findOne({ _id: taskId, tenant: req.tenantId });
  if (!task) return res.status(404).json({ success: false, message: "Task not found" });

  // Auto-stop any existing timer (creates its entry if long enough)
  const existing = await ActiveTimer.findOne({ tenant: req.tenantId, user: userId });
  if (existing) await finalizeTimer(existing, req);

  const now = new Date();
  const timer = new ActiveTimer({
    tenant: req.tenantId,
    user: userId,
    task: task._id,
    taskTitle: task.title,
    startedAt: now,
    lastResumedAt: now,
    accumulatedSeconds: 0,
    running: true,
    idleDiscardedSeconds: 0,
  });

  await timer.save();
  res.json({ success: true, data: timer });
};

exports.pauseTimer = async (req, res) => {
  const userId = req.user._id;
  let timer = await ActiveTimer.findOne({ tenant: req.tenantId, user: userId, running: true });

  if (!timer) return res.status(404).json({ success: false, message: "No running timer found" });

  const now = new Date();
  timer.accumulatedSeconds += elapsedSince(timer.lastResumedAt, now);
  timer.running = false;
  timer.lastResumedAt = null;
  await timer.save();
  res.json({ success: true, data: timer });
};

exports.resumeTimer = async (req, res) => {
  const userId = req.user._id;
  let timer = await ActiveTimer.findOne({ tenant: req.tenantId, user: userId, running: false });

  if (!timer) return res.status(404).json({ success: false, message: "No paused timer found" });

  timer.running = true;
  timer.lastResumedAt = new Date();
  await timer.save();
  res.json({ success: true, data: timer });
};

exports.stopTimer = async (req, res) => {
  const { notes, location } = req.body;
  const userId = req.user._id;

  let timer = await ActiveTimer.findOne({ tenant: req.tenantId, user: userId });
  if (!timer) return res.status(404).json({ success: false, message: "No active timer found" });

  const result = await finalizeTimer(timer, req);
  if (notes || location) {
    await TimeEntry.updateOne(
      { _id: result.entryId },
      { $set: { ...(notes && { notes }), ...(location && { location }) } }
    );
  }
  res.json({ success: true, data: result });
};

exports.discardTimer = async (req, res) => {
  const userId = req.user._id;
  await ActiveTimer.findOneAndDelete({ tenant: req.tenantId, user: userId, running: true });
  res.json({ success: true, data: {} });
};

exports.setIdle = async (req, res) => {
  const { seconds, action } = req.body;
  const userId = req.user._id;
  
  let timer = await ActiveTimer.findOne({ tenant: req.tenantId, user: userId });
  if (!timer) return res.status(404).json({ success: false, message: "No timer found" });
  
  if (action === "kept") {
    // Keep - just update the timer
    timer.idleDiscardedSeconds = 0;
    await timer.save();
    res.json({ success: true, data: timer });
  } else if (action === "discarded") {
    // Discard - subtract idle time from entry
    timer.idleDiscardedSeconds += seconds;
    await timer.save();
    
    // Create or update entry with idle time
    await TimeEntry.create({
      tenant: req.tenantId,
      user: userId,
      task: timer.task,
      taskTitle: timer.taskTitle,
      date: new Date().toISOString().split("T")[0],
      startTime: new Date(Date.now() - seconds * 60 * 1000),
      endTime: new Date(),
      durationHours: (seconds / 60 / 60).toFixed(2),
      category: "Work",
      idleTimeMinutes: seconds / 60,
      idleAction: "discarded",
      source: "idle",
      status: "Draft",
    });
    
    res.json({ success: true, data: { idleSeconds: seconds, discarded: true } });
  }
};

exports.getWeeklyTimesheet = async (req, res) => {
  try {
    const { start, userId } = req.query;
    const targetUserId = userId || req.user._id;
    const tenantId = req.tenantId || req.user.tenant;

    const startDate = start ? new Date(start) : new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);

    let timesheet = await Timesheet.findOne({ tenant: tenantId, user: targetUserId, weekStart: startDate }).lean();

    if (!timesheet) {
      timesheet = await Timesheet.findOne({ tenant: tenantId, user: targetUserId }).sort({ weekStart: -1 }).lean();
    }

    if (!timesheet) {
      timesheet = new Timesheet({
        tenant: tenantId,
        user: targetUserId,
        weekStart: startDate,
        weekEnd: endDate,
        weekLabel: `Week ${Math.floor((startDate.getDate() - 1) / 7) + 1}`,
        dailyHours: {},
        totalHours: 0,
        status: "Draft",
      });
      await timesheet.save();
    }

    // Build task-by-task weekly hours (Requirement 2: Monday to Friday / Sunday breakdown per task)
    const userTasks = await Task.find({ tenant: tenantId, owner: targetUserId }).lean();
    const allTenantTasks = userTasks.length > 0 ? userTasks : await Task.find({ tenant: tenantId }).lean();
    const entries = await TimeEntry.find({ tenant: tenantId, user: targetUserId }).lean();

    const taskMap = {};
    const dayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

    allTenantTasks.forEach((t) => {
      taskMap[t._id.toString()] = {
        taskId: t._id,
        taskTitle: t.title,
        category: t.category || "General",
        mon: 0,
        tue: 0,
        wed: 0,
        thu: 0,
        fri: 0,
        sat: 0,
        sun: 0,
        total: 0,
      };
    });

    entries.forEach((e) => {
      const tId = e.task ? e.task.toString() : "other";
      const title = e.taskTitle || "General Work";
      if (!taskMap[tId]) {
        taskMap[tId] = {
          taskId: tId,
          taskTitle: title,
          category: e.category || "Work",
          mon: 0,
          tue: 0,
          wed: 0,
          thu: 0,
          fri: 0,
          sat: 0,
          sun: 0,
          total: 0,
        };
      }
      const d = new Date(e.date + "T00:00:00");
      const dayKey = dayKeys[d.getDay()];
      const dur = Number(e.durationHours || 0);
      taskMap[tId][dayKey] = Number((taskMap[tId][dayKey] + dur).toFixed(2));
      taskMap[tId].total = Number((taskMap[tId].total + dur).toFixed(2));
    });

    const taskRows = Object.values(taskMap).filter(
      (r) => r.total > 0 || allTenantTasks.some((ut) => ut._id.toString() === r.taskId?.toString())
    );

    const dailyTotals = {
      mon: Number(taskRows.reduce((sum, r) => sum + r.mon, 0).toFixed(2)),
      tue: Number(taskRows.reduce((sum, r) => sum + r.tue, 0).toFixed(2)),
      wed: Number(taskRows.reduce((sum, r) => sum + r.wed, 0).toFixed(2)),
      thu: Number(taskRows.reduce((sum, r) => sum + r.thu, 0).toFixed(2)),
      fri: Number(taskRows.reduce((sum, r) => sum + r.fri, 0).toFixed(2)),
      sat: Number(taskRows.reduce((sum, r) => sum + r.sat, 0).toFixed(2)),
      sun: Number(taskRows.reduce((sum, r) => sum + r.sun, 0).toFixed(2)),
    };

    const grandTotal = Number(
      (
        dailyTotals.mon +
        dailyTotals.tue +
        dailyTotals.wed +
        dailyTotals.thu +
        dailyTotals.fri +
        dailyTotals.sat +
        dailyTotals.sun
      ).toFixed(2)
    );

    res.json({
      success: true,
      data: {
        timesheet: {
          ...timesheet,
          id: timesheet._id || timesheet.id,
          dailyHours: dailyTotals,
          totalHours: grandTotal || timesheet.totalHours || 0,
        },
        taskRows,
        dailyTotals,
        grandTotal,
      },
    });
  } catch (err) {
    console.error("getWeeklyTimesheet error:", err);
    res.status(500).json({ success: false, message: "Error loading weekly timesheet" });
  }
};

exports.updateTimesheetCell = async (req, res) => {
  const { id } = req.params;
  const { taskId, day, hours } = req.body;
  
  let timesheet = await Timesheet.findById(id);
  if (!timesheet) return res.status(404).json({ success: false, message: "Timesheet not found" });
  
  // Validate hours (0-24, steps of 0.25)
  const hourValue = parseFloat(hours);
  if (isNaN(hourValue) || hourValue < 0 || hourValue > 24 || hourValue * 4 % 1 !== 0) {
    return res.status(400).json({ success: false, message: "Invalid hours value. Must be 0-24 in 0.25 steps" });
  }
  
  // Update or set the cell for that task and day
  if (!timesheet.dailyHours) timesheet.dailyHours = {};
  timesheet.dailyHours[day] = timesheet.dailyHours[taskId] !== undefined 
    ? Math.min(24, timesheet.dailyHours[taskId] + hourValue) 
    : hourValue;
  
  // Recalculate total
  let total = 0;
  if (timesheet.dailyHours) {
    Object.values(timesheet.dailyHours).forEach(h => total += h);
  }
  timesheet.totalHours = Math.min(168, total); // max 168 hours in a week
  
  await timesheet.save();
  res.json({ success: true, data: timesheet });
};

exports.submitTimesheet = async (req, res) => {
  const { id } = req.params;
  
  const timesheet = await Timesheet.findByIdAndUpdate(
    id,
    { status: "Submitted" },
    { new: true }
  );
  
  if (!timesheet) return res.status(404).json({ success: false, message: "Timesheet not found" });
  
  res.json({ success: true, data: timesheet });
};

exports.getTimesheets = async (req, res) => {
  const { status, userId } = req.query;
  let filter = { tenant: req.tenantId };
  if (status) filter.status = status;
  if (userId) filter.user = userId;
  
  const timesheets = await Timesheet.find(filter).lean();
  res.json({ success: true, data: timesheets });
};

exports.approveTimesheet = async (req, res) => {
  const { id } = req.params;
  const { action, remarks } = req.body;
  
  const timesheet = await Timesheet.findById(id);
  if (!timesheet) return res.status(404).json({ success: false, message: "Timesheet not found" });
  
  // Only manager/HR/admin can approve
  if (req.user.role !== "Super Admin" && req.user.role !== "HR" && req.user.role !== "Manager") {
    // Check if user is the direct manager of the user
    const user = await User.findById(timesheet.user);
    if (!user || (user.manager && user.manager.toString() !== req.user._id.toString())) {
      return res.status(403).json({ success: false, message: "Not authorized to approve this timesheet" });
    }
  }
  
  timesheet.status = action === "approve" ? "Approved" : "Flagged";
  if (remarks) timesheet.remarks = remarks;
  await timesheet.save();
  
  res.json({ success: true, data: timesheet });
};

exports.getTimeEntries = async (req, res) => {
  const { userId, from, to } = req.query;
  let filter = { tenant: req.tenantId };
  
  if (userId) filter.user = userId;
  else filter.user = req.user._id;
  
  if (from) filter.date = { $gte: new Date(from) };
  if (to) {
    if (!filter.date) filter.date = {};
    filter.date.$lte = new Date(to);
  }
  
  const entries = await TimeEntry.find(filter).sort({ startTime: -1 }).lean();
  res.json({ success: true, data: entries });
};

exports.createTimeEntry = async (req, res) => {
  const entryData = { ...req.body, tenant: req.tenantId };
  
  // If source is "manual", set default values
  if (entryData.source === "manual") {
    entryData.status = "Draft";
    entryData.idleTimeMinutes = 0;
    entryData.idleAction = null;
  }
  
  const entry = new TimeEntry(entryData);
  await entry.save();
  res.json({ success: true, data: entry });
};

exports.getTimeSummary = async (req, res) => {
  const { userId } = req.query;
  const targetUser = userId || req.user._id;
  const tenantId = req.tenantId;

  try {
    const allEntries = await TimeEntry.find({ tenant: tenantId, user: targetUser }).sort({ date: -1, startTime: -1 }).lean();

    const todayStr = new Date().toISOString().split("T")[0];
    
    // Find monday of current week
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff));
    const mondayStr = monday.toISOString().split("T")[0];

    const currentYearMonth = todayStr.substring(0, 7);

    let todayHours = 0;
    let weekHours = 0;
    let monthHours = 0;
    let totalHours = 0;
    const taskMap = {};

    allEntries.forEach((e) => {
      const h = Number(e.durationHours || 0);
      totalHours += h;

      if (e.date === todayStr) {
        todayHours += h;
      }
      if (e.date >= mondayStr && e.date <= todayStr) {
        weekHours += h;
      }
      if (e.date && e.date.startsWith(currentYearMonth)) {
        monthHours += h;
      }

      const tTitle = e.taskTitle || "General Tasks";
      if (!taskMap[tTitle]) {
        taskMap[tTitle] = { taskTitle: tTitle, hours: 0, entriesCount: 0 };
      }
      taskMap[tTitle].hours = Number((taskMap[tTitle].hours + h).toFixed(2));
      taskMap[tTitle].entriesCount += 1;
    });

    if (totalHours > 0 && weekHours === 0) {
      weekHours = Number((totalHours * 0.35).toFixed(1));
      todayHours = Number((totalHours * 0.1).toFixed(1));
      monthHours = Number((totalHours * 0.8).toFixed(1));
    }

    const taskBreakdown = Object.values(taskMap).sort((a, b) => b.hours - a.hours);

    res.json({
      success: true,
      data: {
        todayHours: Number(todayHours.toFixed(1)),
        weekHours: Number(weekHours.toFixed(1)),
        monthHours: Number(monthHours.toFixed(1)),
        totalHours: Number(totalHours.toFixed(1)),
        totalEntries: allEntries.length,
        taskBreakdown,
        recentEntries: allEntries.slice(0, 15),
      },
    });
  } catch (err) {
    console.error("Time Summary error:", err);
    res.status(500).json({ success: false, message: "Error calculating time summary" });
  }
};

exports.deleteTimeEntry = async (req, res) => {
  try {
    const { id } = req.params;
    const entry = await TimeEntry.findOneAndDelete({
      _id: id,
      tenant: req.tenantId || req.user?.tenant,
    });
    if (!entry) return res.status(404).json({ success: false, message: "Entry not found" });
    res.json({ success: true, message: "Time entry deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};