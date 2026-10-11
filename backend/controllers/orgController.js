const Tenant = require("../models/Tenant");
const User = require("../models/User");
const Department = require("../models/Department");
const Team = require("../models/Team");
const Member = require("../models/Member");
const Role = require("../models/Role");

exports.getOrgTree = async (req, res) => {
  const Tenant = require("../models/Tenant");
  const tenant = await Tenant.findById(req.tenantId).lean();
  const result = [];
  if (tenant) {
    const depts = await Department.find({ tenant: tenant._id })
      .populate("teams.lead")
      .populate("teams.members")
      .lean();
    const deptResults = depts.map((dept) => {
      const teams = dept.teams.map((team) => ({
        _id: team._id,
        name: team.name,
        lead: team.lead ? {
          _id: team.lead._id,
          name: team.lead.name,
          email: team.lead.email,
          role: team.lead.role,
        } : null,
        members: team.members.map((m) => ({
          _id: m._id,
          name: m.name,
          email: m.email,
          role: m.role,
          roleScope: m.roleScope,
          manager: m.manager ? { _id: m.manager._id, name: m.manager.name } : null,
        })),
      }));
      return {
        _id: dept._id,
        name: dept.name,
        code: dept.code,
        budget: dept.budget,
        teams,
      };
    });
    result.push({ tenant: { _id: tenant._id, name: tenant.name, code: tenant.code }, departments: deptResults });
  }
  res.json({ success: true, data: result });
};

exports.createDepartment = async (req, res) => {
  const { name, code, budget, headId, firstTeam } = req.body;
  const department = new Department({
    name,
    code,
    budget,
    tenant: req.tenantId,
  });
  if (headId) {
    const head = await User.findById(headId);
    if (head) {
      department.head = head._id;
      head.department = department._id;
      await head.save();
    }
  }
  if (firstTeam) {
    department.teams.push({ name: firstTeam.name, lead: firstTeam.leadId });
  }
  await department.save();
  res.json({ success: true, data: department });
};

exports.updateDepartment = async (req, res) => {
  const { name, code, budget } = req.body;
  const dept = await Department.findById(req.params.id);
  if (!dept) return res.status(404).json({ success: false, message: "Department not found" });
  if (name !== undefined) dept.name = name;
  if (code !== undefined) dept.code = code;
  if (budget !== undefined) dept.budget = budget;
  await dept.save();
  res.json({ success: true, data: dept });
};

exports.deleteDepartment = async (req, res) => {
  const dept = await Department.findById(req.params.id);
  if (!dept) return res.status(404).json({ success: false, message: "Department not found" });
  const memberCount = await Member.countDocuments({ department: dept._id });
  if (memberCount > 0) {
    return res.status(400).json({ success: false, message: "Cannot delete department with members" });
  }
  await Department.findByIdAndDelete(req.params.id);
  res.json({ success: true, data: {} });
};

exports.addTeam = async (req, res) => {
  const { name, leadId } = req.body;
  const department = await Department.findById(req.params.deptId);
  if (!department) return res.status(404).json({ success: false, message: "Department not found" });
  department.teams.push({ name, lead: leadId });
  await department.save();
  res.json({ success: true, data: department });
};

exports.updateTeam = async (req, res) => {
  const { deptId, teamName } = req.params;
  const { newName } = req.body;
  const department = await Department.findById(deptId);
  if (!department) return res.status(404).json({ success: false, message: "Department not found" });
  const team = department.teams.find((t) => t.name === teamName);
  if (!team) return res.status(404).json({ success: false, message: "Team not found" });
  if (newName) team.name = newName;
  await department.save();
  res.json({ success: true, data: department });
};

exports.deleteTeam = async (req, res) => {
  const { deptId, teamName } = req.params;
  const department = await Department.findById(deptId);
  if (!department) return res.status(404).json({ success: false, message: "Department not found" });
  const teamIndex = department.teams.findIndex((t) => t.name === teamName);
  if (teamIndex === -1) return res.status(404).json({ success: false, message: "Team not found" });
  department.teams.splice(teamIndex, 1);
  await department.save();
  res.json({ success: true, data: department });
};

exports.assignUser = async (req, res) => {
  const { userId, departmentId, team, role, managerId } = req.body;
  let user = await User.findById(userId);
  if (!user) return res.status(404).json({ success: false, message: "User not found" });
  if (departmentId) {
    const dept = await Department.findById(departmentId);
    if (!dept) return res.status(404).json({ success: false, message: "Department not found" });
    user.department = dept._id;
  }
  if (team) user.team = team;
  if (role) user.role = role;
  if (managerId) {
    const manager = await User.findById(managerId);
    if (manager) user.manager = manager._id;
  }
  await user.save();
  res.json({ success: true, data: user });
};

exports.getRbacMatrix = async (req, res) => {
  const tenantId = req.tenantId;
  const roles = await Role.find({ tenant: tenantId }).populate("permissions").lean();
  const allPermissions = [
    "dashboard.view_stats",
    "dashboard.view_team",
    "dashboard.payroll_overview",
    "timelog.record",
    "timelog.manual_entry",
    "timelog.approve",
    "leave.request",
    "leave.approve",
    "holiday.manage",
    "tasks.view",
    "tasks.create",
    "tasks.approve",
    "presets.manage",
    "reports.user_log",
    "org.manage",
    "roles.manage",
    "settings.manage",
    "tenant.switch",
  ];
  const matrix = roles.map((role) => ({
    roleId: role._id,
    roleName: role.name,
    scope: role.scope,
    permissions: allPermissions.map((perm) => ({
      key: perm,
      name: perm,
      value: role.permissions.includes("*") || role.permissions.includes(perm),
    })),
  }));
  res.json({ success: true, data: matrix });
};

exports.updateMatrix = async (req, res) => {
  const { roleId, perms } = req.body;
  const role = await Role.findById(roleId);
  if (!role) return res.status(404).json({ success: false, message: "Role not found" });
  role.permissions = perms.filter((p) => p.value).map((p) => p.key);
  await role.save();
  res.json({ success: true, data: role });
};

exports.createRole = async (req, res) => {
  const { name, guard, scope, permissions } = req.body;
  const existing = await Role.findOne({ name, tenant: req.tenantId });
  if (existing) return res.status(400).json({ success: false, message: "Role already exists" });
  const role = new Role({
    tenant: req.tenantId,
    name,
    guard,
    scope,
    permissions: permissions || [],
    isSystem: false,
  });
  await role.save();
  res.json({ success: true, data: role });
};

exports.updateRole = async (req, res) => {
  const { roleId } = req.params;
  const { name, scope, permissions } = req.body;
  const role = await Role.findById(roleId);
  if (!role) return res.status(404).json({ success: false, message: "Role not found" });
  if (name) role.name = name;
  if (scope) role.scope = scope;
  if (permissions) role.permissions = permissions;
  await role.save();
  res.json({ success: true, data: role });
};

exports.deleteRole = async (req, res) => {
  const { roleId } = req.params;
  const role = await Role.findById(roleId);
  if (!role) return res.status(404).json({ success: false, message: "Role not found" });
  const hasManage = role.permissions.includes("roles.manage");
  const lastManageRole = await Role.findOne({ tenant: role.tenant, permissions: "roles.manage" });
  if (hasManage && lastManageRole && lastManageRole._id.toString() === role._id.toString()) {
    return res.status(400).json({ success: false, message: "Cannot remove roles.manage from the last role that has it" });
  }
  await Role.findByIdAndDelete(roleId);
  res.json({ success: true, data: {} });
};