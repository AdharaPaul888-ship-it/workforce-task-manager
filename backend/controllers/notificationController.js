const Notification = require("../models/Notification");

exports.getNotifications = async (req, res) => {
  const { page } = req.query;
  const pageNum = parseInt(page) || 1;
  const limit = 20;
  const skip = (pageNum - 1) * limit;
  
  const filter = { tenant: req.tenantId };
  
  const notifications = await Notification.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
    
  const total = await Notification.countDocuments(filter);
  
  res.json({ success: true, data: notifications, total, page: pageNum, pages: Math.ceil(total / limit) });
};

exports.markNotificationRead = async (req, res) => {
  const { id } = req.params;
  
  await Notification.findByIdAndUpdate(id, { $addToSet: { readBy: req.user._id } });
  
  res.json({ success: true, data: {} });
};