require("dotenv").config();

// Fix for MongoDB driver crypto issue in some environments
global.crypto = require("crypto");

const mongoose = require("mongoose");
const Tenant = require("../models/Tenant");
const User = require("../models/User");
const Role = require("../models/Role");
const Department = require("../models/Department");
const Task = require("../models/Task");
const TaskPreset = require("../models/TaskPreset");
const Holiday = require("../models/Holiday");
const Attendance = require("../models/Attendance");
const LeaveRequest = require("../models/LeaveRequest");
const LeaveBalance = require("../models/LeaveBalance");
const TimeEntry = require("../models/TimeEntry");
const Timesheet = require("../models/Timesheet");
const ActiveTimer = require("../models/ActiveTimer");
const Payroll = require("../models/Payroll");
const Setting = require("../models/Setting");

const TenantData = require("./data/tenants");
const UserData = require("./data/users");
const RoleData = require("./data/roles");
const DepartmentData = require("./data/departments");
const TaskData = require("./data/tasks");
const TaskPresetData = require("./data/task-presets");
const HolidayData = require("./data/holidays");

const {
  randomEnum,
  randomDateBetween,
  randomWorkingDay,
  generateAttendanceDays,
  generateTimeEntries,
  generatePayrollRecord,
} = require("./helpers");

let tenantIds = [];
let userIds = [];
let roleIds = [];
let departmentIds = [];

