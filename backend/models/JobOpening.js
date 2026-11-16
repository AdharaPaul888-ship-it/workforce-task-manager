const mongoose = require("mongoose");
const toJSON = require("./plugins/toJSON");

const jobOpeningSchema = new mongoose.Schema(
  {
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    title: { type: String, required: true, trim: true },
    department: { type: String, required: true },
    team: { type: String },
    location: { type: String, default: "On-site (Dhaka)" },
    employmentType: {
      type: String,
      enum: ["Full-Time", "Part-Time", "Contract", "Internship", "Remote"],
      default: "Full-Time",
    },
    experienceLevel: {
      type: String,
      enum: ["Entry Level", "Mid Level", "Senior Level", "Lead / Executive"],
      default: "Mid Level",
    },
    salaryMin: { type: Number, default: 0 },
    salaryMax: { type: Number, default: 0 },
    currency: { type: String, default: "BDT" },
    vacancies: { type: Number, default: 1, min: 1 },
    deadline: { type: Date },
    description: { type: String, required: true },
    requirements: [{ type: String }],
    responsibilities: [{ type: String }],
    skillsRequired: [{ type: String }],
    status: {
      type: String,
      enum: ["Draft", "Published", "Closed"],
      default: "Published",
      index: true,
    },
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    postedByName: { type: String },
  },
  { timestamps: true }
);

jobOpeningSchema.index({ tenant: 1, status: 1 });
jobOpeningSchema.index({ tenant: 1, department: 1 });

jobOpeningSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});

module.exports = mongoose.model("JobOpening", jobOpeningSchema);
