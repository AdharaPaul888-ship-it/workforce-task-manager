const mongoose = require("mongoose");
const toJSON = require("./plugins/toJSON");

const goalSchema = new mongoose.Schema(
  {
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    employeeName: { type: String, required: true },
    employeeEmail: { type: String },
    department: { type: String },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    category: {
      type: String,
      enum: [
        "Technical & Delivery",
        "Leadership & Initiative",
        "Process Improvement",
        "Customer Success",
        "Learning & Development",
        "Sales & Revenue",
      ],
      default: "Technical & Delivery",
    },
    cycle: { type: String, required: true, default: "Q4 2026", index: true },
    startDate: { type: Date },
    targetDate: { type: Date },
    weightage: { type: Number, default: 20, min: 1, max: 100 },
    targetMetric: { type: String, trim: true },
    currentMetric: { type: String, trim: true },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    status: {
      type: String,
      enum: ["Not Started", "In Progress", "Achieved", "At Risk", "Cancelled"],
      default: "In Progress",
      index: true,
    },
    alignment: { type: String, trim: true },
    managerNotes: { type: String, trim: true },
    employeeNotes: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

goalSchema.index({ tenant: 1, employee: 1, cycle: 1 });
goalSchema.index({ tenant: 1, status: 1 });

goalSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});

module.exports = mongoose.model("Goal", goalSchema);
