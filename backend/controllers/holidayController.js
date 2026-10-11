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
  const holiday = new Holiday({
    tenant: req.tenantId,
    title,
    date: new Date(date),
    type,
    description,
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
  if (scope === "mine") filter.user = req.user._id;
  else if (scope === "pending") filter.status = "Pending Manager";
  if (status) filter.status = status;
  if (year) {
    const startOfYear = new Date(`${year}-01-01`);
    const endOfYear = new Date(`${year}-12-31`);
    filter.startDate = { $gte: startOfYear, $lte: endOfYear };
  }
  const leaves = await LeaveRequest.find(filter).populate("user", "name email role").lean();
  res.json({ success: true, data: leaves });
};

exports.createLeaveRequest = async (req, res) => {
  const { type, startDate, endDate, halfDay, reason, certificate } = req.body;
  const user = req.user;
  
  // Get leave balance
  const balance = await LeaveBalance.findOne({ user: user._id, tenant: user.tenant, year: new Date(startDate).getFullYear() });
  if (!balance) return res.status(400).json({ success: false, message: "Leave balance not found for this year" });
  
  // Calculate working days
  const workingDays = workingDaysBetween(new Date(startDate), new Date(endDate), user.tenant);
  const days = workingDays.filter((w) => !w.isHoliday).length;
  
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
    status: "Approved",
    $or: [
      { startDate: { $lte: endDate }, endDate: { $gte: startDate } },
    ],
  });
  if (overlapping) return res.status(400).json({ success: false, message: "Overlaps with your own approved leave" });
  
  const leaveRequest = new LeaveRequest({
    tenant: user.tenant,
    user: user._id,
    applicantName: user.name,
    type,
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    days,
    duration: days + " working days",
    reason,
    certificate,
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
    // Check if user is the manager
    const user = await User.findById(leave.user);
    if (!user || user.manager.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized to approve this leave" });
    }
  }
  
  leave.status = status;
  if (remarks) leave.remarks = remarks;
  await leave.save();
  
  // If approved, deduct from balance
  if (status === "Approved") {
    const balance = await LeaveBalance.findOne({ user: leave.user, tenant: leave.tenant, year: new Date(leave.startDate).getFullYear() });
    if (balance) {
      const days = leave.days;
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
  const leave = await LeaveRequest.findByIdAndDelete(id);
  if (!leave) return res.status(404).json({ success: false, message: "Leave request not found" });
  res.json({ success: true, data: {} });
};

exports.getLeaveBalance = async (req, res) => {
  const { userId } = req.query;
  const filter = { tenant: req.tenantId };
  if (userId) filter.user = userId;
  else filter.user = req.user._id;
  
  const year = new Date().getFullYear();
  const balance = await LeaveBalance.findOne({ user: filter.user, tenant: req.tenantId, year }).lean();
  
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
    res.json({ success: true, data: newBalance });
  } else {
    res.json({ success: true, data: balance });
  }
};

exports.previewLeave = async (req, res) => {
  const { type, startDate, endDate, halfDay } = req.body;
  const user = req.user;
  
  // Get current balance
  const balance = await LeaveBalance.findOne({ user: user._id, tenant: user.tenant, year: new Date(startDate).getFullYear() });
  if (!balance) return res.status(404).json({ success: false, message: "Leave balance not found" });
  
  // Calculate working days
  const workingDays = workingDaysBetween(new Date(startDate), new Date(endDate), user.tenant);
  const days = workingDays.filter((w) => !w.isHoliday).length;
  
  let remaining;
  if (type === "Sick") {
    remaining = balance.sickTotal - balance.sickUsed - days;
  } else if (type === "Casual") {
    remaining = balance.casualTotal - balance.casualUsed - days;
  } else {
    remaining = balance.annualTotal - balance.annualUsed - days;
  }
  
  const hasCertificate = type === "Sick" && days > 1; // simplified: after 1 day as per settings
  
  res.json({ success: true, data: { days, remaining, hasCertificate } });
};