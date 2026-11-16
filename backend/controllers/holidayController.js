const Holiday = require("../models/Holiday");
const User = require("../models/User");
const LeaveRequest = require("../models/LeaveRequest");
const LeaveBalance = require("../models/LeaveBalance");
const { workingDaysBetween } = require("../utils/dates");

exports.getHolidays = async (req, res) => {
  const { year } = req.query;
  const filter = { tenant: req.tenantId };
  if (year) {
    const startOfYear = new Date(`${year}-01-01`);
    const endOfYear = new Date(`${year}-12-31`);
    filter.date = { $gte: startOfYear, $lte: endOfYear };
  }
  const holidays = await Holiday.find(filter).lean();
  res.json({ success: true, data: holidays });
};

exports.createHoliday = async (req, res) => {
  const { title, date, type, description } = req.body;
  const d = new Date(date);
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const holiday = new Holiday({
    tenant: req.tenantId,
    title,
    date: d,
    type: type || "National",
    description,
    day: dayNames[d.getDay()],
  });
  await holiday.save();
  res.json({ success: true, data: holiday });
};

exports.updateHoliday = async (req, res) => {
  const { id } = req.params;
  const { title, date, type, description } = req.body;
  const holiday = await Holiday.findById(id);
  if (!holiday) return res.status(404).json({ success: false, message: "Holiday not found" });
  if (title !== undefined) holiday.title = title;
  if (date !== undefined) holiday.date = new Date(date);
  if (type !== undefined) holiday.type = type;
  if (description !== undefined) holiday.description = description;
  await holiday.save();
  res.json({ success: true, data: holiday });
};

exports.deleteHoliday = async (req, res) => {
  const { id } = req.params;
  const holiday = await Holiday.findByIdAndDelete(id);
  if (!holiday) return res.status(404).json({ success: false, message: "Holiday not found" });
  res.json({ success: true, data: {} });
};

exports.getLeaveRequests = async (req, res) => {
  const { scope, status, year } = req.query;
  let filter = { tenant: req.tenantId };
  if (scope === "mine") {
    filter.user = req.user._id;
  } else if (scope === "pending") {
    filter.status = { $in: ["Pending Manager", "Pending HR"] };
    // If user is a Manager (not Admin or HR), restrict to only their reporting team members
    if (req.user.role === "Manager") {
      const reportingUsers = await User.find({ tenant: req.tenantId, manager: req.user._id }).distinct("_id");
      filter.user = { $in: reportingUsers };
    }
  }
  if (status) filter.status = status;
  if (year) {
    const startOfYear = new Date(`${year}-01-01`);
    const endOfYear = new Date(`${year}-12-31`);
    filter.startDate = { $gte: startOfYear, $lte: endOfYear };
  }
  const leaves = await LeaveRequest.find(filter)
    .populate("user", "name email role")
    .sort({ createdAt: -1 })
    .lean();
  res.json({ success: true, data: leaves });
};

exports.createLeaveRequest = async (req, res) => {
  const { type, startDate, endDate, halfDay, reason, certificate } = req.body;
  const user = req.user;
  const leaveYear = new Date(startDate).getFullYear();
  
  // Get leave balance or create if not present
  let balance = await LeaveBalance.findOne({ user: user._id, tenant: user.tenant, year: leaveYear });
  if (!balance) {
    balance = await LeaveBalance.create({
      tenant: user.tenant,
      user: user._id,
      year: leaveYear,
      casualTotal: 10,
      casualUsed: 0,
      sickTotal: 7,
      sickUsed: 0,
      annualTotal: 15,
      annualUsed: 0,
    });
  }
  
  // Calculate working days
  const workingDays = workingDaysBetween(new Date(startDate), new Date(endDate), user.tenant);
  let days = workingDays.filter((w) => !w.isHoliday).length;
  if (halfDay) days = 0.5;
  else if (days === 0) days = 1;
  
  // Check balance
  if (type === "Sick" && balance.sickUsed + days > balance.sickTotal && !halfDay) {
    return res.status(400).json({ success: false, message: "Insufficient sick leave balance" });
  }
  if (type === "Casual" && balance.casualUsed + days > balance.casualTotal) {
    return res.status(400).json({ success: false, message: "Insufficient casual leave balance" });
  }
  if (type === "Annual" && balance.annualUsed + days > balance.annualTotal) {
    return res.status(400).json({ success: false, message: "Insufficient annual leave balance" });
  }
  
  // Check for overlap with own pending/approved leave
  const overlapping = await LeaveRequest.findOne({
    tenant: user.tenant,
    user: user._id,
    status: { $in: ["Approved", "Pending Manager", "Pending HR"] },
    $or: [
      { startDate: { $lte: new Date(endDate) }, endDate: { $gte: new Date(startDate) } },
    ],
  });
  if (overlapping) return res.status(400).json({ success: false, message: "Overlaps with another leave request" });
  
  const leaveRequest = new LeaveRequest({
    tenant: user.tenant,
    user: user._id,
    applicantName: user.name,
    type,
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    days,
    duration: `${days} working day${days > 1 ? "s" : ""}`,
    reason,
    certificateAttachment: certificate,
    status: user.manager ? "Pending Manager" : "Pending HR",
  });
  
  await leaveRequest.save();
  res.json({ success: true, data: leaveRequest });
};

