const Task = require("../models/Task");
const User = require("../models/User");

exports.getTasks = async (req, res) => {
  const { scope, month, status, category, search } = req.query;
  let filter = { tenant: req.tenantId };
  
  if (scope === "mine") {
    filter.owner = req.user._id;
  } else if (scope === "team") {
    // Team scope: users in same department/team as the requester
    const user = await User.findById(req.user._id).select("department team manager");
    const userIds = [req.user._id];
    // Add team members and direct reports (simplified)
    if (user.team) {
      const teamMembers = await User.find({ team: user.team, tenant: req.tenantId }).select("_id");
      teamMembers.forEach(m => userIds.push(m._id));
    }
    filter.owner = { $in: userIds };
  }
  
  if (month) {
    const [year, monthNum] = month.split("-");
    filter.$expr = {
      $and: [
        { $eq: [{ $year: "$createdAt" }, parseInt(year)] },
        { $eq: [{ $month: "$createdAt" }, parseInt(monthNum)] }
      ]
    };
  }
  
  if (status) filter.status = status;
  if (category) filter.category = category;
  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: "i" } },
      { desc: { $regex: search, $options: "i" } }
    ];
  }
  
  const tasks = await Task.find(filter).populate("owner", "name email").lean();
  res.json({ success: true, data: tasks });
};

exports.getTask = async (req, res) => {
  const task = await Task.findById(req.params.id).populate("owner", "name email").lean();
  if (!task) return res.status(404).json({ success: false, message: "Task not found" });
  res.json({ success: true, data: task });
};

exports.createTask = async (req, res) => {
  const { title, description, desc, category, priority, dueDate, assignedTo, proofType } = req.body;
  const task = new Task({
    tenant: req.tenantId,
    title,
    desc: desc ?? description,
    category,
    priority,
    due: dueDate ? new Date(dueDate) : undefined,
    owner: req.user._id,
    status: "Draft",
    proofType,
    ...(assignedTo && { owner: assignedTo })
  });
  await task.save();
  res.json({ success: true, data: task });
};

exports.updateTask = async (req, res) => {
  const { id } = req.params;
  const { title, description, category, priority, status, dueDate } = req.body;
  const task = await Task.findById(id);
  if (!task) return res.status(404).json({ success: false, message: "Task not found" });
  
  // Users can only edit Draft/Rejected tasks
  if (task.owner.toString() !== req.user._id.toString() && req.user.role !== "Admin" && req.user.role !== "Manager") {
    return res.status(403).json({ success: false, message: "Not authorized to edit this task" });
  }
  
  if (title !== undefined) task.title = title;
  if (description !== undefined) task.desc = description;
  if (category !== undefined) task.category = category;
  if (priority !== undefined) task.priority = priority;
  if (status && (task.status === "Draft" || task.status === "Rejected")) task.status = status;
  if (dueDate) task.due = new Date(dueDate);
  
  await task.save();
  res.json({ success: true, data: task });
};

exports.deleteTask = async (req, res) => {
  const { id } = req.params;
  const task = await Task.findByIdAndDelete(id);
  if (!task) return res.status(404).json({ success: false, message: "Task not found" });
  res.json({ success: true, data: {} });
};

exports.submitTask = async (req, res) => {
  const { id } = req.params;
  const task = await Task.findById(id);
  if (!task) return res.status(404).json({ success: false, message: "Task not found" });
  
  // Only Draft tasks can be submitted
  if (task.status !== "Draft") {
    return res.status(409).json({ success: false, message: "Only Draft tasks can be submitted" });
  }
  
  // Check owner can't submit their own task for approval in some cases
  // Actually, per spec: ➤ submit: Draft only
  
  task.status = "Submitted";
  await task.save();
  res.json({ success: true, data: task });
};

exports.submitPlan = async (req, res) => {
  const { month } = req.body;
  // Get all draft tasks for the month and "submit" them
  const startDate = new Date(`${month}-01`);
  const endDate = new Date(`${month}-31`);
  
  const tasks = await Task.find({
    tenant: req.tenantId,
    owner: req.user._id,
    status: "Draft",
    createdAt: { $gte: startDate, $lte: endDate }
  }).lean();
  
  // Mark all as submitted
  await Task.updateMany({
    tenant: req.tenantId,
    owner: req.user._id,
    status: "Draft",
    createdAt: { $gte: startDate, $lte: endDate }
  }, { status: "Submitted" });
  
  res.json({ success: true, data: { submittedCount: tasks.length } });
};

exports.reviewTask = async (req, res) => {
  const { id } = req.params;
  const { action, remarks } = req.body;
  const task = await Task.findById(id);
  if (!task) return res.status(404).json({ success: false, message: "Task not found" });
  
  // Only assignee's manager or HR/Admin can review
  const user = await User.findById(task.owner);
  const isManager = user && user.manager && user.manager.toString() === req.user._id.toString();
  const isHRorAdmin = req.user.role === "HR" || req.user.role === "Admin";
  
  if (!isManager && !isHRorAdmin) {
    return res.status(403).json({ success: false, message: "Not authorized to review this task" });
  }
  
  if (action === "Approve") {
    task.status = "Approved";
  } else if (action === "Reject") {
    task.status = "Rejected";
    if (remarks) task.reviewRemarks = remarks;
    task.reviewedBy = req.user._id;
    task.reviewedAt = new Date();
  }
  
  await task.save();
  res.json({ success: true, data: task });
};

exports.updateProgress = async (req, res) => {
  const { id } = req.params;
  const { completedQuantity, progress } = req.body;
  const task = await Task.findById(id);
  if (!task) return res.status(404).json({ success: false, message: "Task not found" });
  
  // Only task owner on Approved task can update progress
  if (task.owner.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: "Not authorized to update progress" });
  }
  
  if (completedQuantity !== undefined) task.completedQuantity = completedQuantity;
  if (progress !== undefined) task.progress = Math.min(100, Math.max(0, progress));
  await task.save();
  
  res.json({ success: true, data: task });
};

exports.addProofs = async (req, res) => {
  const { id } = req.params;
  const { attachments, metadata } = req.body;
  const task = await Task.findById(id);
  if (!task) return res.status(404).json({ success: false, message: "Task not found" });
  
  // Owner can add proofs to Approved tasks
  if (task.owner.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: "Not authorized to add proofs" });
  }
  
  if (!task.proofAttachments) task.proofAttachments = [];
  task.proofAttachments.push({
    filename: attachments ? attachments.filename : "unknown",
    storedPath: attachments ? attachments.path : undefined,
    uploadedAt: new Date(),
    metadata
  });
  
  await task.save();
  res.json({ success: true, data: task });
};