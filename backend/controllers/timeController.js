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
  const { start, userId } = req.query;
  let filter = { tenant: req.tenantId };
  if (userId) filter.user = userId;
  
  const startDate = start ? new Date(start) : new Date();
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6);
  
  let timesheet = await Timesheet.findOne({ tenant: req.tenantId, user: filter.user, weekStart: startDate }).lean();
  
  if (!timesheet) {
    // Create default timesheet for the week
    timesheet = new Timesheet({
      tenant: req.tenantId,
      user: filter.user,
      weekStart: startDate,
      weekEnd: endDate,
      weekLabel: `Week ${Math.floor((startDate.getDate() - 1) / 7) + 1}`,
      dailyHours: {},
      totalHours: 0,
      status: "Draft",
    });
    await timesheet.save();
  }
  
  res.json({ success: true, data: timesheet });
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