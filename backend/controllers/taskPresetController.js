const TaskPreset = require("../models/TaskPreset");

exports.getTaskPresets = async (req, res) => {
  const { status, category } = req.query;
  let query = { tenant: req.tenantId };
  if (status) query.status = status;
  if (category) query.category = category;
  const presets = await TaskPreset.find(query).lean();
  res.json({ success: true, data: presets });
};

exports.createTaskPreset = async (req, res) => {
  const { name, category, frequency, defaultTarget, allowedRoles, proofType } = req.body;
  const preset = new TaskPreset({
    tenant: req.tenantId,
    name,
    category,
    frequency,
    defaultTarget: defaultTarget || 1,
    allowedRoles: allowedRoles || [],
    proofType,
    status: "Published",
  });
  await preset.save();
  res.json({ success: true, data: preset });
};

exports.updateTaskPreset = async (req, res) => {
  const { id } = req.params;
  const { name, category, frequency, defaultTarget, allowedRoles, proofType } = req.body;
  const preset = await TaskPreset.findById(id);
  if (!preset) return res.status(404).json({ success: false, message: "Preset not found" });
  if (name !== undefined) preset.name = name;
  if (category !== undefined) preset.category = category;
  if (frequency !== undefined) preset.frequency = frequency;
  if (defaultTarget !== undefined) preset.defaultTarget = defaultTarget;
  if (allowedRoles !== undefined) preset.allowedRoles = allowedRoles;
  if (proofType !== undefined) preset.proofType = proofType;
  await preset.save();
  res.json({ success: true, data: preset });
};

exports.deleteTaskPreset = async (req, res) => {
  const { id } = req.params;
  const preset = await TaskPreset.findById(id);
  if (!preset) return res.status(404).json({ success: false, message: "Preset not found" });
  // If tasks already use this preset, archive it instead of deleting
  const usedByTasks = await Task.countDocuments({ preset: id, tenant: req.tenantId });
  if (usedByTasks > 0) {
    preset.status = "Archived";
    await preset.save();
    return res.json({ success: true, data: preset, message: "Preset archived (tasks using it become Draft)" });
  }
  await TaskPreset.findByIdAndDelete(id);
  res.json({ success: true, data: {} });
};

exports.updateTaskPresetStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const preset = await TaskPreset.findById(id);
  if (!preset) return res.status(404).json({ success: false, message: "Preset not found" });
  preset.status = status;
  await preset.save();
  res.json({ success: true, data: preset });
};