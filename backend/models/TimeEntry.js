const mongoose = require("mongoose");
const toJSON = require("./plugins/toJSON");

const timeEntrySchema = new mongoose.Schema(
  {
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    userName: { type: String },
    task: { type: mongoose.Schema.Types.ObjectId, ref: "Task", required: true },
    taskTitle: { type: String },
    date: { type: String, required: true },
    startTime: { type: Date },
    endTime: { type: Date },
    durationHours: { type: Number },
    category: { type: String },
    location: { type: String },
    notes: { type: String },
    idleTimeMinutes: { type: Number },
    idleAction: { type: String, enum: ["kept", "discarded"] },
    source: { type: String, enum: ["timer", "manual"] },
    status: { type: String, enum: ["Draft", "Submitted", "Approved"], default: "Draft" },
    timesheet: { type: mongoose.Schema.Types.ObjectId, ref: "Timesheet" },
    isAdjustment: { type: Boolean, default: false },
  },
  { timestamps: true }
);

timeEntrySchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});

timeEntrySchema.index({ tenant: 1, user: 1, date: 1 });

module.exports = mongoose.model("TimeEntry", timeEntrySchema);