const clearDB = async () => {
  const staleIndexes = [
    ["attendances", "tenant_1"],
    ["roles", "name_1"],
    ["holidays", "tenant_1"],
    ["leavebalances", "tenant_1"],
    ["leavebalances", "user_1"],
    ["payrolls", "tenant_1"],
    ["payrolls", "user_1"],
  ];
  for (const [collection, index] of staleIndexes) {
    await mongoose.connection.db.collection(collection).dropIndex(index).catch(() => {});
  }
  await Promise.all([
    Attendance.deleteMany({}),
    LeaveRequest.deleteMany({}),
    LeaveBalance.deleteMany({}),
    Payroll.deleteMany({}),
    Task.deleteMany({}),
    TaskPreset.deleteMany({}),
    Holiday.deleteMany({}),
    TimeEntry.deleteMany({}),
    Timesheet.deleteMany({}),
    ActiveTimer.deleteMany({}),
    Setting.deleteMany({}),
    User.deleteMany({}),
    Role.deleteMany({}),
    Department.deleteMany({}),
    Tenant.deleteMany({}),
  ]);
  console.log("All collections cleared");
};

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected for seeding");

    // Clear existing data if --fresh
    const args = process.argv.slice(2);
    if (args.includes("--fresh") || args.includes("--destroy")) {
      await clearDB();
    }

    // Seed Tenants
    const tenants = await Tenant.insertMany(TenantData);
    tenantIds = tenants.map((t) => t._id);
    console.log(`${tenants.length} tenants seeded`);

    const apexTenant = tenants.find((t) => t.code === "APEX");
    const techbdTenant = tenants.find((t) => t.code === "TECH-BD");

    // Deep-replace tenant placeholders in plain JSON data
    const replaceTenantPlaceholders = (obj) =>
      JSON.parse(
        JSON.stringify(obj)
          .replaceAll("APEX_TENANT_ID_PLACEHOLDER", apexTenant._id.toString())
          .replaceAll("TECH-BD_TENANT_ID_PLACEHOLDER", techbdTenant._id.toString())
      );

    // Map tenant placeholders to actual IDs
    const updatedUsers = UserData.map((u) => {
      if (u.email.includes("apex")) {
        u.tenant = apexTenant._id;
      } else if (u.email.includes("techbd")) {
        u.tenant = techbdTenant._id;
      }
      return u;
    });

    const updatedRoles = replaceTenantPlaceholders(RoleData);

    const updatedDepartments = replaceTenantPlaceholders(DepartmentData);

    // Seed Users
    const users = await User.insertMany(updatedUsers);
    userIds = users.map((u) => u._id);
    console.log(`${users.length} users seeded`);

    // Seed Roles
    const roles = await Role.insertMany(updatedRoles);
    roleIds = roles.map((r) => r._id);
    console.log(`${roles.length} roles seeded`);

    // Seed Departments (resolve user refs by name)
    const userByName = (name) => users.find((u) => u.name === name);
    for (const d of updatedDepartments) {
      if (d.hodName) {
        const hodUser = userByName(d.hodName);
        d.hod = hodUser ? hodUser._id.toString() : undefined;
      }
      for (const team of d.teams || []) {
        const leadUser = userByName(team.leadName);
        team.lead = leadUser ? leadUser._id : undefined;
        team.members = leadUser ? [leadUser._id] : [];
      }
    }
    const departments = await Department.insertMany(updatedDepartments);
    departmentIds = departments.map((d) => d._id);
    console.log(`${departments.length} departments seeded`);

    // Seed Tasks with proper owner references (owner must be in the same tenant)
    const updatedTasks = replaceTenantPlaceholders(TaskData).map((t, i) => {
      const sameTenantUsers = users
        .map((u, idx) => ({ u, id: userIds[idx] }))
        .filter((x) => String(x.u.tenant) === String(t.tenant));
      const byName = sameTenantUsers.find((x) => x.u.name === t.ownerName);
      const pick = byName || (sameTenantUsers.length ? sameTenantUsers[i % sameTenantUsers.length] : null);
      if (pick) {
        t.owner = pick.id;
        t.ownerName = pick.u.name;
      }
      return t;
    });
    const tasks = await Task.insertMany(updatedTasks);
    console.log(`${tasks.length} tasks seeded`);

    // Seed TaskPresets
    const taskPresets = await TaskPreset.insertMany(replaceTenantPlaceholders(TaskPresetData));
    console.log(`${taskPresets.length} task presets seeded`);

    // Seed Holidays
    const holidays = await Holiday.insertMany(replaceTenantPlaceholders(HolidayData));
    console.log(`${holidays.length} holidays seeded`);

    // Seed Attendance (60 days per user)
    for (const userId of userIds) {
      const userDoc = await User.findById(userId);
      const attendanceDocs = generateAttendanceDays(new Date("2026-09-01"), new Date("2026-10-31")).map((day) => ({
        tenant: userDoc.tenant,
        user: userId,
        userName: userDoc.name,
        ...day,
      }));
      await Attendance.insertMany(attendanceDocs);
    }
    console.log("Attendance data seeded for all users");

    // Seed LeaveRequests (some sample requests)
    const leaveRequests = [
      {
        tenant: apexTenant._id,
        user: userIds[1], // Jane Smith
        applicantName: "Jane Smith",
        dept: "Engineering",
        type: "Sick",
        startDate: new Date("2026-10-10"),
        endDate: new Date("2026-10-12"),
        days: 3,
        duration: "3 working days",
        reason: "Flu",
        status: "Pending Manager",
      },
      {
        tenant: techbdTenant._id,
        user: userIds[8], // Rahman Islam
        applicantName: "Rahman Islam",
        dept: "Human Resources",
        type: "Casual",
        startDate: new Date("2026-10-20"),
        endDate: new Date("2026-10-22"),
        days: 3,
        duration: "3 working days",
        reason: "Family event",
        status: "Pending Manager",
      },
    ];
    await LeaveRequest.insertMany(leaveRequests);
    console.log(`${leaveRequests.length} leave requests seeded`);

    // Seed LeaveBalances
    const leaveBalances = [];
    for (const userId of userIds) {
      const userDoc = await User.findById(userId);
      leaveBalances.push({
        tenant: userDoc.tenant,
        user: userId,
        year: 2026,
        casualTotal: 10,
        casualUsed: Math.floor(Math.random() * 5),
        sickTotal: 7,
        sickUsed: Math.floor(Math.random() * 3),
        annualTotal: 15,
        annualUsed: Math.floor(Math.random() * 5),
        unpaidUsed: Math.floor(Math.random() * 2),
      });
    }
    await LeaveBalance.insertMany(leaveBalances);
    console.log(`${leaveBalances.length} leave balances seeded`);

    // Seed TimeEntries
    for (const userId of userIds) {
      const userDoc = await User.findById(userId);
      const sameTenantTasks = tasks.filter((t) => String(t.tenant) === String(userDoc.tenant));
      const taskForUser =
        sameTenantTasks.find((t) => String(t.owner) === userId.toString()) || sameTenantTasks[0] || tasks[0];
      await TimeEntry.insertMany(generateTimeEntries(userDoc.tenant, userId, [taskForUser._id], new Date("2026-10-01"), new Date("2026-10-31")));
    }
    console.log("Time entries seeded for all users");

    // Seed Timesheets
    let timesheetCount = 0;
    for (const userId of userIds) {
      const userDoc = await User.findById(userId);
      await Timesheet.create({
        tenant: userDoc.tenant,
        user: userId,
        userName: userDoc.name,
        weekStart: new Date("2026-10-07"),
        weekEnd: new Date("2026-10-13"),
        weekLabel: "Week 40",
        dailyHours: {
          mon: 8,
          tue: 7.5,
          wed: 9,
          thu: 8,
          fri: 7.5,
          sat: 0,
          sun: 0,
        },
        totalHours: 40,
        status: "Submitted",
        idleFlags: 0,
      });
      timesheetCount++;
    }
    console.log(`${timesheetCount} timesheets seeded`);

    // Seed ActiveTimers (some running, some not)
    let activeTimerCount = 0;
    for (let i = 0; i < userIds.length; i++) {
      const isRunning = i % 3 !== 0;
      const userDoc = await User.findById(userIds[i]);
      const sameTenantTasks = tasks.filter((t) => String(t.tenant) === String(userDoc.tenant));
      const pool = sameTenantTasks.length ? sameTenantTasks : tasks;
      const chosen = pool[i % pool.length];
      const accumulatedSeconds = isRunning ? Math.floor(Math.random() * 3600 * 4) : 0;
      await ActiveTimer.create({
        tenant: userDoc.tenant,
        user: userIds[i],
        task: chosen._id,
        taskTitle: chosen.title,
        startedAt: isRunning ? new Date(Date.now() - accumulatedSeconds * 1000) : undefined,
        lastResumedAt: isRunning ? new Date() : undefined,
        accumulatedSeconds,
        running: isRunning,
        idleDiscardedSeconds: 0,
      });
      activeTimerCount++;
    }
    console.log(`${activeTimerCount} active timers seeded`);

    // Seed Payroll records (3 months)
    const months = ["2026-09", "2026-10", "2026-11"];
    let payrollCount = 0;
    for (let i = 0; i < userIds.length; i++) {
      const userDoc = await User.findById(userIds[i]);
      await Payroll.create(generatePayrollRecord({ tenant: userDoc.tenant, _id: userIds[i], name: userDoc.name, department: userDoc.department }, months[i % months.length]));
      payrollCount++;
    }
    console.log(`${payrollCount} payroll records seeded`);

    // Seed Settings (one per tenant)
    for (const tenant of tenants) {
      await Setting.create({
        tenant: tenant._id,
        idleThresholdSeconds: 60,
        defaultWorkingHours: 8,
        officeStartTime: "09:00",
        lateGraceMinutes: 15,
        monthlySubmissionDay: 25,
        approvalWindowDay: 28,
        overtimeRateMultiplier: 1.5,
        workingDays: [0, 1, 2, 3, 4], // Sun-Thu for TECH-BD
        deductionFormula: "salary × (presentDays − absentDays − leaveDays) / presentDays + overtimeRate × overtimeHours",
        leaveAllowance: { casual: 10, sick: 7, annual: 15 },
        sickCertificateAfterDays: 1,
      });
    }
    console.log(`${tenants.length} settings seeded`);

    // Print demo login summary
    console.log("\n=== Demo Login Summary ===\n");
    console.log("TECH-BD Super Admin:");
    console.log("  Email: sarah@techbd.com");
    console.log("  Password: password123");
    console.log("\nTECH-BD Admin:");
    console.log("  Email: mohammad@techbd.com");
    console.log("  Password: password123");
    console.log("\nTECH-BD Member:");
    console.log("  Email: karim@techbd.com");
    console.log("  Password: password123");
    console.log("\nAPEX Super Admin:");
    console.log("  Email: john@apex.com");
    console.log("  Password: password123");
    console.log("\nAPEX Admin:");
    console.log("  Email: jane@apex.com");
    console.log("  Password: password123");
    console.log("\nAPEX Member:");
    console.log("  Email: charlie@apex.com");
    console.log("  Password: password123\n");

    console.log("Seeding completed successfully!");
    mongoose.connection.close();
  } catch (err) {
    console.error("Seeding error:", err);
    mongoose.connection.close();
    process.exit(1);
  }
};

seed();