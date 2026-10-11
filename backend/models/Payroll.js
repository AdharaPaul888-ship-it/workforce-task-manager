const mongoose = require("mongoose");
const toJSON = require("./plugins/toJSON");

const payrollSchema = new mongoose.Schema(
  {
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    employeeName: { type: String, required: true },
    empCode: { type: String, required: true },
    dept: { type: String },
    role: { type: String },
    month: { type: String, required: true },
    baseSalary: { type: Number, required: true },
    presentDays: { type: Number, default: 0 },
    absentDays: { type: Number, default: 0 },
    leaveDays: { type: Number, default: 0 },
    bonus: { type: Number, default: 0 },
    deductions: { type: Number, default: 0 },
    overtimeHours: { type: Number, default: 0 },
    netSalary: { type: Number, required: true },
    paymentMethod: { type: String },
    disbursedAt: { type: Date },
    status: {
      type: String,
      enum: ["Draft", "Calculated", "Disbursed"],
      default: "Draft",
    },
  },
  { timestamps: true }
);

payrollSchema.index({ tenant: 1, user: 1, month: 1 }, { unique: true });

payrollSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});

module.exports = mongoose.model("Payroll", payrollSchema);