const mongoose = require("mongoose");
const toJSON = require("./plugins/toJSON");

const settingSchema = new mongoose.Schema(
  {
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, unique: true, index: true },
    idleThresholdSeconds: { type: Number, default: 60 },
    defaultWorkingHours: { type: Number, default: 8 },
    officeStartTime: { type: String, default: "09:00" },
    lateGraceMinutes: { type: Number, default: 15 },
    monthlySubmissionDay: { type: Number, default: 25 },
    approvalWindowDay: { type: Number, default: 28 },
    overtimeRateMultiplier: { type: Number, default: 1.5 },
    workingDays: { type: [Number], default: [0, 1, 2, 3, 4] }, // 0=Sun; TECH-BD Sun–Thu
    deductionFormula: { type: String, default: "salary × (presentDays − absentDays − leaveDays) / presentDays + overtimeRate × overtimeHours" },
    leaveAllowance: {
      casual: { type: Number, default: 10 },
      sick: { type: Number, default: 7 },
      annual: { type: Number, default: 15 },
    },
    sickCertificateAfterDays: { type: Number, default: 1 },
  },
  { timestamps: true }
);

settingSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});

module.exports = mongoose.model("Setting", settingSchema);