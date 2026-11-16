const mongoose = require("mongoose");
const toJSON = require("./plugins/toJSON");

const applicantSchema = new mongoose.Schema(
  {
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    job: { type: mongoose.Schema.Types.ObjectId, ref: "JobOpening", required: true, index: true },
    jobTitle: { type: String },
    department: { type: String },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    currentCompany: { type: String },
    currentPosition: { type: String },
    experienceYears: { type: Number, default: 0 },
    education: { type: String },
    resumeUrl: { type: String },
    portfolioUrl: { type: String },
    coverLetter: { type: String },
    skills: [{ type: String }],
    source: {
      type: String,
      enum: ["Website", "LinkedIn", "Referral", "Job Board", "Direct Application", "Other"],
      default: "Website",
    },
    status: {
      type: String,
      enum: ["Applied", "Screening", "Interview", "Offer", "Hired", "Rejected"],
      default: "Applied",
      index: true,
    },
    rating: { type: Number, min: 0, max: 5, default: 0 },
    notes: { type: String },
    rejectionReason: { type: String },
    offerDetails: {
      offeredSalary: { type: Number },
      joiningDate: { type: Date },
      designation: { type: String },
      status: {
        type: String,
        enum: ["Pending", "Accepted", "Declined"],
        default: "Pending",
      },
      notes: { type: String },
    },
    onboardingInitiated: { type: Boolean, default: false },
    appliedDate: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

applicantSchema.index({ tenant: 1, job: 1 });
applicantSchema.index({ tenant: 1, status: 1 });
applicantSchema.index({ tenant: 1, email: 1 });

applicantSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});

module.exports = mongoose.model("Applicant", applicantSchema);
