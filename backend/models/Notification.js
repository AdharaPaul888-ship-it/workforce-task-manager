const mongoose = require("mongoose");
const toJSON = require("./plugins/toJSON");

const notificationSchema = new mongoose.Schema(
  {
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    recipients: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    audiencePerm: { type: String },
    title: { type: String, required: true },
    message: { type: String, required: true },
    category: {
      type: String,
      enum: ["timesheet", "plan", "leave", "attendance", "payroll", "security"],
    },
    linkTab: { type: String },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

notificationSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});

module.exports = mongoose.model("Notification", notificationSchema);