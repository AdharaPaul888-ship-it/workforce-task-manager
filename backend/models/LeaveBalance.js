const mongoose = require("mongoose");
const toJSON = require("./plugins/toJSON");

const leaveBalanceSchema = new mongoose.Schema(
  {
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    year: { type: Number, required: true },
    casualTotal: { type: Number, default: 10 },
    casualUsed: { type: Number, default: 0 },
    sickTotal: { type: Number, default: 7 },
    sickUsed: { type: Number, default: 0 },
    annualTotal: { type: Number, default: 15 },
    annualUsed: { type: Number, default: 0 },
    unpaidUsed: { type: Number, default: 0 },
  },
  { timestamps: true }
);

leaveBalanceSchema.index({ tenant: 1, user: 1, year: 1 }, { unique: true });

leaveBalanceSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});

module.exports = mongoose.model("LeaveBalance", leaveBalanceSchema);