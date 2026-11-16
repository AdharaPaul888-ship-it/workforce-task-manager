const Goal = require("../models/Goal");
const KPI = require("../models/KPI");
const PerformanceReview = require("../models/PerformanceReview");
const ContinuousFeedback = require("../models/ContinuousFeedback");
const Appraisal = require("../models/Appraisal");
const User = require("../models/User");
const Notification = require("../models/Notification");

// Helper to notify HR and Admins
const notifyHRAndAdmins = async (tenantId, title, message, linkTab = "performance") => {
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
        category: "performance",
        linkTab,
      });
    }
  } catch (err) {
    console.error("Failed to create performance notification:", err.message);
  }
};

// Helper to notify a specific user
const notifyUser = async (tenantId, userId, title, message, linkTab = "performance") => {
  try {
    await Notification.create({
      tenant: tenantId,
      recipients: [userId],
      title,
      message,
      category: "performance",
      linkTab,
    });
  } catch (err) {
    console.error("Failed to notify user:", err.message);
  }
};

// ==========================================
// 1. PERFORMANCE ANALYTICS & DASHBOARD STATS
// ==========================================
exports.getPerformanceStats = async (req, res) => {
  try {
    const tenantId = req.tenantId;

    const [goals, kpis, reviews, appraisals, feedbackList] = await Promise.all([
      Goal.find({ tenant: tenantId }).lean(),
      KPI.find({ tenant: tenantId }).lean(),
      PerformanceReview.find({ tenant: tenantId }).lean(),
      Appraisal.find({ tenant: tenantId }).lean(),
      ContinuousFeedback.find({ tenant: tenantId }).lean(),
    ]);

    // Goals calculation
    const totalGoals = goals.length;
    const achievedGoals = goals.filter((g) => g.status === "Achieved").length;
    const inProgressGoals = goals.filter((g) => g.status === "In Progress").length;
    const atRiskGoals = goals.filter((g) => g.status === "At Risk").length;
    const goalAttainmentRate = totalGoals > 0 ? Math.round((achievedGoals / totalGoals) * 100) : 0;

    // Goals category distribution
    const goalCategories = {};
    goals.forEach((g) => {
      goalCategories[g.category] = (goalCategories[g.category] || 0) + 1;
    });

    // KPI calculation
    const totalKPIs = kpis.length;
    const onTrackKPIs = kpis.filter((k) => ["On Track", "Exceeded"].includes(k.status)).length;
    const behindKPIs = kpis.filter((k) => k.status === "Behind").length;
    const criticalKPIs = kpis.filter((k) => k.status === "Critical").length;
    const kpiHealthRate = totalKPIs > 0 ? Math.round((onTrackKPIs / totalKPIs) * 100) : 0;

    // Reviews calculation
    const totalReviews = reviews.length;
    const completedReviews = reviews.filter((r) => r.status === "Completed").length;
    const pendingReviews = reviews.filter((r) => r.status !== "Completed").length;
    const reviewCompletionRate = totalReviews > 0 ? Math.round((completedReviews / totalReviews) * 100) : 0;

    // Average performance rating calculation from completed reviews
    let totalScore = 0;
    let scoreCount = 0;
    reviews.forEach((r) => {
      const score = r.finalRating || r.managerAssessment?.overallScore;
      if (score) {
        totalScore += score;
        scoreCount++;
      }
    });
    const avgScore = scoreCount > 0 ? parseFloat((totalScore / scoreCount).toFixed(2)) : 4.0;

    // Appraisal stats
    const totalAppraisals = appraisals.length;
    const approvedAppraisals = appraisals.filter((a) => ["Approved", "Acknowledged"].includes(a.status)).length;
    const promotionsRecommended = appraisals.filter((a) => a.promotionRecommended).length;
    const totalIncrement = appraisals.reduce((acc, a) => acc + (a.incrementPercentage || 0), 0);
    const avgIncrementPct = totalAppraisals > 0 ? parseFloat((totalIncrement / totalAppraisals).toFixed(1)) : 0;

    // Leaderboard: Top Performers (from completed reviews or appraisals)
    const performerMap = {};
    reviews.forEach((r) => {
      const score = r.finalRating || r.managerAssessment?.overallScore || 0;
      if (score > 0 && r.employee) {
        const empId = r.employee.toString();
        if (!performerMap[empId] || performerMap[empId].score < score) {
          performerMap[empId] = {
            id: empId,
            name: r.employeeName,
            department: r.department,
            designation: r.designation,
            score,
            label: r.finalRatingLabel || `${score} / 5`,
          };
        }
      }
    });

    const topPerformers = Object.values(performerMap)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    res.status(200).json({
      success: true,
      data: {
        avgScore,
        totalGoals,
        achievedGoals,
        inProgressGoals,
        atRiskGoals,
        goalAttainmentRate,
        goalCategories,
        totalKPIs,
        onTrackKPIs,
        behindKPIs,
        criticalKPIs,
        kpiHealthRate,
        totalReviews,
        completedReviews,
        pendingReviews,
        reviewCompletionRate,
        totalAppraisals,
        approvedAppraisals,
        promotionsRecommended,
        avgIncrementPct,
        totalFeedback: feedbackList.length,
        topPerformers,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ==========================================
// 2. EMPLOYEE GOALS (SMART GOALS)
// ==========================================
exports.getGoals = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { employeeId, cycle, category, status, search } = req.query;

    const filter = { tenant: tenantId };
    if (employeeId) filter.employee = employeeId;
    if (cycle && cycle !== "All") filter.cycle = cycle;
    if (category && category !== "All") filter.category = category;
    if (status && status !== "All") filter.status = status;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { employeeName: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { targetMetric: { $regex: search, $options: "i" } },
      ];
    }

    const goals = await Goal.find(filter)
      .populate("employee", "name email department designation avatar")
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: goals,
      count: goals.length,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getGoalById = async (req, res) => {
  try {
    const goal = await Goal.findOne({ _id: req.params.id, tenant: req.tenantId })
      .populate("employee", "name email department designation")
      .lean();

    if (!goal) return res.status(404).json({ success: false, message: "Goal not found" });

    res.status(200).json({ success: true, data: goal });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createGoal = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const {
      employeeId,
      title,
      description,
      category,
      cycle,
      startDate,
      targetDate,
      weightage,
      targetMetric,
      alignment,
      status,
      progress,
    } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, message: "Goal title is required" });
    }

    const targetEmpId = employeeId || req.user._id;
    const employeeUser = await User.findOne({ _id: targetEmpId, tenant: tenantId }).select("name email department");
    if (!employeeUser) {
      return res.status(404).json({ success: false, message: "Employee not found in organization" });
    }

    const newGoal = await Goal.create({
      tenant: tenantId,
      employee: employeeUser._id,
      employeeName: employeeUser.name,
      employeeEmail: employeeUser.email,
      department: employeeUser.department,
      title,
      description,
      category: category || "Technical & Delivery",
      cycle: cycle || "Q4 2026",
      startDate: startDate ? new Date(startDate) : new Date(),
      targetDate: targetDate ? new Date(targetDate) : undefined,
      weightage: weightage !== undefined ? Number(weightage) : 20,
      targetMetric,
      currentMetric: req.body.currentMetric || "0",
      progress: progress !== undefined ? Number(progress) : 0,
      status: status || "In Progress",
      alignment,
      managerNotes: req.body.managerNotes,
      employeeNotes: req.body.employeeNotes,
      createdBy: req.user._id,
    });

    if (employeeUser._id.toString() !== req.user._id.toString()) {
      await notifyUser(
        tenantId,
        employeeUser._id,
        `New Performance Goal Assigned: ${title}`,
        `${req.user.name} created a new performance goal for you: "${title}" (${cycle || "Q4 2026"}).`
      );
    }

    res.status(201).json({
      success: true,
      data: newGoal,
      message: "Employee goal created successfully",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateGoal = async (req, res) => {
  try {
    const { id } = req.params;
    const goal = await Goal.findOne({ _id: id, tenant: req.tenantId });
    if (!goal) return res.status(404).json({ success: false, message: "Goal not found" });

    const fields = [
      "title",
      "description",
      "category",
      "cycle",
      "startDate",
      "targetDate",
      "weightage",
      "targetMetric",
      "currentMetric",
      "progress",
      "status",
      "alignment",
      "managerNotes",
      "employeeNotes",
    ];

    fields.forEach((f) => {
      if (req.body[f] !== undefined) {
        goal[f] = req.body[f];
      }
    });

    // Auto-update status if progress reaches 100%
    if (goal.progress >= 100 && goal.status !== "Achieved") {
      goal.status = "Achieved";
    }

    await goal.save();

    res.status(200).json({
      success: true,
      data: goal,
      message: "Goal updated successfully",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateGoalProgress = async (req, res) => {
  try {
    const { id } = req.params;
    const { progress, currentMetric, status, employeeNotes, managerNotes } = req.body;

    const goal = await Goal.findOne({ _id: id, tenant: req.tenantId });
    if (!goal) return res.status(404).json({ success: false, message: "Goal not found" });

    if (progress !== undefined) goal.progress = Number(progress);
    if (currentMetric !== undefined) goal.currentMetric = currentMetric;
    if (status !== undefined) goal.status = status;
    if (employeeNotes !== undefined) goal.employeeNotes = employeeNotes;
    if (managerNotes !== undefined) goal.managerNotes = managerNotes;

    if (goal.progress >= 100) {
      goal.status = "Achieved";
    }

    await goal.save();

    res.status(200).json({
      success: true,
      data: goal,
      message: "Goal progress updated successfully",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteGoal = async (req, res) => {
  try {
    const { id } = req.params;
    const goal = await Goal.findOneAndDelete({ _id: id, tenant: req.tenantId });
    if (!goal) return res.status(404).json({ success: false, message: "Goal not found" });

    res.status(200).json({
      success: true,
      message: "Goal deleted successfully",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ==========================================
// 3. KEY PERFORMANCE INDICATORS (KPIs)
// ==========================================
exports.getKPIs = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { department, category, frequency, status, cycle, search } = req.query;

    const filter = { tenant: tenantId };
    if (department && department !== "All") filter.department = department;
    if (category && category !== "All") filter.category = category;
    if (frequency && frequency !== "All") filter.frequency = frequency;
    if (status && status !== "All") filter.status = status;
    if (cycle && cycle !== "All") filter.cycle = cycle;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { code: { $regex: search, $options: "i" } },
        { department: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const kpis = await KPI.find(filter)
      .populate("assignedTo", "name email department")
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: kpis,
      count: kpis.length,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getKPIById = async (req, res) => {
  try {
    const kpi = await KPI.findOne({ _id: req.params.id, tenant: req.tenantId })
      .populate("assignedTo", "name email department")
      .lean();

    if (!kpi) return res.status(404).json({ success: false, message: "KPI not found" });

    res.status(200).json({ success: true, data: kpi });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createKPI = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const {
      title,
      code,
      description,
      department,
      assignedTo,
      assignedToName,
      category,
      unit,
      targetValue,
      currentValue,
      frequency,
      calculationMethod,
      cycle,
    } = req.body;

    if (!title || !department || targetValue === undefined) {
      return res.status(400).json({
        success: false,
        message: "Title, department, and target value are required",
      });
    }

    let resolvedAssignedName = assignedToName;
    if (assignedTo && !resolvedAssignedName) {
      const u = await User.findById(assignedTo).select("name");
      if (u) resolvedAssignedName = u.name;
    }

    const curVal = currentValue !== undefined ? Number(currentValue) : 0;
    const tgtVal = Number(targetValue);

    let evaluatedStatus = "On Track";
    if (curVal >= tgtVal) evaluatedStatus = "Exceeded";
    else if (curVal >= 0.8 * tgtVal) evaluatedStatus = "On Track";
    else if (curVal >= 0.5 * tgtVal) evaluatedStatus = "Behind";
    else evaluatedStatus = "Critical";

    const newKPI = await KPI.create({
      tenant: tenantId,
      title,
      code: code || `KPI-${department.slice(0, 3).toUpperCase()}-${Math.floor(10 + Math.random() * 90)}`,
      description,
      department,
      assignedTo: assignedTo || undefined,
      assignedToName: resolvedAssignedName,
      category: category || "Productivity",
      unit: unit || "Percentage (%)",
      targetValue: tgtVal,
      currentValue: curVal,
      frequency: frequency || "Monthly",
      calculationMethod,
      cycle: cycle || "November 2026",
      status: evaluatedStatus,
      history: [
        {
          date: new Date(),
          value: curVal,
          notes: "Initial target benchmark recorded",
          updatedByName: req.user.name,
        },
      ],
    });

    res.status(201).json({
      success: true,
      data: newKPI,
      message: "KPI created successfully",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateKPI = async (req, res) => {
  try {
    const { id } = req.params;
    const kpi = await KPI.findOne({ _id: id, tenant: req.tenantId });
    if (!kpi) return res.status(404).json({ success: false, message: "KPI not found" });

    const fields = [
      "title",
      "code",
      "description",
      "department",
      "assignedTo",
      "assignedToName",
      "category",
      "unit",
      "targetValue",
      "currentValue",
      "frequency",
      "calculationMethod",
      "status",
      "cycle",
    ];

    fields.forEach((f) => {
      if (req.body[f] !== undefined) {
        kpi[f] = req.body[f];
      }
    });

    // Auto-update status based on values
    if (kpi.targetValue > 0 && req.body.status === undefined) {
      if (kpi.currentValue >= kpi.targetValue) kpi.status = "Exceeded";
      else if (kpi.currentValue >= 0.8 * kpi.targetValue) kpi.status = "On Track";
      else if (kpi.currentValue >= 0.5 * kpi.targetValue) kpi.status = "Behind";
      else kpi.status = "Critical";
    }

    await kpi.save();

    res.status(200).json({
      success: true,
      data: kpi,
      message: "KPI updated successfully",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.recordKPIHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const { value, notes } = req.body;

    if (value === undefined) {
      return res.status(400).json({ success: false, message: "Value is required" });
    }

    const kpi = await KPI.findOne({ _id: id, tenant: req.tenantId });
    if (!kpi) return res.status(404).json({ success: false, message: "KPI not found" });

    const numValue = Number(value);
    kpi.currentValue = numValue;

    // Evaluated status
    if (numValue >= kpi.targetValue) kpi.status = "Exceeded";
    else if (numValue >= 0.8 * kpi.targetValue) kpi.status = "On Track";
    else if (numValue >= 0.5 * kpi.targetValue) kpi.status = "Behind";
    else kpi.status = "Critical";

    kpi.history.push({
      date: new Date(),
      value: numValue,
      notes: notes || "Metric updated",
      updatedByName: req.user.name,
    });

    await kpi.save();

    res.status(200).json({
      success: true,
      data: kpi,
      message: `KPI value updated to ${numValue}`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteKPI = async (req, res) => {
  try {
    const { id } = req.params;
    const kpi = await KPI.findOneAndDelete({ _id: id, tenant: req.tenantId });
    if (!kpi) return res.status(404).json({ success: false, message: "KPI not found" });

    res.status(200).json({
      success: true,
      message: "KPI deleted successfully",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ==========================================
// 4. PERFORMANCE REVIEWS
// ==========================================
exports.getReviews = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { employeeId, reviewerId, cycle, status, search } = req.query;

    const filter = { tenant: tenantId };
    if (employeeId) filter.employee = employeeId;
    if (reviewerId) filter.reviewer = reviewerId;
    if (cycle && cycle !== "All") filter.cycle = cycle;
    if (status && status !== "All") filter.status = status;
    if (search) {
      filter.$or = [
        { employeeName: { $regex: search, $options: "i" } },
        { reviewerName: { $regex: search, $options: "i" } },
        { department: { $regex: search, $options: "i" } },
        { cycle: { $regex: search, $options: "i" } },
      ];
    }

    const reviews = await PerformanceReview.find(filter)
      .populate("employee", "name email department designation avatar")
      .populate("reviewer", "name email designation")
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: reviews,
      count: reviews.length,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getReviewById = async (req, res) => {
  try {
    const review = await PerformanceReview.findOne({ _id: req.params.id, tenant: req.tenantId })
      .populate("employee", "name email department designation avatar")
      .populate("reviewer", "name email designation")
      .lean();

    if (!review) return res.status(404).json({ success: false, message: "Performance review not found" });

    res.status(200).json({ success: true, data: review });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createReview = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { employeeId, reviewerId, cycle, periodStart, periodEnd } = req.body;

    if (!employeeId) {
      return res.status(400).json({ success: false, message: "Employee ID is required" });
    }

    const [empUser, reviewerUser] = await Promise.all([
      User.findOne({ _id: employeeId, tenant: tenantId }).select("name email department designation"),
      reviewerId
        ? User.findOne({ _id: reviewerId, tenant: tenantId }).select("name email")
        : Promise.resolve(req.user),
    ]);

    if (!empUser) return res.status(404).json({ success: false, message: "Employee not found" });

    const newReview = await PerformanceReview.create({
      tenant: tenantId,
      employee: empUser._id,
      employeeName: empUser.name,
      employeeEmail: empUser.email,
      department: empUser.department || "General",
      designation: empUser.designation || "Team Member",
      reviewer: reviewerUser ? reviewerUser._id : req.user._id,
      reviewerName: reviewerUser ? reviewerUser.name : req.user.name,
      cycle: cycle || "Q4 2026 Review",
      periodStart: periodStart ? new Date(periodStart) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      periodEnd: periodEnd ? new Date(periodEnd) : new Date(),
      status: "Self Review Pending",
    });

    await notifyUser(
      tenantId,
      empUser._id,
      `Performance Appraisal Review Initiated: ${cycle || "Q4 2026"}`,
      `Your performance review has been initiated by ${req.user.name}. Please submit your self-assessment.`
    );

    res.status(201).json({
      success: true,
      data: newReview,
      message: `Performance review initiated for ${empUser.name}`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.submitSelfAssessment = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, keyAchievements, challengesFaced, skillsLearned, futureAspirations } = req.body;

    const review = await PerformanceReview.findOne({ _id: id, tenant: req.tenantId });
    if (!review) return res.status(404).json({ success: false, message: "Review not found" });

    review.selfAssessment = {
      rating: Number(rating) || 4,
      keyAchievements,
      challengesFaced,
      skillsLearned,
      futureAspirations,
      submittedAt: new Date(),
    };

    review.status = "Manager Review Pending";
    await review.save();

    await notifyUser(
      req.tenantId,
      review.reviewer,
      `Self-Assessment Submitted: ${review.employeeName}`,
      `${review.employeeName} submitted their self-review for ${review.cycle}. Please complete manager evaluation.`
    );

    res.status(200).json({
      success: true,
      data: review,
      message: "Self assessment submitted successfully",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.submitManagerAssessment = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      ratings,
      overallScore,
      strengths,
      areasForImprovement,
      managerFeedback,
      trainingRecommendations,
    } = req.body;

    const review = await PerformanceReview.findOne({ _id: id, tenant: req.tenantId });
    if (!review) return res.status(404).json({ success: false, message: "Review not found" });

    // Calculate average score across competency ratings if not explicitly passed
    let calculatedScore = overallScore;
    if (!calculatedScore && ratings) {
      const keys = Object.keys(ratings);
      if (keys.length > 0) {
        const sum = keys.reduce((acc, k) => acc + (Number(ratings[k]) || 3), 0);
        calculatedScore = parseFloat((sum / keys.length).toFixed(1));
      }
    }

    review.managerAssessment = {
      ratings: ratings || review.managerAssessment?.ratings,
      overallScore: calculatedScore || 4.0,
      strengths,
      areasForImprovement,
      managerFeedback,
      trainingRecommendations,
      submittedAt: new Date(),
    };

    review.finalRating = calculatedScore || 4.0;

    let label = "Meets Expectations (3)";
    if (review.finalRating >= 4.7) label = "Outstanding (5)";
    else if (review.finalRating >= 3.8) label = "Exceeds Expectations (4)";
    else if (review.finalRating >= 2.8) label = "Meets Expectations (3)";
    else if (review.finalRating >= 2.0) label = "Needs Improvement (2)";
    else label = "Unsatisfactory (1)";

    review.finalRatingLabel = label;
    review.status = "Completed";
    review.completedAt = new Date();

    await review.save();

    await notifyUser(
      req.tenantId,
      review.employee,
      `Performance Review Completed: ${review.cycle}`,
      `Your performance review has been finalized with rating ${review.finalRating} / 5 (${label}).`
    );

    res.status(200).json({
      success: true,
      data: review,
      message: "Manager review submitted and finalized successfully",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteReview = async (req, res) => {
  try {
    const { id } = req.params;
    const review = await PerformanceReview.findOneAndDelete({ _id: id, tenant: req.tenantId });
    if (!review) return res.status(404).json({ success: false, message: "Review not found" });

    res.status(200).json({
      success: true,
      message: "Review deleted successfully",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ==========================================
// 5. CONTINUOUS FEEDBACK & RECOGNITION
// ==========================================
exports.getFeedback = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { toUserId, type, category, visibility } = req.query;

    const filter = { tenant: tenantId };
    if (toUserId) filter.toUser = toUserId;
    if (type && type !== "All") filter.type = type;
    if (category && category !== "All") filter.category = category;
    if (visibility && visibility !== "All") filter.visibility = visibility;

    const feedbackList = await ContinuousFeedback.find(filter)
      .populate("fromUser", "name email department avatar")
      .populate("toUser", "name email department designation avatar")
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: feedbackList,
      count: feedbackList.length,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createFeedback = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { toUserId, type, category, badge, message, visibility } = req.body;

    if (!toUserId || !message) {
      return res.status(400).json({ success: false, message: "Recipient user and feedback message are required" });
    }

    const toUser = await User.findOne({ _id: toUserId, tenant: tenantId }).select("name email");
    if (!toUser) return res.status(404).json({ success: false, message: "Recipient user not found" });

    const newFeedback = await ContinuousFeedback.create({
      tenant: tenantId,
      fromUser: req.user._id,
      fromUserName: req.user.name,
      toUser: toUser._id,
      toUserName: toUser.name,
      type: type || "Praise",
      category: category || "Collaboration",
      badge: badge || "Team Player",
      message,
      visibility: visibility || "Public",
      isAcknowledged: false,
    });

    await notifyUser(
      tenantId,
      toUser._id,
      `New Feedback Received from ${req.user.name}!`,
      `${req.user.name} gave you a "${badge || "Team Player"}" shoutout: "${message.slice(0, 80)}..."`
    );

    res.status(201).json({
      success: true,
      data: newFeedback,
      message: "Continuous feedback posted successfully",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.acknowledgeFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const feedback = await ContinuousFeedback.findOne({ _id: id, tenant: req.tenantId });
    if (!feedback) return res.status(404).json({ success: false, message: "Feedback not found" });

    feedback.isAcknowledged = true;
    feedback.acknowledgedAt = new Date();
    await feedback.save();

    res.status(200).json({
      success: true,
      data: feedback,
      message: "Feedback acknowledged",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const fb = await ContinuousFeedback.findOneAndDelete({ _id: id, tenant: req.tenantId });
    if (!fb) return res.status(404).json({ success: false, message: "Feedback not found" });

    res.status(200).json({
      success: true,
      message: "Feedback deleted successfully",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ==========================================
// 6. APPRAISAL RECORDS
// ==========================================
exports.getAppraisals = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { cycle, status, department, employeeId, search } = req.query;

    const filter = { tenant: tenantId };
    if (cycle && cycle !== "All") filter.appraisalCycle = cycle;
    if (status && status !== "All") filter.status = status;
    if (department && department !== "All") filter.department = department;
    if (employeeId) filter.employee = employeeId;
    if (search) {
      filter.$or = [
        { employeeName: { $regex: search, $options: "i" } },
        { currentDesignation: { $regex: search, $options: "i" } },
        { proposedDesignation: { $regex: search, $options: "i" } },
        { appraisalCycle: { $regex: search, $options: "i" } },
      ];
    }

    const appraisals = await Appraisal.find(filter)
      .populate("employee", "name email department designation baseSalary avatar")
      .populate("signOff.managerSigner", "name email")
      .populate("signOff.hrSigner", "name email")
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: appraisals,
      count: appraisals.length,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAppraisalById = async (req, res) => {
  try {
    const appraisal = await Appraisal.findOne({ _id: req.params.id, tenant: req.tenantId })
      .populate("employee", "name email department designation baseSalary avatar")
      .lean();

    if (!appraisal) return res.status(404).json({ success: false, message: "Appraisal record not found" });

    res.status(200).json({ success: true, data: appraisal });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createAppraisal = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const {
      employeeId,
      proposedDesignation,
      proposedSalary,
      incrementPercentage,
      bonusAmount,
      appraisalCycle,
      evaluationPeriod,
      performanceScore,
      performanceGrade,
      promotionRecommended,
      promotionNotes,
      effectiveDate,
      remarks,
    } = req.body;

    if (!employeeId) {
      return res.status(400).json({ success: false, message: "Employee ID is required" });
    }

    const empUser = await User.findOne({ _id: employeeId, tenant: tenantId });
    if (!empUser) return res.status(404).json({ success: false, message: "Employee not found" });

    const currentSalary = empUser.baseSalary || 20000;
    let finalProposedSalary = proposedSalary !== undefined ? Number(proposedSalary) : currentSalary;
    let finalIncrementPct = incrementPercentage !== undefined ? Number(incrementPercentage) : 0;

    // Auto-calculate increment if proposedSalary or incrementPercentage provided
    if (finalIncrementPct > 0 && (!proposedSalary || proposedSalary === currentSalary)) {
      finalProposedSalary = Math.round(currentSalary * (1 + finalIncrementPct / 100));
    } else if (proposedSalary && proposedSalary > currentSalary && finalIncrementPct === 0) {
      finalIncrementPct = parseFloat((((proposedSalary - currentSalary) / currentSalary) * 100).toFixed(1));
    }

    const newAppraisal = await Appraisal.create({
      tenant: tenantId,
      employee: empUser._id,
      employeeName: empUser.name,
      employeeEmail: empUser.email,
      department: empUser.department || "General",
      currentDesignation: empUser.designation || "Team Member",
      proposedDesignation: proposedDesignation || empUser.designation,
      currentSalary,
      proposedSalary: finalProposedSalary,
      incrementPercentage: finalIncrementPct,
      bonusAmount: bonusAmount || 0,
      appraisalCycle: appraisalCycle || "Annual 2026",
      evaluationPeriod: evaluationPeriod || "Jan 2026 - Dec 2026",
      performanceScore: performanceScore !== undefined ? Number(performanceScore) : 4.0,
      performanceGrade: performanceGrade || "A (Exceeds Expectations)",
      promotionRecommended: !!promotionRecommended,
      promotionNotes,
      effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: "Draft",
      remarks,
      createdBy: req.user._id,
    });

    res.status(201).json({
      success: true,
      data: newAppraisal,
      message: `Appraisal record created for ${empUser.name}`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateAppraisal = async (req, res) => {
  try {
    const { id } = req.params;
    const appraisal = await Appraisal.findOne({ _id: id, tenant: req.tenantId });
    if (!appraisal) return res.status(404).json({ success: false, message: "Appraisal record not found" });

    const fields = [
      "proposedDesignation",
      "proposedSalary",
      "incrementPercentage",
      "bonusAmount",
      "appraisalCycle",
      "evaluationPeriod",
      "performanceScore",
      "performanceGrade",
      "promotionRecommended",
      "promotionNotes",
      "effectiveDate",
      "status",
      "remarks",
    ];

    fields.forEach((f) => {
      if (req.body[f] !== undefined) {
        appraisal[f] = req.body[f];
      }
    });

    if (req.body.incrementPercentage !== undefined && req.body.proposedSalary === undefined) {
      appraisal.proposedSalary = Math.round(appraisal.currentSalary * (1 + appraisal.incrementPercentage / 100));
    }

    await appraisal.save();

    res.status(200).json({
      success: true,
      data: appraisal,
      message: "Appraisal record updated successfully",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.signOffAppraisal = async (req, res) => {
  try {
    const { id } = req.params;
    const { roleType } = req.body; // "manager" | "hr" | "employee"

    const appraisal = await Appraisal.findOne({ _id: id, tenant: req.tenantId });
    if (!appraisal) return res.status(404).json({ success: false, message: "Appraisal record not found" });

    if (roleType === "manager") {
      appraisal.signOff.managerSigned = true;
      appraisal.signOff.managerSignedAt = new Date();
      appraisal.signOff.managerSigner = req.user._id;
      appraisal.signOff.managerSignerName = req.user.name;
      appraisal.status = "Pending HR Approval";

      await notifyHRAndAdmins(
        req.tenantId,
        `Appraisal Manager Sign-off: ${appraisal.employeeName}`,
        `Manager ${req.user.name} signed off appraisal for ${appraisal.employeeName}. Ready for HR approval.`
      );
    } else if (roleType === "hr") {
      appraisal.signOff.hrSigned = true;
      appraisal.signOff.hrSignedAt = new Date();
      appraisal.signOff.hrSigner = req.user._id;
      appraisal.signOff.hrSignerName = req.user.name;
      appraisal.status = "Approved";

      // If promotion or salary change is approved, update user's profile
      if (appraisal.proposedSalary > 0 || appraisal.proposedDesignation) {
        await User.findByIdAndUpdate(appraisal.employee, {
          ...(appraisal.proposedSalary > 0 && { baseSalary: appraisal.proposedSalary }),
          ...(appraisal.proposedDesignation && { designation: appraisal.proposedDesignation }),
        });
      }

      await notifyUser(
        req.tenantId,
        appraisal.employee,
        `Your Annual Appraisal has been Approved!`,
        `Congratulations! Your appraisal for ${appraisal.appraisalCycle} is approved with Grade: ${appraisal.performanceGrade}.`
      );
    } else if (roleType === "employee") {
      appraisal.signOff.employeeAcknowledged = true;
      appraisal.signOff.employeeAcknowledgedAt = new Date();
      appraisal.status = "Acknowledged";
    }

    await appraisal.save();

    res.status(200).json({
      success: true,
      data: appraisal,
      message: `Appraisal sign-off completed for ${roleType}`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteAppraisal = async (req, res) => {
  try {
    const { id } = req.params;
    const appraisal = await Appraisal.findOneAndDelete({ _id: id, tenant: req.tenantId });
    if (!appraisal) return res.status(404).json({ success: false, message: "Appraisal record not found" });

    res.status(200).json({
      success: true,
      message: "Appraisal record deleted successfully",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ==========================================
// 7. EMPLOYEES LIST (FOR DROPDOWNS)
// ==========================================
exports.getPerformanceEmployees = async (req, res) => {
  try {
    const users = await User.find({ tenant: req.tenantId, isActive: { $ne: false } })
      .select("id name email role department team designation empCode baseSalary")
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
