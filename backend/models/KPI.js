const mongoose = require("mongoose");
const toJSON = require("./plugins/toJSON");

const kpiHistorySchema = new mongoose.Schema(
  {
    date: { type: Date, default: Date.now },
    value: { type: Number, required: true },
    notes: { type: String, trim: true },
    updatedByName: { type: String },
  },
  { _id: true, id: true }
);

const kpiSchema = new mongoose.Schema(
  {
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    title: { type: String, required: true, trim: true },
    code: { type: String, trim: true }, // e.g., "KPI-ENG-01"
    description: { type: String, trim: true },
    department: { type: String, required: true, trim: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    assignedToName: { type: String },
    category: {
      type: String,
      enum: ["Productivity", "Quality", "Efficiency", "Customer Satisfaction", "Financial / Revenue", "Compliance"],
      default: "Productivity",
    },
    unit: {
      type: String,
      enum: ["Percentage (%)", "Count / Units", "Hours", "BDT / Currency ($)", "Rating (1-5)"],
      default: "Percentage (%)",
    },
    targetValue: { type: Number, required: true },
    currentValue: { type: Number, default: 0 },
    frequency: {
      type: String,
      enum: ["Monthly", "Quarterly", "Annual"],
      default: "Monthly",
    },
    calculationMethod: { type: String, trim: true },
    status: {
      type: String,
      enum: ["On Track", "Exceeded", "Behind", "Critical"],
      default: "On Track",
      index: true,
    },
    cycle: { type: String, default: "November 2026", index: true },
    history: [kpiHistorySchema],
  },
  { timestamps: true }
);

kpiSchema.index({ tenant: 1, department: 1 });
kpiSchema.index({ tenant: 1, status: 1 });

kpiSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    if (ret.history) {
      ret.history = ret.history.map((h) => ({
        ...h,
        id: h._id ? h._id.toString() : h.id,
      }));
    }
  },
});

module.exports = mongoose.model("KPI", kpiSchema);
