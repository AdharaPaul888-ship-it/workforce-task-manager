const mongoose = require("mongoose");
const toJSON = require("./plugins/toJSON");

const appraisalSchema = new mongoose.Schema(
  {
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    employeeName: { type: String, required: true },
    employeeEmail: { type: String },
    department: { type: String },
    currentDesignation: { type: String },
    proposedDesignation: { type: String },
    currentSalary: { type: Number, default: 0 },
    proposedSalary: { type: Number, default: 0 },
    incrementPercentage: { type: Number, default: 0 },
    bonusAmount: { type: Number, default: 0 },
    appraisalCycle: { type: String, required: true, default: "Annual 2026", index: true },
    evaluationPeriod: { type: String, default: "Jan 2026 - Dec 2026" },
    performanceScore: { type: Number, min: 1, max: 5, default: 3.5 },
    performanceGrade: {
      type: String,
      enum: [
        "A+ (Outstanding)",
        "A (Exceeds Expectations)",
        "B (Meets Expectations)",
        "C (Needs Improvement)",
        "D (Unsatisfactory)",
      ],
      default: "B (Meets Expectations)",
    },
    promotionRecommended: { type: Boolean, default: false },
    promotionNotes: { type: String, trim: true },
    effectiveDate: { type: Date },
    signOff: {
      managerSigned: { type: Boolean, default: false },
      managerSignedAt: { type: Date },
      managerSigner: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      managerSignerName: { type: String },
      hrSigned: { type: Boolean, default: false },
      hrSignedAt: { type: Date },
      hrSigner: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      hrSignerName: { type: String },
      employeeAcknowledged: { type: Boolean, default: false },
      employeeAcknowledgedAt: { type: Date },
    },
    status: {
      type: String,
      enum: ["Draft", "Pending HR Approval", "Approved", "Acknowledged", "Rejected"],
      default: "Draft",
      index: true,
    },
    remarks: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

appraisalSchema.index({ tenant: 1, employee: 1, appraisalCycle: 1 });
appraisalSchema.index({ tenant: 1, status: 1 });

appraisalSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});

module.exports = mongoose.model("Appraisal", appraisalSchema);
