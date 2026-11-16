const mongoose = require("mongoose");
const toJSON = require("./plugins/toJSON");

const onboardingTaskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    category: {
      type: String,
      enum: ["Documentation", "IT Setup", "HR Orientation", "Team Training", "Policy Review"],
      default: "Documentation",
    },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    assignedToName: { type: String },
    dueDate: { type: Date },
    isCompleted: { type: Boolean, default: false },
    completedAt: { type: Date },
    notes: { type: String },
  },
  { _id: true }
);

const onboardingSchema = new mongoose.Schema(
  {
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    applicant: { type: mongoose.Schema.Types.ObjectId, ref: "Applicant" },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    employeeName: { type: String, required: true },
    employeeEmail: { type: String, required: true },
    department: { type: String },
    designation: { type: String },
    startDate: { type: Date, default: Date.now },
    mentor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    mentorName: { type: String },
    status: {
      type: String,
      enum: ["Pending", "In Progress", "Completed"],
      default: "Pending",
      index: true,
    },
    progressPercentage: { type: Number, default: 0, min: 0, max: 100 },
    checklist: [onboardingTaskSchema],
    welcomeNotes: { type: String },
    completedDate: { type: Date },
  },
  { timestamps: true }
);

onboardingSchema.index({ tenant: 1, user: 1 });
onboardingSchema.index({ tenant: 1, status: 1 });

onboardingSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});

module.exports = mongoose.model("Onboarding", onboardingSchema);
