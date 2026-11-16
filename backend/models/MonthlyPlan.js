const mongoose = require("mongoose");
const toJSON = require("./plugins/toJSON");

const scheduleItemSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    weekNumber: { type: Number, min: 1, max: 6, default: 1 },
    startDate: { type: Date },
    endDate: { type: Date },
    deliverables: { type: String, trim: true },
    milestone: { type: String, trim: true },
    status: {
      type: String,
      enum: ["Pending", "In Progress", "Completed", "Delayed"],
      default: "Pending",
    },
    plannedHours: { type: Number, default: 0, min: 0 },
    actualHours: { type: Number, default: 0, min: 0 },
    notes: { type: String, trim: true },
  },
  { _id: true, id: true }
);

const employeeAssignmentSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    employeeName: { type: String, default: "Employee" },
    employeeEmail: { type: String },
    roleInPlan: { type: String, default: "Contributor" },
    department: { type: String },
    targetHours: { type: Number, default: 0, min: 0 },
    actualHours: { type: Number, default: 0, min: 0 },
    assignedTasksCount: { type: Number, default: 0, min: 0 },
    completedTasksCount: { type: Number, default: 0, min: 0 },
    completionRate: { type: Number, default: 0, min: 0, max: 100 },
    status: {
      type: String,
      enum: ["Assigned", "In Progress", "Completed", "Behind Schedule"],
      default: "Assigned",
    },
    deliverables: { type: String, trim: true },
    notes: { type: String, trim: true },
  },
  { _id: true, id: true }
);

const monthlyPlanSchema = new mongoose.Schema(
  {
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    title: { type: String, required: true, trim: true },
    monthCycle: { type: String, required: true, index: true }, // e.g., "2026-11"
    year: { type: Number, required: true, default: () => new Date().getFullYear() },
    month: { type: Number, required: true, default: () => new Date().getMonth() + 1 },
    department: { type: String, required: true, trim: true },
    team: { type: String, trim: true },
    lead: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    leadName: { type: String },
    description: { type: String, trim: true },
    objectives: [{ type: String, trim: true }],
    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Critical"],
      default: "Medium",
    },
    status: {
      type: String,
      enum: ["Draft", "Submitted", "Approved", "In Progress", "Completed", "Rejected"],
      default: "Draft",
      index: true,
    },
    totalPlannedHours: { type: Number, default: 0, min: 0 },
    totalActualHours: { type: Number, default: 0, min: 0 },
    targetBudget: { type: Number, default: 0, min: 0 },
    actualCost: { type: Number, default: 0, min: 0 },
    progressPercentage: { type: Number, default: 0, min: 0, max: 100 },
    schedules: [scheduleItemSchema],
    assignments: [employeeAssignmentSchema],
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    submittedByName: { type: String },
    submittedAt: { type: Date },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedByName: { type: String },
    reviewedAt: { type: Date },
    reviewRemarks: { type: String, trim: true },
    varianceNotes: { type: String, trim: true },
  },
  { timestamps: true }
);

monthlyPlanSchema.index({ tenant: 1, monthCycle: 1 });
monthlyPlanSchema.index({ tenant: 1, department: 1 });
monthlyPlanSchema.index({ tenant: 1, status: 1 });
monthlyPlanSchema.index({ "$text": { score: { $meta: "textScore" } } });

monthlyPlanSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    if (ret.schedules) {
      ret.schedules = ret.schedules.map((s) => ({
        ...s,
        id: s._id ? s._id.toString() : s.id,
      }));
    }
    if (ret.assignments) {
      ret.assignments = ret.assignments.map((a) => ({
        ...a,
        id: a._id ? a._id.toString() : a.id,
      }));
    }
  },
});

module.exports = mongoose.model("MonthlyPlan", monthlyPlanSchema);
