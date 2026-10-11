const Task = require("../models/Task");
const TimeEntry = require("../models/TimeEntry");

exports.getUserLog = async (req, res) => {
  const { userId, from, to, status, category, page } = req.query;
  let filter = { tenant: req.tenantId };
  
  // User picker: Members only see themselves, others see users in their scope
  if (userId) {
    filter.user = userId;
  } else {
    filter.user = req.user._id;
  }
  
  if (from) filter.createdAt = { $gte: new Date(from) };
  if (to) {
    if (!filter.createdAt) filter.createdAt = {};
    filter.createdAt.$lte = new Date(to);
  }
  if (status) filter.status = status;
  if (category) filter.category = category;
  
  // Pagination
  const pageNum = parseInt(page) || 1;
  const limit = 20;
  const skip = (pageNum - 1) * limit;
  
  const logs = await Task.find(filter)
    .populate("owner", "name department")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
  
  // Add hours logged column and attachments count
  const enrichedLogs = logs.map(log => ({
    ...log,
    hoursLogged: log.proofAttachments ? log.proofAttachments.length * 0.5 : 0, // simplified
    attachments: log.proofAttachments ? log.proofAttachments.length : 0,
  }));
  
  const total = await Task.countDocuments(filter);
  
  res.json({ success: true, data: enrichedLogs, total, page: pageNum, pages: Math.ceil(total / limit) });
};

exports.exportUserLogCSV = async (req, res) => {
  const { userId, from, to, status, category } = req.query;
  let filter = { tenant: req.tenantId };
  
  if (userId) filter.user = userId;
  else filter.user = req.user._id;
  
  if (from) filter.createdAt = { $gte: new Date(from) };
  if (to) {
    if (!filter.createdAt) filter.createdAt = {};
    filter.createdAt.$lte = new Date(to);
  }
  if (status) filter.status = status;
  if (category) filter.category = category;
  
  const logs = await Task.find(filter)
    .populate("owner", "name department")
    .sort({ createdAt: -1 })
    .lean();
  
  // Build CSV
  const headers = ["User", "Department", "Task Title", "Category", "Priority", "Status", "Created", "Due", "Remarks", "Attachments", "Hours Logged"];
  const rows = [headers];
  
  logs.forEach(log => {
    const userName = log.owner ? log.owner.name : "Unknown";
    const dept = log.owner ? log.owner.department : "";
    const title = log.title || "";
    const cat = log.category || "";
    const priority = log.priority || "";
    const stat = log.status || "";
    const created = log.createdAt ? log.createdAt.toISOString().split("T")[0] : "";
    const due = log.dueDate ? log.dueDate.toISOString().split("T")[0] : "";
    const remarks = log.reviewRemarks || log.description || "";
    const attachments = log.proofAttachments ? log.proofAttachments.length : 0;
    const hoursLogged = log.hoursLogged || 0;
    
    rows.push([userName, dept, title, cat, priority, stat, created, due, remarks, attachments, hoursLogged]);
  });
  
  // Set CSV download header
  res.header("Content-Type", "text/csv; charset=utf-8");
  res.header("Content-Disposition", "attachment; filename=user-log.csv");
  
  res.send(rows.map(row => row.map(field => `"${field}"`).join(",")).join("\n"));
};