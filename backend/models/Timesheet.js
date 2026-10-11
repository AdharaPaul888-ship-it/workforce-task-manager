const mongoose = require("mongoose");
const toJSON = require("./plugins/toJSON");

const timesheetSchema = new mongoose.Schema(
  {
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    userName: { type: String },
    weekStart: { type: Date, required: true },
    weekEnd: { type: Date, required: true },
    weekLabel: { type: String, required: true },
    dailyHours: {
      mon: { type: Number, default: 0 },
      tue: { type: Number, default: 0 },
      wed: { type: Number, default: 0 },
      thu: { type: Number, default: 0 },
      fri: { type: Number, default: 0 },
      sat: { type: Number, default: 0 },
      sun: { type: Number, default: 0 },
    },
    totalHours: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["Draft", "Submitted", "Approved", "Flagged"],
      default: "Draft",
    },
    idleFlags: { type: Number, default: 0 },
    submittedAt: { type: Date },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedByName: { type: String },
    remarks: { type: String },
  },
  { timestamps: true }
);

timesheetSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});

timesheetSchema.pre("save", function () {
  const daily = this.dailyHours;
  this.totalHours = daily.mon + daily.tue + daily.wed + daily.thu + daily.fri + daily.sat + daily.sun;
});

timesheetSchema.index({ tenant: 1, user: 1, weekStart: 1 }, { unique: true });

module.exports = mongoose.model("Timesheet", timesheetSchema);