exports.updateLeaveStatus = async (req, res) => {
  const { id } = req.params;
  const { status, remarks } = req.body;
  const leave = await LeaveRequest.findById(id);
  if (!leave) return res.status(404).json({ success: false, message: "Leave request not found" });
  
  // Only manager/HR/admin can approve
  if (req.user.role !== "Super Admin" && req.user._id.toString() !== leave.user.toString() && req.user.role !== "HR" && req.user.role !== "Admin") {
    const user = await User.findById(leave.user);
    if (!user || !user.manager || user.manager.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized to approve this leave" });
    }
  }
  
  leave.status = status;
  if (remarks) leave.remarks = remarks;
  if (status === "Approved") {
    leave.approvedBy = req.user._id;
    leave.approvedByName = req.user.name;
  }
  await leave.save();
  
  // If approved, deduct from balance
  if (status === "Approved") {
    let balance = await LeaveBalance.findOne({ user: leave.user, tenant: leave.tenant, year: new Date(leave.startDate).getFullYear() });
    if (balance) {
      const days = leave.days || 1;
      if (leave.type === "Sick") balance.sickUsed = Math.min(balance.sickTotal, balance.sickUsed + days);
      if (leave.type === "Casual") balance.casualUsed = Math.min(balance.casualTotal, balance.casualUsed + days);
      if (leave.type === "Annual") balance.annualUsed = Math.min(balance.annualTotal, balance.annualUsed + days);
      await balance.save();
    }
  }
  
  res.json({ success: true, data: leave });
};

exports.deleteLeave = async (req, res) => {
  const { id } = req.params;
  const leave = await LeaveRequest.findById(id);
  if (!leave) return res.status(404).json({ success: false, message: "Leave request not found" });
  if (req.user.role !== "Super Admin" && req.user.role !== "Admin" && req.user.role !== "HR" && leave.user.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: "Not authorized to delete this leave" });
  }
  await LeaveRequest.findByIdAndDelete(id);
  res.json({ success: true, data: {} });
};

exports.getLeaveBalance = async (req, res) => {
  const { userId } = req.query;
  const filter = { tenant: req.tenantId };
  if (userId) filter.user = userId;
  else filter.user = req.user._id;
  
  const year = new Date().getFullYear();
  let balance = await LeaveBalance.findOne({ user: filter.user, tenant: req.tenantId, year }).lean();
  
  if (!balance) {
    const newBalance = new LeaveBalance({
      tenant: req.tenantId,
      user: filter.user,
      year,
      casualTotal: 10,
      casualUsed: 0,
      sickTotal: 7,
      sickUsed: 0,
      annualTotal: 15,
      annualUsed: 0,
      unpaidUsed: 0,
    });
    await newBalance.save();
    balance = newBalance.toObject();
  }
  res.json({ success: true, data: balance });
};

exports.previewLeave = async (req, res) => {
  const { type, startDate, endDate, halfDay } = req.body;
  const user = req.user;
  const year = new Date(startDate).getFullYear();
  
  let balance = await LeaveBalance.findOne({ user: user._id, tenant: user.tenant, year });
  if (!balance) {
    balance = await LeaveBalance.create({
      tenant: user.tenant,
      user: user._id,
      year,
      casualTotal: 10,
      casualUsed: 0,
      sickTotal: 7,
      sickUsed: 0,
      annualTotal: 15,
      annualUsed: 0,
    });
  }
  
  const workingDays = workingDaysBetween(new Date(startDate), new Date(endDate), user.tenant);
  let days = workingDays.filter((w) => !w.isHoliday).length;
  if (halfDay) days = 0.5;
  else if (days === 0) days = 1;
  
  let remaining = 0;
  if (type === "Sick") {
    remaining = Math.max(0, balance.sickTotal - balance.sickUsed - days);
  } else if (type === "Casual") {
    remaining = Math.max(0, balance.casualTotal - balance.casualUsed - days);
  } else if (type === "Annual") {
    remaining = Math.max(0, balance.annualTotal - balance.annualUsed - days);
  }
  
  const hasCertificate = type === "Sick" && days > 1;
  
  res.json({ success: true, data: { days, remaining, hasCertificate } });
};