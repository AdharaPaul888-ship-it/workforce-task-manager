const mongoose = require("mongoose");
const toJSON = require("./plugins/toJSON");

const interviewSchema = new mongoose.Schema(
  {
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    applicant: { type: mongoose.Schema.Types.ObjectId, ref: "Applicant", required: true, index: true },
    job: { type: mongoose.Schema.Types.ObjectId, ref: "JobOpening", required: true, index: true },
    applicantName: { type: String },
    applicantEmail: { type: String },
    jobTitle: { type: String },
    stage: {
      type: String,
      enum: [
        "Screening Call",
        "Technical Round",
        "Managerial Round",
        "HR Round",
        "Final Culture Fit",
      ],
      default: "Technical Round",
    },
    title: { type: String, required: true },
    scheduledAt: { type: Date, required: true },
    durationMinutes: { type: Number, default: 45 },
    interviewers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    interviewerNames: [{ type: String }],
    type: {
      type: String,
      enum: ["Online Video (Meet/Zoom)", "In-Person", "Phone Call"],
      default: "Online Video (Meet/Zoom)",
    },
    locationOrLink: { type: String, default: "https://meet.google.com" },
    status: {
      type: String,
      enum: ["Scheduled", "Completed", "Cancelled", "Rescheduled"],
      default: "Scheduled",
      index: true,
    },
    feedback: { type: String },
    rating: { type: Number, min: 0, max: 5, default: 0 },
    recommendation: {
      type: String,
      enum: ["Strong Hire", "Hire", "Neutral", "Do Not Hire", "Pending"],
      default: "Pending",
    },
    conductedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

interviewSchema.index({ tenant: 1, applicant: 1 });
interviewSchema.index({ tenant: 1, scheduledAt: 1 });

interviewSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});

module.exports = mongoose.model("Interview", interviewSchema);
