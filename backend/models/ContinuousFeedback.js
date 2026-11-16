const mongoose = require("mongoose");
const toJSON = require("./plugins/toJSON");

const continuousFeedbackSchema = new mongoose.Schema(
  {
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    fromUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    fromUserName: { type: String, required: true },
    toUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    toUserName: { type: String, required: true },
    type: {
      type: String,
      enum: ["Praise", "Constructive", "1-on-1 Notes", "General Feedback"],
      default: "Praise",
    },
    category: {
      type: String,
      enum: ["Core Values", "Project Contribution", "Collaboration", "Technical Mentorship", "Customer Obsession", "General"],
      default: "Collaboration",
    },
    badge: {
      type: String,
      enum: ["Rockstar", "Team Player", "Problem Solver", "Innovator", "Great Communicator", "Fast Deliverer", "Customer Champion"],
      default: "Team Player",
    },
    message: { type: String, required: true, trim: true },
    visibility: {
      type: String,
      enum: ["Public", "Manager & HR", "Private"],
      default: "Public",
    },
    isAcknowledged: { type: Boolean, default: false },
    acknowledgedAt: { type: Date },
  },
  { timestamps: true }
);

continuousFeedbackSchema.index({ tenant: 1, toUser: 1 });
continuousFeedbackSchema.index({ tenant: 1, fromUser: 1 });

continuousFeedbackSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});

module.exports = mongoose.model("ContinuousFeedback", continuousFeedbackSchema);
