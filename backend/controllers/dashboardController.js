const User = require("../models/User");
const Task = require("../models/Task");
const TimeEntry = require("../models/TimeEntry");
const LeaveRequest = require("../models/LeaveRequest");
const LeaveBalance = require("../models/LeaveBalance");
const ActiveTimer = require("../models/ActiveTimer");
const Setting = require("../models/Setting");

exports.getDashboardStats = async (req, res) => {
  const { view } = req.query;
  const tenantId = req.tenantId;
  
  let stats;
  
  if (view === "my") {
    // My stats - user's own data
    const userId = req.user._id;
    
    // Get own tasks
    const ownTasks = await Task.countDocuments({ tenant: tenantId, owner: userId });
    const submittedTasks = await Task.countDocuments({ tenant: tenantId, owner: userId, status: "Submitted" });
    const approvedTasks = await Task.countDocuments({ tenant: tenantId, owner: userId, status: "Approved" });
    
    // Get own time entries this week
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    const ownEntries = await TimeEntry.countDocuments({
      tenant: tenantId,
      user: userId,
      date: { $gte: weekStart, $lte: weekEnd },
    });
    
    // Get own leave balance
    const balance = await LeaveBalance.findOne({ tenant: tenantId, user: userId, year: new Date().getFullYear() }).lean();
    const setting = await Setting.findOne({ tenant: tenantId }).lean();
    const DEFAULT_WORKING_HOURS = setting ? setting.defaultWorkingHours || 8 : 8;

    stats = {
      hoursLogged: ownEntries > 0 ? 8.5 : 0, // simplified
      targetHours: DEFAULT_WORKING_HOURS * 5,
      fulfillment: ownEntries > 0 ? Math.round((ownEntries / (DEFAULT_WORKING_HOURS * 5)) * 100) : 0,
      taskProgress: approvedTasks > 0 ? Math.round((submittedTasks / approvedTasks) * 100) : 0,
      netSalary: balance ? balance.netSalary || 15000 : 15000,
      todayFocus: "Task 1, Task 2, Task 3, Task 4", // simplified
    };
  } else if (view === "team") {
    // Team stats - all users in scope
    const scopeUsers = await getUsersInScope(req);
    
    const totalWorkforce = scopeUsers.length;
    const activeTimers = await ActiveTimer.countDocuments({ tenant: tenantId, running: true });
    const submittedTimesheets = await TimeEntry.countDocuments({ tenant: tenantId });
    
    // Get approved leaves today
    const today = new Date();
    const approvedLeaves = await LeaveRequest.countDocuments({
      tenant: tenantId,
      status: "Approved",
      startDate: { $lte: today },
      endDate: { $gte: today },
    });
    
    stats = {
      totalWorkforce,
      currentlyClockedIn: activeTimers,
      onLeave: approvedLeaves,
      pendingApprovals: "N Items · a leaves + b timesheets + c tasks",
      memberTracker: [], // will be populated per user
    };
  } else {
    return res.status(400).json({ success: false, message: "Invalid view parameter. Use 'my' or 'team'." });
  }
  
  res.json({ success: true, data: stats });
};

exports.getMemberDetail = async (req, res) => {
  const { userId } = req.params;
  
  const user = await User.findById(userId)
    .populate("department", "name")
    .populate("team", "name")
    .lean();
  
  if (!user) return res.status(404).json({ success: false, message: "User not found" });
  
  // Get own tasks for this user
  const tasks = await Task.find({ tenant: req.tenantId, owner: userId })
    .select("title status progress dueDate category")
    .lean();
  
  // Get time entries
  const entries = await TimeEntry.find({ tenant: req.tenantId, user: userId })
    .sort({ startTime: -1 })
    .limit(10)
    .lean();
  
  // Get leave balance
  const balance = await LeaveBalance.findOne({ tenant: req.tenantId, user: userId, year: new Date().getFullYear() }).lean();
  
  const detail = {
    ...user,
    tasks,
    entries,
    leaveBalance: balance || { casualTotal: 10, casualUsed: 0, sickTotal: 7, sickUsed: 0, annualTotal: 15, annualUsed: 0 },
  };
  
  res.json({ success: true, data: detail });
};

const getUsersInScope = async (req) => {
  // Simplified: return all users in the tenant
  return await User.find({ tenant: req.tenantId }).select("_id name role department team").lean();
};