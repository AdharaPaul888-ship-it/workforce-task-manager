const mongoose = require("mongoose");
const toJSON = require("./plugins/toJSON");

const performanceReviewSchema = new mongoose.Schema(
  {
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    employeeName: { type: String, required: true },
    employeeEmail: { type: String },
    department: { type: String },
    designation: { type: String },
    reviewer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    reviewerName: { type: String, required: true },
    cycle: { type: String, required: true, default: "Q4 2026 Review", index: true },
    periodStart: { type: Date },
    periodEnd: { type: Date },
    status: {
      type: String,
      enum: ["Draft", "Self Review Pending", "Manager Review Pending", "Under Review", "Completed"],
      default: "Self Review Pending",
      index: true,
    },
    selfAssessment: {
      rating: { type: Number, min: 1, max: 5 },
      keyAchievements: { type: String, trim: true },
      challengesFaced: { type: String, trim: true },
      skillsLearned: { type: String, trim: true },
      futureAspirations: { type: String, trim: true },
      submittedAt: { type: Date },
    },
    managerAssessment: {
      ratings: {
        technicalCompetence: { type: Number, min: 1, max: 5, default: 3 },
        qualityOfWork: { type: Number, min: 1, max: 5, default: 3 },
        productivityAndTimeliness: { type: Number, min: 1, max: 5, default: 3 },
        communicationAndTeamwork: { type: Number, min: 1, max: 5, default: 3 },
        initiativeAndProblemSolving: { type: Number, min: 1, max: 5, default: 3 },
        attendanceAndDiscipline: { type: Number, min: 1, max: 5, default: 3 },
      },
      overallScore: { type: Number, min: 1, max: 5 },
      strengths: { type: String, trim: true },
      areasForImprovement: { type: String, trim: true },
      managerFeedback: { type: String, trim: true },
      trainingRecommendations: { type: String, trim: true },
      submittedAt: { type: Date },
    },
    finalRating: { type: Number, min: 1, max: 5 },
    finalRatingLabel: { type: String }, // e.g. "Outstanding (5)", "Exceeds Expectations (4)", "Meets Expectations (3)", etc.
    completedAt: { type: Date },
    hrNotes: { type: String, trim: true },
  },
  { timestamps: true }
);

performanceReviewSchema.index({ tenant: 1, employee: 1, cycle: 1 });
performanceReviewSchema.index({ tenant: 1, reviewer: 1 });
performanceReviewSchema.index({ tenant: 1, status: 1 });

performanceReviewSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});

module.exports = mongoose.model("PerformanceReview", performanceReviewSchema);
