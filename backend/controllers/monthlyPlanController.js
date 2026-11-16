const MonthlyPlan = require("../models/MonthlyPlan");
const User = require("../models/User");
const Notification = require("../models/Notification");

// Helper to notify HR and Admins
const notifyHRAndAdmins = async (tenantId, title, message, linkTab = "monthly-planning") => {
  try {
    const hrUsers = await User.find({
      tenant: tenantId,
      role: { $in: ["Super Admin", "Admin", "HR", "Manager"] },
    }).select("_id");

    if (hrUsers.length > 0) {
      await Notification.create({
        tenant: tenantId,
        recipients: hrUsers.map((u) => u._id),
        title,
        message,
        category: "monthly_plan",
        linkTab,
      });
    }
  } catch (err) {
    console.error("Failed to create monthly plan notification:", err.message);
  }
};

// Helper to notify a specific user
const notifyUser = async (tenantId, userId, title, message, linkTab = "monthly-planning") => {
  try {
    await Notification.create({
      tenant: tenantId,
      recipients: [userId],
      title,
      message,
      category: "monthly_plan",
      linkTab,
    });
  } catch (err) {
    console.error("Failed to notify user:", err.message);
  }
};

// ==========================================
// 1. STATS & SUMMARY
// ==========================================
exports.getMonthlyPlanStats = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { monthCycle } = req.query;

    const filter = { tenant: tenantId };
    if (monthCycle) {
      filter.monthCycle = monthCycle;
    }

    const plans = await MonthlyPlan.find(filter).lean();

    const totalPlans = plans.length;
    let activePlans = 0;
    let completedPlans = 0;
    let draftPlans = 0;
    let submittedPlans = 0;
    let totalPlannedHours = 0;
    let totalActualHours = 0;
    let totalTargetBudget = 0;
    let totalActualCost = 0;
    let sumProgress = 0;
    let onTrackCount = 0;
    let delayedCount = 0;
    let totalAssignments = 0;

    plans.forEach((plan) => {
      if (["In Progress", "Approved"].includes(plan.status)) activePlans++;
      else if (plan.status === "Completed") completedPlans++;
      else if (plan.status === "Draft") draftPlans++;
      else if (plan.status === "Submitted") submittedPlans++;

      totalPlannedHours += plan.totalPlannedHours || 0;
      totalActualHours += plan.totalActualHours || 0;
      totalTargetBudget += plan.targetBudget || 0;
      totalActualCost += plan.actualCost || 0;
      sumProgress += plan.progressPercentage || 0;

      if (plan.assignments && plan.assignments.length > 0) {
        plan.assignments.forEach((a) => {
          totalAssignments++;
          if (["Completed", "Assigned", "In Progress"].includes(a.status)) {
            if (a.status === "Behind Schedule" || (a.targetHours > 0 && a.actualHours > a.targetHours * 1.25)) {
              delayedCount++;
            } else {
              onTrackCount++;
            }
          } else if (a.status === "Behind Schedule") {
            delayedCount++;
          }
        });
      }
    });

    const varianceHours = totalActualHours - totalPlannedHours;
    const variancePercentage = totalPlannedHours > 0
      ? Math.round(((totalActualHours - totalPlannedHours) / totalPlannedHours) * 100)
      : 0;

    const avgProgress = totalPlans > 0 ? Math.round(sumProgress / totalPlans) : 0;

    res.status(200).json({
      success: true,
      data: {
        totalPlans,
        activePlans,
        completedPlans,
        draftPlans,
        submittedPlans,
        totalPlannedHours,
        totalActualHours,
        varianceHours,
        variancePercentage,
        totalTargetBudget,
        totalActualCost,
        avgProgress,
        onTrackCount,
        delayedCount,
        totalAssignments,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ==========================================
// 2. LIST & GET PLANS
// ==========================================
exports.getMonthlyPlans = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { monthCycle, department, status, priority, search } = req.query;

    const filter = { tenant: tenantId };
    if (monthCycle) filter.monthCycle = monthCycle;
    if (department && department !== "All") filter.department = department;
    if (status && status !== "All") filter.status = status;
    if (priority && priority !== "All") filter.priority = priority;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { department: { $regex: search, $options: "i" } },
        { leadName: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    // Role-based visibility:
    // If user is a plain "Member", also include plans where they are an assigned employee
    const plans = await MonthlyPlan.find(filter)
      .populate("lead", "name email role designation department")
      .populate("submittedBy", "name email")
      .populate("reviewedBy", "name email")
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: plans,
      count: plans.length,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getMonthlyPlanById = async (req, res) => {
  try {
    const plan = await MonthlyPlan.findOne({
      _id: req.params.id,
      tenant: req.tenantId,
    })
      .populate("lead", "name email role designation department")
      .populate("assignments.employee", "name email designation avatar")
      .lean();

    if (!plan) {
      return res.status(404).json({ success: false, message: "Monthly plan not found" });
    }

    res.status(200).json({ success: true, data: plan });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ==========================================
// 3. CREATE & UPDATE PLAN
// ==========================================
exports.createMonthlyPlan = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const {
      title,
      monthCycle,
      year,
      month,
      department,
      team,
      lead,
      leadName,
      description,
      objectives,
      priority,
      totalPlannedHours,
      targetBudget,
      schedules,
      assignments,
    } = req.body;

    if (!title || !monthCycle || !department) {
      return res.status(400).json({
        success: false,
        message: "Title, month cycle (e.g. 2026-11), and department are required",
      });
    }

    // Resolve month & year from monthCycle if not provided
    let planYear = year;
    let planMonth = month;
    if (!planYear || !planMonth) {
      const parts = monthCycle.split("-");
      if (parts.length >= 2) {
        planYear = parseInt(parts[0], 10);
        planMonth = parseInt(parts[1], 10);
      } else {
        const d = new Date();
        planYear = d.getFullYear();
        planMonth = d.getMonth() + 1;
      }
    }

    // Resolve lead name if lead ID is provided
    let resolvedLeadName = leadName;
    if (lead && !resolvedLeadName) {
      const leadUser = await User.findById(lead).select("name");
      if (leadUser) resolvedLeadName = leadUser.name;
    }

    // Resolve assignments if provided
    let resolvedAssignments = [];
    if (assignments && Array.isArray(assignments)) {
      for (const a of assignments) {
        const empId = a.employee || a.employeeId;
        if (empId) {
          const u = await User.findById(empId).select("name email department");
          resolvedAssignments.push({
            employee: empId,
            employeeName: a.employeeName || (u ? u.name : "Employee"),
            employeeEmail: a.employeeEmail || (u ? u.email : ""),
            roleInPlan: a.roleInPlan || "Contributor",
            department: a.department || (u ? u.department : department),
            targetHours: a.targetHours || 0,
            actualHours: a.actualHours || 0,
            assignedTasksCount: a.assignedTasksCount || 0,
            completedTasksCount: a.completedTasksCount || 0,
            completionRate: a.completionRate || 0,
            status: a.status || "Assigned",
            deliverables: a.deliverables,
            notes: a.notes,
          });
        }
      }
    }

    // If assignments provided, calculate initial planned hours
    let calculatedPlannedHours = totalPlannedHours || 0;
    if ((!calculatedPlannedHours || calculatedPlannedHours === 0) && resolvedAssignments.length > 0) {
      calculatedPlannedHours = resolvedAssignments.reduce((acc, curr) => acc + (curr.targetHours || 0), 0);
    }

    const newPlan = await MonthlyPlan.create({
      tenant: tenantId,
      title,
      monthCycle,
      year: planYear,
      month: planMonth,
      department,
      team,
      lead: lead || req.user._id,
      leadName: resolvedLeadName || req.user.name,
      description,
      objectives: Array.isArray(objectives) ? objectives : (objectives ? [objectives] : []),
      priority: priority || "Medium",
      status: "Draft",
      totalPlannedHours: calculatedPlannedHours,
      totalActualHours: 0,
      targetBudget: targetBudget || 0,
      actualCost: 0,
      progressPercentage: 0,
      schedules: schedules || [],
      assignments: resolvedAssignments,
      submittedBy: req.user._id,
      submittedByName: req.user.name,
    });

    res.status(201).json({
      success: true,
      data: newPlan,
      message: "Monthly work plan created successfully",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateMonthlyPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const plan = await MonthlyPlan.findOne({ _id: id, tenant: tenantId });
    if (!plan) {
      return res.status(404).json({ success: false, message: "Monthly plan not found" });
    }

    const fields = [
      "title",
      "monthCycle",
      "year",
      "month",
      "department",
      "team",
      "lead",
      "leadName",
      "description",
      "objectives",
      "priority",
      "totalPlannedHours",
      "totalActualHours",
      "targetBudget",
      "actualCost",
      "progressPercentage",
      "varianceNotes",
    ];

    fields.forEach((f) => {
      if (req.body[f] !== undefined) {
        plan[f] = req.body[f];
      }
    });

    // If schedules or assignments are sent directly in body
    if (req.body.schedules !== undefined) plan.schedules = req.body.schedules;
    if (req.body.assignments !== undefined) plan.assignments = req.body.assignments;

    // Auto-calculate progress if assignments are present
    if (plan.assignments && plan.assignments.length > 0) {
      const totalRates = plan.assignments.reduce((sum, a) => sum + (a.completionRate || 0), 0);
      plan.progressPercentage = Math.round(totalRates / plan.assignments.length);

      const totalActual = plan.assignments.reduce((sum, a) => sum + (a.actualHours || 0), 0);
      if (totalActual > 0) plan.totalActualHours = totalActual;
    }

    await plan.save();

    res.status(200).json({
      success: true,
      data: plan,
      message: "Monthly plan updated successfully",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ==========================================
// 4. STATUS TRANSITIONS & APPROVAL WORKFLOW
// ==========================================
exports.updateMonthlyPlanStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reviewRemarks } = req.body;
    const tenantId = req.tenantId;

    const plan = await MonthlyPlan.findOne({ _id: id, tenant: tenantId });
    if (!plan) {
      return res.status(404).json({ success: false, message: "Monthly plan not found" });
    }

    const validStatuses = ["Draft", "Submitted", "Approved", "In Progress", "Completed", "Rejected"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status: ${status}` });
    }

    plan.status = status;

    if (status === "Submitted") {
      plan.submittedBy = req.user._id;
      plan.submittedByName = req.user.name;
      plan.submittedAt = new Date();

      await notifyHRAndAdmins(
        tenantId,
        `Monthly Plan Submitted: ${plan.title}`,
        `${req.user.name} submitted monthly plan for ${plan.department} (${plan.monthCycle}) for approval.`
      );
    } else if (status === "Approved") {
      plan.reviewedBy = req.user._id;
      plan.reviewedByName = req.user.name;
      plan.reviewedAt = new Date();
      if (reviewRemarks) plan.reviewRemarks = reviewRemarks;

      if (plan.lead) {
        await notifyUser(
          tenantId,
          plan.lead,
          `Monthly Plan Approved: ${plan.title}`,
          `Your monthly plan for ${plan.monthCycle} has been approved by ${req.user.name}.`
        );
      }
    } else if (status === "Rejected") {
      plan.reviewedBy = req.user._id;
      plan.reviewedByName = req.user.name;
      plan.reviewedAt = new Date();
      if (reviewRemarks) plan.reviewRemarks = reviewRemarks;

      if (plan.lead) {
        await notifyUser(
          tenantId,
          plan.lead,
          `Monthly Plan Needs Revision: ${plan.title}`,
          `Your monthly plan for ${plan.monthCycle} was rejected. Remarks: ${reviewRemarks || "None provided"}`
        );
      }
    } else if (status === "Completed") {
      plan.progressPercentage = 100;
    }

    await plan.save();

    res.status(200).json({
      success: true,
      data: plan,
      message: `Monthly plan status updated to ${status}`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteMonthlyPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const plan = await MonthlyPlan.findOneAndDelete({ _id: id, tenant: req.tenantId });
    if (!plan) {
      return res.status(404).json({ success: false, message: "Monthly plan not found" });
    }

    res.status(200).json({
      success: true,
      message: "Monthly plan deleted successfully",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ==========================================
// 5. SCHEDULES & MILESTONES
// ==========================================
exports.addScheduleItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, weekNumber, startDate, endDate, deliverables, milestone, status, plannedHours, actualHours, notes } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, message: "Schedule item title is required" });
    }

    const plan = await MonthlyPlan.findOne({ _id: id, tenant: req.tenantId });
    if (!plan) {
      return res.status(404).json({ success: false, message: "Monthly plan not found" });
    }

    plan.schedules.push({
      title,
      weekNumber: weekNumber || 1,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      deliverables,
      milestone,
      status: status || "Pending",
      plannedHours: plannedHours || 0,
      actualHours: actualHours || 0,
      notes,
    });

    await plan.save();

    res.status(201).json({
      success: true,
      data: plan,
      message: "Schedule item added successfully",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateScheduleItem = async (req, res) => {
  try {
    const { id, scheduleId } = req.params;
    const plan = await MonthlyPlan.findOne({ _id: id, tenant: req.tenantId });
    if (!plan) {
      return res.status(404).json({ success: false, message: "Monthly plan not found" });
    }

    const schedule = plan.schedules.id(scheduleId);
    if (!schedule) {
      return res.status(404).json({ success: false, message: "Schedule item not found" });
    }

    const fields = ["title", "weekNumber", "startDate", "endDate", "deliverables", "milestone", "status", "plannedHours", "actualHours", "notes"];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) {
        schedule[f] = req.body[f];
      }
    });

    await plan.save();

    res.status(200).json({
      success: true,
      data: plan,
      message: "Schedule item updated successfully",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteScheduleItem = async (req, res) => {
  try {
    const { id, scheduleId } = req.params;
    const plan = await MonthlyPlan.findOne({ _id: id, tenant: req.tenantId });
    if (!plan) {
      return res.status(404).json({ success: false, message: "Monthly plan not found" });
    }

    plan.schedules.pull(scheduleId);
    await plan.save();

    res.status(200).json({
      success: true,
      data: plan,
      message: "Schedule item deleted successfully",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ==========================================
// 6. EMPLOYEE ASSIGNMENTS
// ==========================================
exports.addAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const { employeeId, roleInPlan, targetHours, deliverables, notes } = req.body;

    if (!employeeId) {
      return res.status(400).json({ success: false, message: "Employee ID is required" });
    }

    const [plan, user] = await Promise.all([
      MonthlyPlan.findOne({ _id: id, tenant: req.tenantId }),
      User.findOne({ _id: employeeId, tenant: req.tenantId }).select("name email department"),
    ]);

    if (!plan) return res.status(404).json({ success: false, message: "Monthly plan not found" });
    if (!user) return res.status(404).json({ success: false, message: "Employee not found in organization" });

    // Check if employee is already assigned
    const existing = plan.assignments.find((a) => a.employee.toString() === employeeId);
    if (existing) {
      return res.status(400).json({ success: false, message: "Employee is already assigned to this plan" });
    }

    const newAssignment = {
      employee: user._id,
      employeeName: user.name,
      employeeEmail: user.email,
      department: user.department || plan.department,
      roleInPlan: roleInPlan || "Contributor",
      targetHours: targetHours || 40,
      actualHours: 0,
      assignedTasksCount: 0,
      completedTasksCount: 0,
      completionRate: 0,
      status: "Assigned",
      deliverables,
      notes,
    };

    plan.assignments.push(newAssignment);

    // Update total planned hours of plan
    plan.totalPlannedHours = plan.assignments.reduce((sum, a) => sum + (a.targetHours || 0), 0);
    await plan.save();

    // Send notification to employee
    await notifyUser(
      req.tenantId,
      user._id,
      `New Monthly Plan Assignment: ${plan.title}`,
      `You have been assigned to ${plan.title} as ${roleInPlan || "Contributor"} (${targetHours || 40} target hours).`
    );

    res.status(201).json({
      success: true,
      data: plan,
      message: `${user.name} assigned to work plan successfully`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateAssignment = async (req, res) => {
  try {
    const { id, assignmentId } = req.params;
    const plan = await MonthlyPlan.findOne({ _id: id, tenant: req.tenantId });
    if (!plan) return res.status(404).json({ success: false, message: "Monthly plan not found" });

    const assignment = plan.assignments.id(assignmentId);
    if (!assignment) return res.status(404).json({ success: false, message: "Assignment not found" });

    const fields = [
      "roleInPlan",
      "targetHours",
      "actualHours",
      "assignedTasksCount",
      "completedTasksCount",
      "completionRate",
      "status",
      "deliverables",
      "notes",
    ];

    fields.forEach((f) => {
      if (req.body[f] !== undefined) {
        assignment[f] = req.body[f];
      }
    });

    // Auto-compute completion rate if task counts provided
    if (assignment.assignedTasksCount > 0 && req.body.completedTasksCount !== undefined) {
      assignment.completionRate = Math.min(
        100,
        Math.round((assignment.completedTasksCount / assignment.assignedTasksCount) * 100)
      );
    }

    // Recompute plan total actual hours and overall progress
    plan.totalPlannedHours = plan.assignments.reduce((sum, a) => sum + (a.targetHours || 0), 0);
    plan.totalActualHours = plan.assignments.reduce((sum, a) => sum + (a.actualHours || 0), 0);
    const avgProgress = Math.round(
      plan.assignments.reduce((sum, a) => sum + (a.completionRate || 0), 0) / plan.assignments.length
    );
    plan.progressPercentage = avgProgress;

    await plan.save();

    res.status(200).json({
      success: true,
      data: plan,
      message: "Assignment updated successfully",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteAssignment = async (req, res) => {
  try {
    const { id, assignmentId } = req.params;
    const plan = await MonthlyPlan.findOne({ _id: id, tenant: req.tenantId });
    if (!plan) return res.status(404).json({ success: false, message: "Monthly plan not found" });

    plan.assignments.pull(assignmentId);
    plan.totalPlannedHours = plan.assignments.reduce((sum, a) => sum + (a.targetHours || 0), 0);
    plan.totalActualHours = plan.assignments.reduce((sum, a) => sum + (a.actualHours || 0), 0);
    if (plan.assignments.length > 0) {
      plan.progressPercentage = Math.round(
        plan.assignments.reduce((sum, a) => sum + (a.completionRate || 0), 0) / plan.assignments.length
      );
    } else {
      plan.progressPercentage = 0;
    }

    await plan.save();

    res.status(200).json({
      success: true,
      data: plan,
      message: "Assignment removed successfully",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ==========================================
// 7. PLANNED VS ACTUAL WORK TRACKING MATRIX
// ==========================================
exports.getPlannedVsActualTracking = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { monthCycle, department } = req.query;

    const filter = { tenant: tenantId };
    if (monthCycle) filter.monthCycle = monthCycle;
    if (department && department !== "All") filter.department = department;

    const plans = await MonthlyPlan.find(filter)
      .populate("lead", "name email designation")
      .populate("assignments.employee", "name email designation")
      .lean();

    const trackingData = plans.map((p) => {
      const plannedHours = p.totalPlannedHours || 0;
      const actualHours = p.totalActualHours || 0;
      const varianceHours = actualHours - plannedHours;
      const variancePct = plannedHours > 0 ? Math.round((varianceHours / plannedHours) * 100) : 0;

      let varianceStatus = "On Track";
      if (variancePct > 20) varianceStatus = "Over Budget / Hours";
      else if (variancePct < -20 && p.progressPercentage < 50) varianceStatus = "Behind Schedule";
      else if (variancePct <= 0 && p.progressPercentage >= 80) varianceStatus = "Ahead of Schedule";

      const assignmentDetails = (p.assignments || []).map((a) => {
        const aPlanned = a.targetHours || 0;
        const aActual = a.actualHours || 0;
        const aVar = aActual - aPlanned;
        const aVarPct = aPlanned > 0 ? Math.round((aVar / aPlanned) * 100) : 0;
        return {
          id: a._id || a.id,
          employeeId: a.employee?._id || a.employee,
          employeeName: a.employeeName || a.employee?.name,
          employeeEmail: a.employeeEmail || a.employee?.email,
          roleInPlan: a.roleInPlan,
          plannedHours: aPlanned,
          actualHours: aActual,
          varianceHours: aVar,
          variancePercentage: aVarPct,
          assignedTasks: a.assignedTasksCount || 0,
          completedTasks: a.completedTasksCount || 0,
          completionRate: a.completionRate || 0,
          status: a.status,
          deliverables: a.deliverables,
        };
      });

      return {
        id: p._id.toString(),
        title: p.title,
        monthCycle: p.monthCycle,
        department: p.department,
        team: p.team,
        leadName: p.leadName,
        status: p.status,
        priority: p.priority,
        plannedHours,
        actualHours,
        varianceHours,
        variancePercentage: variancePct,
        varianceStatus,
        targetBudget: p.targetBudget || 0,
        actualCost: p.actualCost || 0,
        progressPercentage: p.progressPercentage || 0,
        schedulesCount: (p.schedules || []).length,
        assignmentsCount: (p.assignments || []).length,
        assignments: assignmentDetails,
        varianceNotes: p.varianceNotes,
      };
    });

    res.status(200).json({
      success: true,
      data: trackingData,
      count: trackingData.length,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ==========================================
// 8. ORGANIZATION MEMBERS (FOR DROPDOWNS)
// ==========================================
exports.getOrganizationMembers = async (req, res) => {
  try {
    const users = await User.find({ tenant: req.tenantId, isActive: { $ne: false } })
      .select("id name email role department team designation empCode")
      .sort({ name: 1 })
      .lean();

    res.status(200).json({
      success: true,
      data: users,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
