const mongoose = require("mongoose");
const toJSON = require("./plugins/toJSON");

const leaveRequestSchema = new mongoose.Schema(
  {
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    applicantName: { type: String },
    dept: { type: String },
    type: { type: String, enum: ["Casual", "Sick", "Annual", "Unpaid Leave"] },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    days: { type: Number },
    duration: { type: String },
    reason: { type: String },
    status: {
      type: String,
      enum: ["Pending Manager", "Pending HR", "Approved", "Rejected"],
      default: "Pending Manager",
    },
    appliedAt: { type: Date, default: Date.now },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedByName: { type: String },
    remarks: { type: String },
    certificateAttachment: { type: String },
  },
  { timestamps: true }
);

leaveRequestSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});

module.exports = mongoose.model("LeaveRequest", leaveRequestSchema);